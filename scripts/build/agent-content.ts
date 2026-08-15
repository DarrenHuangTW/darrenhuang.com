import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { gfm } from '@truto/turndown-plugin-gfm';
import { load } from 'cheerio';
import matter from 'gray-matter';
import TurndownService from 'turndown';

import { PRODUCTION_SITE_URL } from '../../site.config.js';

interface AgentPage {
  canonicalUrl: URL;
  description: string;
  markdownUrl: URL;
  publishedAt?: string;
  relativeHtmlPath: string;
  title: string;
  type: 'article' | 'website';
  updatedAt?: string;
}

const root = process.cwd();
const distRoot = path.join(root, 'dist');
const configuredBase = normalizeBase(process.env.BASE_PATH ?? '/');
const configuredSite = new URL(process.env.SITE_URL ?? PRODUCTION_SITE_URL);
const expectedArticleCount = 86;

function normalizeBase(value: string): string {
  const normalized = `/${value.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '' : normalized;
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute)));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

function artifactRelative(file: string): string {
  return path.relative(distRoot, file).replaceAll('\\', '/');
}

function servedPathForArtifact(relative: string): string {
  if (relative === 'index.html') {
    return '/';
  }

  if (relative.endsWith('/index.html')) {
    return `/${relative.slice(0, -'index.html'.length)}`;
  }

  return `/${relative}`;
}

function stripConfiguredBase(pathname: string): string {
  if (!configuredBase) {
    return pathname || '/';
  }

  if (pathname === configuredBase || pathname === `${configuredBase}/`) {
    return '/';
  }

  if (pathname.startsWith(`${configuredBase}/`)) {
    return pathname.slice(configuredBase.length) || '/';
  }

  throw new Error(
    `Canonical path ${pathname} does not include BASE_PATH ${configuredBase}.`,
  );
}

function normalizedServedPath(pathname: string): string {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.endsWith('/') ? pathname : pathname.replace(/\/+$/, '');
}

function markdownPathForCanonical(pathname: string): string {
  if (pathname.endsWith('/')) {
    return `${pathname}index.md`;
  }

  if (pathname.endsWith('.html')) {
    return `${pathname.slice(0, -'.html'.length)}.md`;
  }

  return `${pathname}.md`;
}

function markdownPathForArtifact(relativeHtmlPath: string): string {
  if (!relativeHtmlPath.endsWith('.html')) {
    throw new Error(`Expected an HTML artifact: ${relativeHtmlPath}`);
  }

  return `${relativeHtmlPath.slice(0, -'.html'.length)}.md`;
}

function siteAssetUrl(pathname: string): URL {
  const result = new URL(configuredSite.origin);
  const normalized = `/${pathname.replace(/^\/+/, '')}`;
  result.pathname = configuredBase
    ? `${configuredBase}${normalized}`
    : normalized;
  return result;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function markdownLinkText(value: string): string {
  return normalizedText(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]');
}

function markdownBody(html: string): string {
  const turndown = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
    strongDelimiter: '**',
  });
  turndown.use(gfm);
  turndown.remove(['noscript', 'script', 'style', 'template']);
  turndown.addRule('embedded-content', {
    filter: 'iframe',
    replacement(_content, node) {
      const source = node.getAttribute('src');
      if (!source) {
        return '';
      }

      const title = node.getAttribute('title') || 'Embedded content';
      return `\n\n[${markdownLinkText(title)}](${source})\n\n`;
    },
  });

  return turndown
    .turndown(html)
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function markdownDocument(page: AgentPage, body: string): string {
  const metadata = [
    '---',
    `title: ${yamlString(page.title)}`,
    `description: ${yamlString(page.description)}`,
    `canonical: ${yamlString(page.canonicalUrl.toString())}`,
    `markdown: ${yamlString(page.markdownUrl.toString())}`,
    'language: zh-Hant',
    `type: ${page.type}`,
  ];

  if (page.publishedAt) {
    metadata.push(`published: ${yamlString(page.publishedAt)}`);
  }

  if (page.updatedAt) {
    metadata.push(`modified: ${yamlString(page.updatedAt)}`);
  }

  metadata.push('---');

  return `${metadata.join('\n')}\n\n> 此 Markdown 版本由正式 HTML 內容自動產生。\n> 引用時請使用 [canonical page](${page.canonicalUrl.toString()})。\n\n${body}\n`;
}

function pageForHtml(
  relativeHtmlPath: string,
  source: string,
): { body: string; page: AgentPage } | undefined {
  const $ = load(source);
  const main = $('main#main-content').first();
  if (main.length === 0) {
    return undefined;
  }

  const robots = $('meta[name="robots"]').attr('content')?.toLowerCase() ?? '';
  if (robots.includes('noindex')) {
    return undefined;
  }

  const canonicalHref = $('link[rel="canonical"]').attr('href');
  if (!canonicalHref) {
    throw new Error(`${relativeHtmlPath} is missing rel=canonical.`);
  }

  const canonicalUrl = new URL(canonicalHref);
  if (canonicalUrl.origin !== configuredSite.origin) {
    throw new Error(
      `${relativeHtmlPath} canonical origin must be ${configuredSite.origin}.`,
    );
  }

  const canonicalPath = normalizedServedPath(
    decodeURIComponent(stripConfiguredBase(canonicalUrl.pathname)),
  );
  const servedPath = normalizedServedPath(
    servedPathForArtifact(relativeHtmlPath),
  );
  if (canonicalPath !== servedPath) {
    return undefined;
  }

  const title = normalizedText(main.find('h1').first().text());
  if (!title) {
    throw new Error(`${relativeHtmlPath} is missing a visible h1.`);
  }

  const description = normalizedText(
    $('meta[name="description"]').attr('content') ?? '',
  );
  const type =
    $('meta[property="og:type"]').attr('content') === 'article'
      ? 'article'
      : 'website';
  const markdownUrl = new URL(canonicalUrl);
  markdownUrl.pathname = markdownPathForCanonical(canonicalUrl.pathname);
  const publishedAt = $('meta[property="article:published_time"]').attr(
    'content',
  );
  const updatedAt = $('meta[property="article:modified_time"]').attr('content');
  const body = markdownBody(main.html() ?? '');
  if (!body) {
    throw new Error(`${relativeHtmlPath} produced an empty Markdown body.`);
  }

  return {
    body,
    page: {
      canonicalUrl,
      description,
      markdownUrl,
      publishedAt,
      relativeHtmlPath,
      title,
      type,
      updatedAt,
    },
  };
}

function findPage(pages: AgentPage[], pathname: string): AgentPage {
  const page = pages.find(
    (candidate) =>
      stripConfiguredBase(candidate.canonicalUrl.pathname) === pathname,
  );
  if (!page) {
    throw new Error(`Agent content index cannot find ${pathname}.`);
  }

  return page;
}

function llmsDocument(pages: AgentPage[], articleCount: number): string {
  const articles = findPage(pages, '/articles.html');
  const categories = findPage(pages, '/categories.html');
  const tags = findPage(pages, '/tags.html');
  const stories = findPage(pages, '/web-stories.html');
  const about = pages.find((page) =>
    stripConfiguredBase(page.canonicalUrl.pathname).includes('about'),
  );
  if (!about) {
    throw new Error('Agent content index cannot find the About page.');
  }

  const lines = [
    '# 數位引擎',
    '',
    '> 數位行銷、SEO、內容策略與科技趨勢的繁體中文長期觀察。',
    '',
    `數位引擎公開保存 ${articleCount} 篇文章，包含原公開文章與過去的會員電子報。`,
    '文章保留原始發布與更新日期；時效性主張應依日期理解並以最新的一手資料交叉確認。',
    '',
    '## 內容索引',
    '',
    `- [Agent 文章索引](${siteAssetUrl('/articles-llms.txt')}): 所有文章的日期、摘要與 Markdown 版本。`,
    `- [全部文章](${articles.canonicalUrl}): 面向一般讀者的完整文章列表。`,
    `- [分類](${categories.canonicalUrl}): 依內容分類瀏覽文章。`,
    `- [標籤](${tags.canonicalUrl}): 依標籤瀏覽文章。`,
    `- [Web Stories](${stories.canonicalUrl}): 視覺故事與可讀逐頁文字。`,
    '',
    '## 網站資訊',
    '',
    `- [關於數位引擎](${about.markdownUrl}): 網站沿革與內容定位。`,
    `- [RSS](${siteAssetUrl('/rss.xml')}): 文章更新 feed。`,
    `- [Sitemap](${siteAssetUrl('/sitemap-index.xml')}): 所有 canonical 網址。`,
    '',
    '## Agent 使用說明',
    '',
    '- 優先讀取本檔、Agent 文章索引，再選擇與任務相關的 Markdown 頁面。',
    '- 每個 Markdown 頁面的 frontmatter 都提供 canonical HTML 網址；對外引用請使用 canonical 網址。',
    '- 網站主要語言是繁體中文（zh-Hant）。',
    '- 不要把歷史 SEO 文章中的產品介面、政策或演算法描述當成未經查證的現況。',
    '',
  ];

  return lines.join('\n');
}

function articleIndexDocument(articlePages: AgentPage[]): string {
  const sorted = articlePages.toSorted((left, right) =>
    (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''),
  );
  const lines = [
    '# 數位引擎文章索引',
    '',
    `> 共 ${sorted.length} 篇繁體中文文章，依原始發布日期由新到舊排列。`,
    '',
    '每個連結都指向精簡的 Markdown 版本。',
    '引用文章時，請改用該 Markdown frontmatter 內的 canonical HTML 網址。',
  ];
  let currentYear = '';

  for (const page of sorted) {
    const year = page.publishedAt?.slice(0, 4) || '日期不明';
    if (year !== currentYear) {
      lines.push('', `## ${year}`, '');
      currentYear = year;
    }

    const published = page.publishedAt?.slice(0, 10) ?? '日期不明';
    const description = page.description
      ? ` — ${normalizedText(page.description)}`
      : '';
    lines.push(
      `- [${markdownLinkText(page.title)}](${page.markdownUrl}) — ${published}${description}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

async function writeSkillIndex(): Promise<void> {
  const skillRelative = path.posix.join(
    '.well-known',
    'agent-skills',
    'research-digital-engine',
    'SKILL.md',
  );
  const skillPath = path.join(distRoot, ...skillRelative.split('/'));
  const skillBytes = await readFile(skillPath);
  const parsed = matter(skillBytes.toString('utf8'));
  const name = parsed.data.name;
  const description = parsed.data.description;

  if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error('Agent skill has an invalid name.');
  }

  if (typeof description !== 'string' || !description.trim()) {
    throw new Error('Agent skill has an invalid description.');
  }

  const digest = createHash('sha256').update(skillBytes).digest('hex');
  const index = {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name,
        type: 'skill-md',
        description,
        url: 'research-digital-engine/SKILL.md',
        digest: `sha256:${digest}`,
      },
    ],
  };
  const indexPath = path.join(
    distRoot,
    '.well-known',
    'agent-skills',
    'index.json',
  );
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const htmlFiles = (await walkFiles(distRoot)).filter((file) =>
    file.toLowerCase().endsWith('.html'),
  );
  const pages: AgentPage[] = [];

  for (const htmlFile of htmlFiles) {
    const relativeHtmlPath = artifactRelative(htmlFile);
    const source = await readFile(htmlFile, 'utf8');
    const result = pageForHtml(relativeHtmlPath, source);
    if (!result) {
      continue;
    }

    const markdownRelative = markdownPathForArtifact(relativeHtmlPath);
    const markdownAbsolute = path.resolve(
      distRoot,
      ...markdownRelative.split('/'),
    );
    if (!markdownAbsolute.startsWith(`${path.resolve(distRoot)}${path.sep}`)) {
      throw new Error(`Refusing to write outside dist: ${markdownRelative}`);
    }

    await mkdir(path.dirname(markdownAbsolute), { recursive: true });
    await writeFile(
      markdownAbsolute,
      markdownDocument(result.page, result.body),
      'utf8',
    );
    pages.push(result.page);
  }

  const articlePages = pages.filter((page) => page.type === 'article');
  if (articlePages.length !== expectedArticleCount) {
    throw new Error(
      `Expected ${expectedArticleCount} article Markdown pages, generated ${articlePages.length}.`,
    );
  }

  await writeFile(
    path.join(distRoot, 'llms.txt'),
    llmsDocument(pages, articlePages.length),
    'utf8',
  );
  await writeFile(
    path.join(distRoot, 'articles-llms.txt'),
    articleIndexDocument(articlePages),
    'utf8',
  );
  await writeSkillIndex();

  console.log(
    `[agent-content] PASS: generated ${pages.length} Markdown pages, ${articlePages.length} article entries, llms.txt, and one verified skill index.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[agent-content] FAILED: ${message}`);
  process.exitCode = 1;
});
