import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { load } from 'cheerio';
import matter from 'gray-matter';
import { PRODUCTION_SITE_URL, productionSiteUrl } from '../../site.config';
import { TAXONOMY_TRANSLATIONS } from '../../src/i18n/config';
import { slugifyTaxonomy } from '../../src/lib/taxonomy';

type UnknownRecord = Record<string, unknown>;

interface TranslationEntry {
  featuredMediaAlt?: string;
  sourceId: string;
  slug: string;
  translationKey: string;
  title: string;
}

interface SourceEntry {
  canonicalPath: string;
  publishedAt: string;
  slug: string;
}

const root = process.cwd();
const distRoot = path.join(root, 'dist');
const translationRoot = path.join(
  root,
  'src',
  'content',
  'post-translations',
  'en',
);
const sourceRoot = path.join(root, 'src', 'content', 'posts');
const failures: string[] = [];
const interfaceCounterparts = new Map<string, string>([
  ['/en/', '/'],
  ['/en/about.html', '/about.html'],
  ['/en/articles.html', '/articles.html'],
  ['/en/categories.html', '/categories.html'],
  ['/en/contact.html', '/contact.html'],
  ['/en/developers.html', '/developers.html'],
  ['/en/membership.html', '/membership.html'],
  ['/en/notes.html', '/notes.html'],
  ['/en/privacy.html', '/privacy.html'],
  ['/en/tags.html', '/tags.html'],
  ['/en/web-stories.html', '/web-stories.html'],
]);

