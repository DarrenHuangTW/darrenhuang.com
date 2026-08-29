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
  contentKind: 'article' | 'note';
  description: string;
  markdownUrl: URL;
  publishedAt?: string;
  relativeHtmlPath: string;
  title: string;
  type: 'article' | 'website';
  updatedAt?: string;
}

interface AgentApiItem {
  canonicalUrl: string;
  description: string;
  kind: 'article' | 'note';
  markdownUrl: string;
  publishedAt: string | null;
  slug: string;
  title: string;
  updatedAt: string | null;
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

function writeJsonArtifactPath(relative: string): string {
  const distPath = path.resolve(distRoot);
  const outputPath = path.resolve(distRoot, ...relative.split('/'));
  if (
    outputPath !== distPath &&
    !outputPath.startsWith(`${distPath}${path.sep}`)
  ) {
    throw new Error(`Refusing to write outside dist: ${relative}`);
  }

  return outputPath;
}

async function writeJsonArtifact(
  relative: string,
  value: unknown,
): Promise<void> {
  const outputPath = writeJsonArtifactPath(relative);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
      contentKind: canonicalPath.startsWith('/notes/') ? 'note' : 'article',
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

function llmsDocument(
  pages: AgentPage[],
  articleCount: number,
  noteCount: number,
): string {
  const articles = findPage(pages, '/articles.html');
  const categories = findPage(pages, '/categories.html');
  const tags = findPage(pages, '/tags.html');
  const stories = findPage(pages, '/web-stories.html');
  const notes = findPage(pages, '/notes.html');
  const about = findPage(pages, '/about.html');
  const contact = findPage(pages, '/contact.html');
  const privacy = findPage(pages, '/privacy.html');

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
    `- [Agent 筆記索引](${siteAssetUrl('/notes-llms.txt')}): ${noteCount} 篇已發布 Facebook 保存筆記的日期、摘要與 Markdown 版本。`,
    `- [全部文章](${articles.canonicalUrl}): 面向一般讀者的完整文章列表。`,
    `- [Facebook 保存筆記](${notes.canonicalUrl}): 從社群內容整理出的長期筆記。`,
    `- [分類](${categories.canonicalUrl}): 依內容分類瀏覽文章。`,
    `- [標籤](${tags.canonicalUrl}): 依標籤瀏覽文章。`,
    `- [Web Stories](${stories.canonicalUrl}): 視覺故事與可讀逐頁文字。`,
    '',
    '## 網站資訊',
    '',
    `- [關於數位引擎](${about.markdownUrl}): 網站沿革與內容定位。`,
    `- [聯絡](${contact.markdownUrl}): 聯絡 Darren，討論 SEO、AI、自動化與內容策略。`,
    `- [隱私說明](${privacy.markdownUrl}): 公開內容、第三方服務與資料處理摘要。`,
    `- [RSS](${siteAssetUrl('/rss.xml')}): 文章更新 feed。`,
    `- [Sitemap](${siteAssetUrl('/sitemap-index.xml')}): 所有 canonical 網址。`,
    '',
    '## Programmatic interfaces',
    '',
    `- [OpenAPI specification](${siteAssetUrl('/openapi.json')}): 公開唯讀文章與筆記 API 的 OpenAPI 3.1 描述。`,
    `- [API Catalog](${siteAssetUrl('/.well-known/api-catalog')}): 依 RFC 9727 發布的 API 入口索引。`,
    `- [ARD catalog](${siteAssetUrl('/.well-known/ai-catalog.json')}): 依 Agentic Resource Discovery 描述本站公開 API、MCP 與 Skill。`,
    `- [MCP Server Card](${siteAssetUrl('/.well-known/mcp/server-card.json')}): 公開唯讀 MCP endpoint 與 tools 說明。`,
    `- [Authentication guidance](${siteAssetUrl('/auth.md')}): 本站目前不提供登入、付款或代表使用者操作。`,
    `- [WebMCP tools](${siteAssetUrl('/.well-known/mcp/server-card.json')}): 瀏覽器支援時提供搜尋與讀取公開內容的唯讀工具。`,
    '',
    '## Agent 使用說明',
    '',
    '- 優先讀取本檔、Agent 文章索引與 Agent 筆記索引，再選擇與任務相關的 Markdown 頁面。',
    '- 每個 Markdown 頁面的 frontmatter 都提供 canonical HTML 網址；對外引用請使用 canonical 網址。',
    '- 網站主要語言是繁體中文（zh-Hant）。',
    '- 不要把歷史 SEO 文章中的產品介面、政策或演算法描述當成未經查證的現況。',
    '',
  ];

  return lines.join('\n');
}

function apiItemForPage(page: AgentPage): AgentApiItem {
  const canonicalPath = stripConfiguredBase(page.canonicalUrl.pathname);
  const prefix = page.contentKind === 'note' ? '/notes/' : '/';
  const slug = canonicalPath
    .replace(new RegExp(`^${prefix}`), '')
    .replace(/\.html$/u, '');
  if (!slug || slug.includes('/') || slug.includes('\\')) {
    throw new Error(
      `Agent API cannot derive a safe slug from ${page.canonicalUrl.pathname}.`,
    );
  }

  return {
    canonicalUrl: page.canonicalUrl.toString(),
    description: page.description,
    kind: page.contentKind,
    markdownUrl: page.markdownUrl.toString(),
    publishedAt: page.publishedAt ?? null,
    slug,
    title: page.title,
    updatedAt: page.updatedAt ?? null,
  };
}

async function markdownForPage(page: AgentPage): Promise<string> {
  const markdownRelative = markdownPathForArtifact(page.relativeHtmlPath);
  return readFile(path.join(distRoot, ...markdownRelative.split('/')), 'utf8');
}

function apiCollectionDocument(
  kind: 'articles' | 'notes',
  items: AgentApiItem[],
): Record<string, unknown> {
  return {
    version: '1.0',
    kind,
    title: kind === 'articles' ? '數位引擎文章' : '數位引擎 Facebook 保存筆記',
    description:
      kind === 'articles'
        ? '數位引擎公開文章的 metadata 與 Markdown 入口。'
        : '數位引擎公開 Facebook 保存筆記的 metadata 與 Markdown 入口。',
    count: items.length,
    items,
  };
}

function apiItemSchema(): Record<string, unknown> {
  return {
    type: 'object',
    required: [
      'canonicalUrl',
      'description',
      'kind',
      'markdownUrl',
      'publishedAt',
      'slug',
      'title',
      'updatedAt',
    ],
    properties: {
      canonicalUrl: { type: 'string', format: 'uri' },
      description: { type: 'string' },
      kind: { type: 'string', enum: ['article', 'note'] },
      markdownUrl: { type: 'string', format: 'uri' },
      publishedAt: { type: ['string', 'null'], format: 'date-time' },
      slug: { type: 'string' },
      title: { type: 'string' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
    },
  };
}

function openApiDocument(): Record<string, unknown> {
  const itemSchema = apiItemSchema();
  const detailSchema = {
    allOf: [
      { $ref: '#/components/schemas/ContentItem' },
      {
        type: 'object',
        required: ['content'],
        properties: { content: { type: 'string' } },
      },
    ],
  };
  const collectionSchema = {
    type: 'object',
    required: ['version', 'kind', 'title', 'description', 'count', 'items'],
    properties: {
      version: { type: 'string' },
      kind: { type: 'string', enum: ['articles', 'notes'] },
      title: { type: 'string' },
      description: { type: 'string' },
      count: { type: 'integer' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/ContentItem' },
      },
    },
  };
  const slugParameter = {
    name: 'slug',
    in: 'path',
    required: true,
    description: 'The stable content slug published by the site.',
    schema: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$' },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: '數位引擎 public content API',
      version: '1.0.0',
      description:
        'Public, read-only API for the Traditional Chinese articles and Facebook notes published by 數位引擎.',
    },
    servers: [{ url: siteAssetUrl('/').toString() }],
    paths: {
      '/api/content.json': {
        get: {
          operationId: 'listContent',
          summary: 'List all public content metadata',
          description:
            'Returns article and note metadata without requiring authentication.',
          responses: {
            '200': {
              description: 'Public content metadata.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['version', 'count', 'items'],
                    properties: {
                      version: { type: 'string' },
                      count: { type: 'integer' },
                      items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ContentItem' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/articles.json': {
        get: {
          operationId: 'listArticles',
          summary: 'List public articles',
          description:
            'Returns metadata and Markdown links for all 86 articles.',
          responses: {
            '200': {
              description: 'Article collection.',
              content: {
                'application/json': { schema: collectionSchema },
              },
            },
          },
        },
      },
      '/api/articles/{slug}.json': {
        get: {
          operationId: 'getArticle',
          summary: 'Read one public article',
          parameters: [slugParameter],
          responses: {
            '200': {
              description: 'Article metadata and Markdown content.',
              content: {
                'application/json': { schema: detailSchema },
              },
            },
            '404': {
              description: 'Article slug was not found.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/notes.json': {
        get: {
          operationId: 'listNotes',
          summary: 'List public Facebook notes',
          description:
            'Returns metadata and Markdown links for published notes.',
          responses: {
            '200': {
              description: 'Note collection.',
              content: {
                'application/json': { schema: collectionSchema },
              },
            },
          },
        },
      },
      '/api/notes/{slug}.json': {
        get: {
          operationId: 'getNote',
          summary: 'Read one public Facebook note',
          parameters: [slugParameter],
          responses: {
            '200': {
              description: 'Note metadata and Markdown content.',
              content: {
                'application/json': { schema: detailSchema },
              },
            },
            '404': {
              description: 'Note slug was not found.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/mcp': {
        post: {
          operationId: 'mcpJsonRpc',
          summary: 'Call the public read-only MCP tools',
          description:
            'Accepts MCP JSON-RPC requests for initialize, tools/list, tools/call, and ping.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JsonRpcRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'MCP JSON-RPC response.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            '400': {
              description: 'Invalid JSON-RPC request.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ContentItem: itemSchema,
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: ['string', 'integer'] },
                message: { type: 'string' },
                hint: { type: 'string' },
              },
            },
          },
        },
        JsonRpcRequest: {
          type: 'object',
          required: ['jsonrpc', 'method'],
          properties: {
            jsonrpc: { const: '2.0' },
            id: { type: ['string', 'number', 'null'] },
            method: { type: 'string' },
            params: { type: 'object' },
          },
        },
      },
    },
  };
}

function authDocument(): string {
  return [
    '# Auth.md — Authentication guidance',
    '',
    '數位引擎目前是公開的靜態內容網站，不提供會員登入、付款、OAuth、API key 或代表使用者操作。',
    '## Agent registration',
    'Agent registration is not required for this public, read-only site. There is no register endpoint, OAuth issuer, token exchange, API key, credential, or revocation flow.',
    "Agent audience: autonomous and assisted agents that need to discover or read the site's public content.",
    'Registration/provisioning endpoint: none; registration is not required.',
    'Supported registration methods: direct unauthenticated HTTPS GET/HEAD, Markdown content negotiation, and read-only MCP POST requests.',
    'Credential use: none. Agents do not send tokens, API keys, identity assertions, or other credentials to the public endpoints.',
    'Agent 可以直接讀取公開 HTML、Markdown、RSS、JSON API 與 MCP endpoint；本站沒有需要先註冊、取得 token 或提交 agent identity 的受保護資源。',
    '所有公開文章與 Facebook 保存筆記都可以直接透過 HTML、Markdown、RSS、JSON API 或 MCP 的唯讀工具讀取。',
    '網站不會要求 agent 註冊帳號，也沒有需要 agent 代替使用者提交的表單、訂單、留言或帳戶設定。',
    `如果你要聯絡作者，請使用 [contact page](${siteAssetUrl('/contact.html')}) 上的公開 email，並不要傳送密碼、身分證件、付款資料或其他敏感資訊。`,
    'API 與 MCP endpoint 只會搜尋或回傳已公開的內容，並不提供寫入、刪除、付款、登入或權限提升功能。',
    '搜尋結果只包含網站已發布的文章與保存筆記 metadata，讀取工具則回傳對應的公開 Markdown 內容與 canonical 網址。',
    '請將文章中的歷史觀察、外部連結與第三方服務描述視為作者在特定日期的公開內容，涉及目前政策或產品行為時仍應查閱最新的一手來源。',
    '如未來新增需要保護的服務，會在此文件與對應的 OAuth discovery metadata 中說明註冊、授權範圍與 token 使用方式。',
    '',
  ].join('\n');
}

function ardCatalogDocument(): Record<string, unknown> {
  return {
    specVersion: '1.0',
    host: {
      displayName: '數位引擎',
      identifier: 'https://www.darrenhuang.com',
      documentationUrl: siteAssetUrl('/llms.txt').toString(),
    },
    entries: [
      {
        identifier: 'urn:air:www.darrenhuang.com:api:public-content',
        displayName: '數位引擎 public content API',
        type: 'application/json',
        url: siteAssetUrl('/api/content.json').toString(),
        description:
          '公開文章與 Facebook 保存筆記的 metadata，可用來發現可讀取的內容。',
        capabilities: ['read', 'searchable-content'],
        representativeQueries: [
          '找出數位行銷與 SEO 相關文章',
          '搜尋網站中關於 AI 與自動化的內容',
        ],
      },
      {
        identifier: 'urn:air:www.darrenhuang.com:api:openapi',
        displayName: '數位引擎 public content API OpenAPI',
        type: 'application/vnd.oai.openapi+json',
        url: siteAssetUrl('/openapi.json').toString(),
        description:
          '公開唯讀 JSON API 與 MCP JSON-RPC endpoint 的 OpenAPI 3.1 描述。',
        capabilities: ['read', 'api-description'],
        representativeQueries: [
          '如何列出數位引擎的公開內容',
          '如何讀取一篇數位引擎文章的 Markdown 內容',
        ],
      },
      {
        identifier: 'urn:air:www.darrenhuang.com:mcp:public-content',
        displayName: '數位引擎公開內容 MCP',
        type: 'application/mcp-server-card+json',
        url: siteAssetUrl('/.well-known/mcp/server-card.json').toString(),
        description:
          '不需要登入、只提供搜尋與讀取公開文章及保存筆記的 MCP server。',
        capabilities: ['read', 'search'],
        representativeQueries: [
          '用 MCP 搜尋數位引擎的公開內容',
          '用 MCP 讀取一篇指定的公開文章',
        ],
      },
      {
        identifier: 'urn:air:www.darrenhuang.com:skill:research-digital-engine',
        displayName: 'research-digital-engine',
        type: 'application/ai-skill+md',
        url: siteAssetUrl(
          '/.well-known/agent-skills/research-digital-engine/SKILL.md',
        ).toString(),
        description:
          '指引 agent 使用數位引擎公開索引、Markdown、API 與 MCP 的 read-only research skill。',
        capabilities: ['research', 'read'],
        representativeQueries: [
          '研究數位引擎網站中的 SEO 文章',
          '整理數位引擎關於內容策略的公開觀察',
        ],
      },
    ],
  };
}

function apiCatalogDocument(): Record<string, unknown> {
  const catalogUrl = siteAssetUrl('/.well-known/api-catalog').toString();
  return {
    linkset: [
      {
        anchor: catalogUrl,
        item: [
          {
            href: siteAssetUrl('/openapi.json').toString(),
            type: 'application/vnd.oai.openapi+json;version=3.1',
            title: '數位引擎 public content API OpenAPI specification',
          },
          {
            href: siteAssetUrl('/api/content.json').toString(),
            type: 'application/json',
            title: 'All public content metadata',
          },
          {
            href: siteAssetUrl('/api/articles.json').toString(),
            type: 'application/json',
            title: 'Public article collection',
          },
          {
            href: siteAssetUrl('/api/notes.json').toString(),
            type: 'application/json',
            title: 'Public Facebook note collection',
          },
          {
            href: siteAssetUrl('/mcp').toString(),
            type: 'application/json',
            title: 'Read-only MCP JSON-RPC endpoint',
          },
        ],
      },
    ],
  };
}

function mcpServerCardDocument(): Record<string, unknown> {
  const endpoint = configuredBase ? `${configuredBase}/mcp` : '/mcp';
  return {
    $schema:
      'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    protocolVersion: '2025-06-18',
    serverInfo: {
      name: 'darrenhuang-public-content',
      title: '數位引擎公開內容 MCP',
      version: '1.0.0',
    },
    description:
      '數位引擎的公開唯讀內容 MCP server，提供繁體中文文章與 Facebook 保存筆記的搜尋與讀取。',
    documentationUrl: siteAssetUrl('/llms.txt').toString(),
    transport: { type: 'streamable-http', endpoint },
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false },
    tools: [
      {
        name: 'search_content',
        title: 'Search 數位引擎 content',
        description: 'Search public Traditional Chinese articles and notes.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', minLength: 1, maxLength: 120 },
            limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        name: 'read_content',
        title: 'Read 數位引擎 content',
        description: 'Read one public article or Facebook note.',
        inputSchema: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['article', 'note'],
              default: 'article',
            },
            slug: { type: 'string', minLength: 1, maxLength: 160 },
          },
          required: ['slug'],
          additionalProperties: false,
        },
      },
    ],
  };
}

async function writeApiResources(
  articlePages: AgentPage[],
  notePages: AgentPage[],
): Promise<void> {
  const collections = [
    {
      kind: 'articles' as const,
      pages: articlePages,
    },
    {
      kind: 'notes' as const,
      pages: notePages,
    },
  ];
  const allItems: AgentApiItem[] = [];

  for (const collection of collections) {
    const items: AgentApiItem[] = [];
    for (const page of collection.pages) {
      const item = apiItemForPage(page);
      const content = await markdownForPage(page);
      items.push(item);
      allItems.push(item);
      await writeJsonArtifact(
        `api/${collection.kind}/${encodeURIComponent(item.slug)}.json`,
        { ...item, content },
      );
    }

    items.sort((left, right) =>
      (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''),
    );
    await writeJsonArtifact(
      `api/${collection.kind}.json`,
      apiCollectionDocument(collection.kind, items),
    );
  }

  allItems.sort((left, right) =>
    (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''),
  );
  await writeJsonArtifact('api/content.json', {
    version: '1.0',
    count: allItems.length,
    items: allItems,
  });
  const openApi = openApiDocument();
  await writeJsonArtifact('openapi.json', openApi);
  await writeJsonArtifact('api/openapi.json', openApi);
  await writeJsonArtifact('api/swagger.json', openApi);
  await writeJsonArtifact('.well-known/api-catalog', apiCatalogDocument());
  await writeJsonArtifact('.well-known/ai-catalog.json', ardCatalogDocument());
  await writeJsonArtifact(
    '.well-known/mcp/server-card.json',
    mcpServerCardDocument(),
  );
  await writeFile(path.join(distRoot, 'auth.md'), authDocument(), 'utf8');
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

function noteIndexDocument(notePages: AgentPage[]): string {
  const sorted = notePages.toSorted((left, right) =>
    (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''),
  );
  const lines = [
    '# 數位引擎 Facebook 保存筆記索引',
    '',
    `> 共 ${sorted.length} 篇繁體中文保存筆記，依原始發布日期由新到舊排列。`,
    '',
    '每個連結都指向精簡的 Markdown 版本。',
    '引用筆記時，請改用該 Markdown frontmatter 內的 canonical HTML 網址。',
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

  const articlePages = pages.filter(
    (page) => page.type === 'article' && page.contentKind === 'article',
  );
  const notePages = pages.filter(
    (page) => page.type === 'article' && page.contentKind === 'note',
  );
  if (articlePages.length !== expectedArticleCount) {
    throw new Error(
      `Expected ${expectedArticleCount} article Markdown pages, generated ${articlePages.length}.`,
    );
  }

  await writeFile(
    path.join(distRoot, 'llms.txt'),
    llmsDocument(pages, articlePages.length, notePages.length),
    'utf8',
  );
  await writeFile(
    path.join(distRoot, 'articles-llms.txt'),
    articleIndexDocument(articlePages),
    'utf8',
  );
  await writeFile(
    path.join(distRoot, 'notes-llms.txt'),
    noteIndexDocument(notePages),
    'utf8',
  );
  await writeApiResources(articlePages, notePages);
  await writeSkillIndex();

  console.log(
    `[agent-content] PASS: generated ${pages.length} Markdown pages, ${articlePages.length} article entries, ${notePages.length} note entries, llms.txt, API resources, MCP discovery, and one verified skill index.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[agent-content] FAILED: ${message}`);
  process.exitCode = 1;
});