function check(condition: unknown, message: string): condition is true {
  if (!condition) failures.push(message);
  return Boolean(condition);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function dateValue(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

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

function artifactForPath(pathname: string): string {
  if (pathname === '/') return path.join(distRoot, 'index.html');
  if (pathname === '/en/') return path.join(distRoot, 'en', 'index.html');
  return path.join(distRoot, ...pathname.replace(/^\/+/, '').split('/'));
}

function markdownArtifactForPath(pathname: string): string {
  if (pathname.endsWith('/')) {
    return path.join(
      distRoot,
      ...`${pathname.replace(/^\/+/, '')}index.md`.split('/'),
    );
  }
  return path.join(
    distRoot,
    ...pathname
      .replace(/^\/+/, '')
      .replace(/\.html$/u, '.md')
      .split('/'),
  );
}

function absolute(pathname: string): string {
  return productionSiteUrl(pathname).toString();
}

function normalizedUrl(value: string): string | undefined {
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function htmlPathForArtifact(file: string): string {
  const relative = path.relative(distRoot, file).replaceAll('\\', '/');
  return relative === 'en/index.html' ? '/en/' : `/${relative}`;
}

async function loadTranslations(): Promise<TranslationEntry[]> {
  const files = (await walkFiles(translationRoot)).filter((file) =>
    /\.mdx?$/u.test(file),
  );
  const translations: TranslationEntry[] = [];

  for (const file of files) {
    const parsed = matter(await readFile(file, 'utf8'));
    const data = parsed.data as UnknownRecord;
    if (data.status !== 'published') continue;

    const sourceId = stringValue(data.sourceId);
    const slug = stringValue(data.slug);
    const translationKey = stringValue(data.translationKey);
    const title = stringValue(data.title);
    const featuredMediaAlt = stringValue(data.featuredMediaAlt);
    if (!sourceId || !slug || !translationKey || !title) {
      failures.push(`${path.relative(root, file)} 的已發布 metadata 不完整。`);
      continue;
    }
    translations.push({
      featuredMediaAlt,
      sourceId,
      slug,
      translationKey,
      title,
    });
  }

  check(translations.length === 10, '英文站必須恰好發布 10 篇代表文章。');
  return translations;
}

async function loadSources(): Promise<Map<string, SourceEntry>> {
  const files = (await walkFiles(sourceRoot)).filter((file) =>
    /\.mdx?$/u.test(file),
  );
  const sources = new Map<string, SourceEntry>();

  for (const file of files) {
    const parsed = matter(await readFile(file, 'utf8'));
    const data = parsed.data as UnknownRecord;
    const slug = stringValue(data.slug);
    const canonicalPath = stringValue(data.canonicalPath);
    const publishedAt = dateValue(data.publishedAt);
    if (slug && canonicalPath && publishedAt) {
      sources.set(slug, { canonicalPath, publishedAt, slug });
    }
  }

  return sources;
}

function alternateMap(
  $: ReturnType<typeof load>,
): Map<string, string | undefined> {
  const alternates = new Map<string, string | undefined>();
  $('link[rel="alternate"][hreflang]').each((_index, element) => {
    alternates.set(
      $(element).attr('hreflang') ?? '',
      normalizedUrl($(element).attr('href') ?? ''),
    );
  });
  return alternates;
}

async function verifyEnglishHtmlSurface(): Promise<void> {
  const englishRoot = path.join(distRoot, 'en');
  const files = (await walkFiles(englishRoot)).filter((file) =>
    file.endsWith('.html'),
  );
  check(files.length >= 22, '英文站 HTML 產物數量異常。');

  for (const file of files) {
    const pathname = htmlPathForArtifact(file);
    const relative = path.relative(distRoot, file).replaceAll('\\', '/');
    const $ = load(await readFile(file, 'utf8'));
    const isNotFound = pathname === '/en/404.html';

    check(
      $('html').attr('lang') === 'en',
      `${relative} 的 html lang 必須是 en。`,
    );
    check(
      $('html').attr('data-page-locale') === 'en',
      `${relative} 缺少 data-page-locale=en。`,
    );
    check(
      $('title').text().includes('Digital Engine by Darren Huang'),
      `${relative} 的 title 缺少英文品牌與 byline。`,
    );
    check(
      Boolean($('meta[name="description"]').attr('content')?.trim()),
      `${relative} 缺少 meta description。`,
    );
    check($('main h1').length === 1, `${relative} 必須恰好有一個 main h1。`);
    check(
      !/[\u3400-\u9fff]/u.test($('main h1').text()),
      `${relative} 的主標題仍含中文字元。`,
    );
    check(
      $('link[rel="alternate"][type="application/rss+xml"]').attr('href') ===
        '/en/rss.xml',
      `${relative} 必須連到英文 RSS。`,
    );
    check(
      $('.language-switcher [aria-current="page"][lang="en"]').length === 1,
      `${relative} 的語言切換器未標示目前為 English。`,
    );
    check(
      $('.language-switcher a[lang="zh-Hant"]').length === 1,
      `${relative} 的語言切換器缺少繁體中文連結。`,
    );

    if (isNotFound) {
      check(
        /noindex/iu.test($('meta[name="robots"]').attr('content') ?? ''),
        `${relative} 必須 noindex。`,
      );
    } else {
      check(
        !$('meta[name="robots"]').attr('content')?.includes('noindex'),
        `${relative} 不得 noindex。`,
      );
      check(
        normalizedUrl($('link[rel="canonical"]').attr('href') ?? '') ===
          absolute(pathname),
        `${relative} 的 canonical URL 不正確。`,
      );
    }

    $('main img:not([data-lightbox-image])').each((_index, element) => {
      const image = $(element);
      check(
        Boolean(image.attr('alt')?.trim()),
        `${relative} 的內容圖片缺少英文 alt：${image.attr('src') ?? '(no src)'}`,
      );
    });
  }

  check(
    !(await exists(path.join(distRoot, 'en.html'))),
    '不得殘留 dist/en.html；英文首頁必須由 /en/ 提供。',
  );
  check(
    await exists(path.join(distRoot, 'en', 'index.html')),
    '缺少 dist/en/index.html。',
  );
}

async function verifyCounterpartHtml(
  englishPath: string,
  chinesePath: string,
  translationKey?: string,
): Promise<void> {
  const expected = new Map([
    ['zh-Hant', absolute(chinesePath)],
    ['en', absolute(englishPath)],
    ['x-default', absolute(englishPath)],
  ]);

  for (const [localePath, localeName] of [
    [englishPath, '英文'],
    [chinesePath, '中文'],
  ] as const) {
    const file = artifactForPath(localePath);
    if (
      !check(
        await exists(file),
        `${localeName} counterpart 不存在：${localePath}`,
      )
    ) {
      continue;
    }
    const $ = load(await readFile(file, 'utf8'));
    const alternates = alternateMap($);
    for (const [hreflang, href] of expected) {
      check(
        alternates.get(hreflang) === href,
        `${localePath} 的 hreflang=${hreflang} 必須是 ${href}。`,
      );
    }

    if (localePath === englishPath) {
      check(
        $('meta[property="og:locale"]').attr('content') === 'en_US',
        `${englishPath} 的 og:locale 必須是 en_US。`,
      );
      check(
        $('meta[property="og:locale:alternate"][content="zh_TW"]').length === 1,
        `${englishPath} 缺少 og:locale:alternate=zh_TW。`,
      );
      if (translationKey) {
        check(
          $('html').attr('data-translation-key') === translationKey,
          `${englishPath} 的 translation key 不正確。`,
        );
      }
    } else {
      check(
        $('meta[property="og:locale"]').attr('content') === 'zh_TW',
        `${chinesePath} 的 og:locale 必須是 zh_TW。`,
      );
      check(
        $('meta[property="og:locale:alternate"][content="en_US"]').length === 1,
        `${chinesePath} 缺少 og:locale:alternate=en_US。`,
      );
    }
  }
}

async function verifyArticles(
  translations: TranslationEntry[],
  sources: Map<string, SourceEntry>,
): Promise<Map<string, string>> {
  const counterparts = new Map(interfaceCounterparts);

  for (const translation of translations) {
    const source = sources.get(translation.sourceId);
    if (!check(source, `找不到來源文章：${translation.sourceId}`)) continue;
    const englishPath = `/en/${translation.slug}.html`;
    counterparts.set(englishPath, source.canonicalPath);
    await verifyCounterpartHtml(
      englishPath,
      source.canonicalPath,
      translation.translationKey,
    );

    const htmlFile = artifactForPath(englishPath);
    if (!(await exists(htmlFile))) continue;
    const $ = load(await readFile(htmlFile, 'utf8'));
    check(
      $('meta[property="article:published_time"]').attr('content') ===
        source.publishedAt,
      `${englishPath} 沒有保留原始 published date ${source.publishedAt}。`,
    );
    check(
      $('.article__historical-notice').length === 1,
      `${englishPath} 缺少中文原文與歷史脈絡說明。`,
    );
    check(
      $('.article__review-banner').length === 0,
      `${englishPath} 仍顯示待審核 banner。`,
    );
    if (translation.featuredMediaAlt) {
      check(
        $('meta[property="og:image:alt"]').attr('content') ===
          translation.featuredMediaAlt,
        `${englishPath} 的 Open Graph image alt 未使用英文翻譯。`,
      );
      check(
        $('meta[name="twitter:image:alt"]').attr('content') ===
          translation.featuredMediaAlt,
        `${englishPath} 的 Twitter image alt 未使用英文翻譯。`,
      );
    }
    check(
      $('meta[name="robots"]').attr('content')?.includes('noindex') !== true,
      `${englishPath} 已發布但仍為 noindex。`,
    );
    $('.prose [src], .prose a[href]').each((_index, element) => {
      const attribute = $(element).is('a') ? 'href' : 'src';
      const value = $(element).attr(attribute) ?? '';
      check(
        !value.startsWith('./') && !value.startsWith('../'),
        `${englishPath} 仍含未解析的相對 ${attribute}：${value}`,
      );
    });

    const markdownFile = markdownArtifactForPath(englishPath);
    if (
      !check(await exists(markdownFile), `${englishPath} 缺少 Markdown 版本。`)
    ) {
      continue;
    }
    const markdown = matter(await readFile(markdownFile, 'utf8'));
    const data = markdown.data as UnknownRecord;
    check(data.locale === 'en', `${englishPath} Markdown locale 必須是 en。`);
    check(
      data.language === 'en',
      `${englishPath} Markdown language 必須是 en。`,
    );
    check(
      data.translationKey === translation.translationKey,
      `${englishPath} Markdown translationKey 不正確。`,
    );
    check(
      normalizedUrl(stringValue(data.canonical) ?? '') ===
        absolute(englishPath),
      `${englishPath} Markdown canonical 不正確。`,
    );
    check(
      dateValue(data.published) === source.publishedAt,
      `${englishPath} Markdown 沒有保留原始 published date。`,
    );
    check(
      markdown.content.includes('Originally published in Chinese'),
      `${englishPath} Markdown 缺少中文原文說明。`,
    );
  }

  return counterparts;
}

async function verifyTaxonomyCounterparts(
  counterparts: Map<string, string>,
): Promise<void> {
  for (const kind of ['categories', 'tags'] as const) {
    for (const [sourceLabel, englishLabel] of Object.entries(
      TAXONOMY_TRANSLATIONS.en[kind],
    )) {
      const chinesePath = `/${kind}/${slugifyTaxonomy(sourceLabel)}.html`;
      const englishPath = `/en/${kind}/${slugifyTaxonomy(englishLabel)}.html`;
      counterparts.set(englishPath, chinesePath);
      await verifyCounterpartHtml(englishPath, chinesePath);
    }
  }
}

async function sitemapMap(): Promise<Map<string, Map<string, string>>> {
  const files = (await readdir(distRoot))
    .filter((name) => /^sitemap-\d+\.xml$/u.test(name))
    .map((name) => path.join(distRoot, name));
  const result = new Map<string, Map<string, string>>();

  for (const file of files) {
    const $ = load(await readFile(file, 'utf8'), { xmlMode: true });
    $('url').each((_index, element) => {
      const loc = normalizedUrl($(element).children('loc').text().trim());
      if (!loc) return;
      const alternates = new Map<string, string>();
      $(element)
        .children()
        .each((_childIndex, child) => {
          const hreflang = $(child).attr('hreflang');
          const href = normalizedUrl($(child).attr('href') ?? '');
          if (hreflang && href) alternates.set(hreflang, href);
        });
      result.set(loc, alternates);
    });
  }

  check(result.size > 0, 'Sitemap 沒有可驗證的 URL。');
  return result;
}

async function verifySitemap(counterparts: Map<string, string>): Promise<void> {
  const sitemap = await sitemapMap();

  for (const [englishPath, chinesePath] of counterparts) {
    const englishUrl = absolute(englishPath);
    const chineseUrl = absolute(chinesePath);
    const englishAlternates = sitemap.get(englishUrl);
    const chineseAlternates = sitemap.get(chineseUrl);
    check(Boolean(englishAlternates), `Sitemap 缺少 ${englishUrl}。`);
    check(Boolean(chineseAlternates), `Sitemap 缺少 ${chineseUrl}。`);
    for (const [label, alternates] of [
      ['英文', englishAlternates],
      ['中文', chineseAlternates],
    ] as const) {
      if (!alternates) continue;
      check(
        alternates.get('en') === englishUrl,
        `Sitemap ${label} cluster 的 en alternate 不正確：${englishPath}。`,
      );
      check(
        alternates.get('zh-Hant') === chineseUrl,
        `Sitemap ${label} cluster 的 zh-Hant alternate 不正確：${chinesePath}。`,
      );
    }
  }

  for (const [loc, alternates] of sitemap) {
    for (const candidate of [loc, ...alternates.values()]) {
      const url = new URL(candidate);
      if (url.origin !== PRODUCTION_SITE_URL) continue;
      if (
        url.pathname === '/' ||
        url.pathname === '/en/' ||
        url.pathname.endsWith('/') ||
        /\.[a-z\d]+$/iu.test(url.pathname)
      ) {
        continue;
      }
      failures.push(`Sitemap 含有非精確的 extensionless URL：${candidate}`);
    }
  }
}

async function parseJsonArtifact(
  relative: string,
): Promise<UnknownRecord | undefined> {
  const file = path.join(distRoot, ...relative.split('/'));
  if (!check(await exists(file), `缺少 dist/${relative}。`)) return undefined;
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!isRecord(value)) {
    check(false, `dist/${relative} 必須是 JSON object。`);
    return undefined;
  }
  return value;
}

function itemsFromApi(
  value: UnknownRecord | undefined,
  label: string,
): UnknownRecord[] {
  if (!value) return [];
  const items = value.items;
  if (!Array.isArray(items)) {
    check(false, `${label}.items 必須是陣列。`);
    return [];
  }
  return items.filter((item): item is UnknownRecord => isRecord(item));
}

async function verifyApiAndAgentContent(
  translations: TranslationEntry[],
): Promise<void> {
  const articles = await parseJsonArtifact('api/en/articles.json');
  const content = await parseJsonArtifact('api/en/content.json');
  const notes = await parseJsonArtifact('api/en/notes.json');
  const combined = await parseJsonArtifact('api/content.json');
  const articleItems = itemsFromApi(articles, 'api/en/articles.json');
  const contentItems = itemsFromApi(content, 'api/en/content.json');
  const noteItems = itemsFromApi(notes, 'api/en/notes.json');
  const combinedItems = itemsFromApi(combined, 'api/content.json');

  check(articles?.count === 10, '英文 articles API count 必須是 10。');
  check(content?.count === 10, '英文 content API count 必須是 10。');
  check(notes?.count === 0, '英文 notes API count 必須是 0。');
  check(articleItems.length === 10, '英文 articles API 必須包含 10 筆。');
  check(contentItems.length === 10, '英文 content API 必須包含 10 筆。');
  check(noteItems.length === 0, '英文 notes API 目前必須為空。');
  check(
    combinedItems.filter((item) => item.locale === 'en').length === 10,
    '整站 content API 必須包含 10 筆英文內容。',
  );

  const expectedKeys = new Set(translations.map((item) => item.translationKey));
  for (const item of articleItems) {
    const slug = stringValue(item.slug) ?? '(missing slug)';
    check(item.locale === 'en', `英文 API ${slug} 的 locale 必須是 en。`);
    check(item.language === 'en', `英文 API ${slug} 的 language 必須是 en。`);
    check(
      expectedKeys.has(stringValue(item.translationKey) ?? ''),
      `英文 API ${slug} 的 translationKey 不正確。`,
    );
    check(
      normalizedUrl(stringValue(item.canonicalUrl) ?? '') ===
        absolute(`/en/${slug}.html`),
      `英文 API ${slug} 的 canonicalUrl 不正確。`,
    );
    check(
      normalizedUrl(stringValue(item.markdownUrl) ?? '') ===
        absolute(`/en/${slug}.md`),
      `英文 API ${slug} 的 markdownUrl 不正確。`,
    );
    check(
      normalizedUrl(stringValue(item.apiUrl) ?? '') ===
        absolute(`/api/en/articles/${slug}.json`),
      `英文 API ${slug} 的 apiUrl 不正確。`,
    );

    const detail = await parseJsonArtifact(`api/en/articles/${slug}.json`);
    check(detail?.locale === 'en', `英文 detail API ${slug} locale 不正確。`);
    check(
      detail?.translationKey === item.translationKey,
      `英文 detail API ${slug} translationKey 不正確。`,
    );
  }

  for (const relative of [
    'en/llms.txt',
    'en/articles-llms.txt',
    'en/notes-llms.txt',
  ]) {
    const file = path.join(distRoot, ...relative.split('/'));
    check(await exists(file), `缺少 dist/${relative}。`);
  }
  if (await exists(path.join(distRoot, 'en', 'llms.txt'))) {
    const llms = await readFile(path.join(distRoot, 'en', 'llms.txt'), 'utf8');
    check(
      llms.includes('currently publishes 10 English article translations'),
      '英文 llms.txt 沒有正確揭露 10 篇翻譯。',
    );
    check(
      llms.includes('/api/en/content.json'),
      '英文 llms.txt 缺少英文 content API。',
    );
  }
}

async function verifyRss(translations: TranslationEntry[]): Promise<void> {
  const file = path.join(distRoot, 'en', 'rss.xml');
  if (!check(await exists(file), '缺少 dist/en/rss.xml。')) return;
  const $ = load(await readFile(file, 'utf8'), { xmlMode: true });
  const links = new Set(
    $('item > link')
      .map((_index, element) => normalizedUrl($(element).text().trim()))
      .get()
      .filter((value): value is string => Boolean(value)),
  );
  check(
    $('channel > language').text() === 'en-US',
    '英文 RSS language 必須是 en-US。',
  );
  check($('item').length === 10, '英文 RSS 必須恰好包含 10 篇文章。');
  for (const translation of translations) {
    check(
      links.has(absolute(`/en/${translation.slug}.html`)),
      `英文 RSS 缺少 ${translation.slug}。`,
    );
  }
}

async function main(): Promise<void> {
  if (!(await exists(distRoot))) {
    throw new Error('找不到 dist。請先執行 npm run build。');
  }

  const [translations, sources] = await Promise.all([
    loadTranslations(),
    loadSources(),
  ]);
  await verifyEnglishHtmlSurface();
  for (const [englishPath, chinesePath] of interfaceCounterparts) {
    await verifyCounterpartHtml(englishPath, chinesePath);
  }
  const counterparts = await verifyArticles(translations, sources);
  await verifyTaxonomyCounterparts(counterparts);
  await Promise.all([
    verifySitemap(counterparts),
    verifyRss(translations),
    verifyApiAndAgentContent(translations),
  ]);

  if (failures.length > 0) {
    const uniqueFailures = [...new Set(failures)];
    console.error(
      `[verify:i18n:dist] FAILED：${uniqueFailures.length} 個問題。`,
    );
    for (const failure of uniqueFailures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `[verify:i18n:dist] PASS：11 個英文介面頁、${translations.length} 篇英文文章、RSS、sitemap、Markdown 與 API 均符合多語系規格。`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify:i18n:dist] FAILED：${message}`);
  process.exitCode = 1;
});
