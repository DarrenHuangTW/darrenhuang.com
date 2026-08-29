import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { load } from 'cheerio';
import matter from 'gray-matter';
import { PRODUCTION_SITE_URL, productionSiteUrl } from '../../site.config';
import {
  isProductionTrackingTarget,
  PUBLIC_TRACKING_CONFIG,
} from '../../src/lib/tracking';

type UnknownRecord = Record<string, unknown>;

interface CanonicalEntry {
  canonicalPath: string;
  kind: string;
  label: string;
}

interface AliasEntry extends CanonicalEntry {
  aliasPath: string;
}

const root = process.cwd();
const distRoot = path.join(root, 'dist');
const manifestPath = path.join(root, 'migration', 'manifest.json');
const failures: string[] = [];
const warnings: string[] = [];
const mebibyte = 1024 * 1024;
const warningSize = 750 * mebibyte;
const failureSize = 900 * mebibyte;
const pagesLimit = 1024 * mebibyte;
const configuredBase = normalizeBase(process.env.BASE_PATH ?? '/');
const configuredSite = process.env.SITE_URL ?? PRODUCTION_SITE_URL;
const knownHosts = new Set([
  'local.invalid',
  '127.0.0.1',
  'localhost',
  'darrenhuang.com',
  'member.darrenhuang.com',
  'www.darrenhuang.com',
  'darrenhuangtw.github.io',
]);
let configuredSiteUrl: URL | undefined;

try {
  const parsed = new URL(configuredSite);
  knownHosts.add(parsed.hostname.toLowerCase());
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    failures.push(`SITE_URL 必須是純 HTTPS origin：${configuredSite}`);
  } else {
    configuredSiteUrl = parsed;
  }
} catch {
  failures.push(`SITE_URL 不是有效 URL：${configuredSite}`);
}

function normalizeBase(value: string): string {
  const normalized = `/${value.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '' : normalized;
}

function check(condition: unknown, message: string): condition is true {
  if (!condition) {
    failures.push(message);
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
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

function artifactRelative(file: string): string {
  return path.relative(distRoot, file).replaceAll('\\', '/');
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

  return pathname || '/';
}

function safeDecodePathname(pathname: string): string | undefined {
  try {
    return decodeURIComponent(pathname);
  } catch {
    failures.push(`URL path 無法 decode：${pathname}`);
    return undefined;
  }
}

function outputCandidates(pathname: string): string[] {
  const decoded = safeDecodePathname(pathname);
  if (decoded === undefined || decoded.includes('\0')) {
    return [];
  }

  const withoutBase = stripConfiguredBase(decoded);
  const relative = withoutBase.replace(/^\/+/, '');
  const normalized = path.posix.normalize(relative || '.');

  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    failures.push(`站內 URL 離開 artifact 根目錄：${pathname}`);
    return [];
  }

  if (normalized === '.') {
    return ['index.html'];
  }

  const clean = normalized.replace(/\/$/, '');
  const candidates = new Set<string>([clean]);
  const extension = path.posix.extname(clean);

  if (!extension) {
    candidates.add(`${clean}.html`);
    candidates.add(`${clean}/index.html`);
  }

  return [...candidates];
}

function findOutput(
  pathname: string,
  artifactPaths: Set<string>,
): string | undefined {
  return outputCandidates(pathname).find((candidate) =>
    artifactPaths.has(candidate),
  );
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

function withConfiguredBase(pathname: string): string {
  const normalized = `/${pathname.replace(/^\/+/, '')}`;
  return configuredBase ? `${configuredBase}${normalized}` : normalized;
}

function expectedConfiguredUrl(pathname: string): string | undefined {
  if (!configuredSiteUrl) {
    return undefined;
  }

  const url = new URL(configuredSiteUrl.origin);
  url.pathname = withConfiguredBase(pathname);
  return url.toString();
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

function absoluteUrl(value: string, label: string): URL | undefined {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      failures.push(`${label} 不是 HTTP(S) URL：${value}`);
      return undefined;
    }
    return parsed;
  } catch {
    failures.push(`${label} 不是絕對 URL：${value}`);
    return undefined;
  }
}

function configuredAbsolutePathname(
  value: string,
  label: string,
): string | undefined {
  const parsed = absoluteUrl(value, label);
  if (!parsed || !configuredSiteUrl) {
    return undefined;
  }

  if (parsed.origin !== configuredSiteUrl.origin) {
    failures.push(
      `${label} 的 origin 必須是 ${configuredSiteUrl.origin}：${value}`,
    );
    return undefined;
  }

  if (
    configuredBase &&
    parsed.pathname !== configuredBase &&
    parsed.pathname !== `${configuredBase}/` &&
    !parsed.pathname.startsWith(`${configuredBase}/`)
  ) {
    failures.push(`${label} 未包含 BASE_PATH ${configuredBase}：${value}`);
    return undefined;
  }

  return stripConfiguredBase(parsed.pathname);
}

function isRootRelativeWithoutBase(reference: string): boolean {
  if (
    !configuredBase ||
    !reference.startsWith('/') ||
    reference.startsWith('//')
  ) {
    return false;
  }

  return (
    reference !== configuredBase && !reference.startsWith(`${configuredBase}/`)
  );
}

function referencePathname(
  reference: string,
  currentServedPath: string,
): string | undefined {
  const trimmed = reference.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    /^(?:data|mailto|tel|javascript|blob):/i.test(trimmed)
  ) {
    return undefined;
  }

  let parsed: URL;
  try {
    const current = withConfiguredBase(currentServedPath);
    parsed = new URL(trimmed, `https://local.invalid${current}`);
  } catch {
    failures.push(`無法解析 URL：${reference}`);
    return undefined;
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !knownHosts.has(parsed.hostname.toLowerCase())
  ) {
    return undefined;
  }

  return stripConfiguredBase(parsed.pathname);
}

function collectCanonicalEntries(manifest: UnknownRecord): CanonicalEntry[] {
  const result: CanonicalEntry[] = [];

  for (const kind of ['posts', 'pages', 'stories']) {
    const entries = manifest[kind];
    if (!Array.isArray(entries)) {
      failures.push(`manifest.${kind} 必須是陣列。`);
      continue;
    }

    entries.forEach((value, index) => {
      if (!isRecord(value)) {
        failures.push(`manifest.${kind}[${index}] 不是 object。`);
        return;
      }

      if (kind === 'pages' && stringValue(value, 'decision') !== 'publish') {
        return;
      }

      const canonicalPath = stringValue(value, 'canonicalPath');
      const label = stringValue(value, 'slug') ?? `${kind}[${index}]`;
      if (!canonicalPath?.startsWith('/')) {
        failures.push(`manifest.${kind}[${index}].canonicalPath 無效。`);
        return;
      }

      result.push({ canonicalPath, kind, label });
    });
  }

  return result;
}

function collectAliases(manifest: UnknownRecord): AliasEntry[] {
  const aliases = new Map<string, AliasEntry>();

  for (const kind of ['posts', 'pages', 'stories']) {
    const entries = manifest[kind];
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const value of entries) {
      if (!isRecord(value) || !Array.isArray(value.aliases)) {
        continue;
      }

      if (kind === 'pages' && stringValue(value, 'decision') !== 'publish') {
        continue;
      }

      const canonicalPath = stringValue(value, 'canonicalPath');
      const label = stringValue(value, 'slug') ?? kind;
      if (!canonicalPath?.startsWith('/')) {
        continue;
      }

      for (const alias of value.aliases) {
        if (typeof alias !== 'string') {
          failures.push(`manifest.${kind} 含有非字串 alias。`);
          continue;
        }

        const pathname = referencePathname(alias, '/');
        if (pathname) {
          aliases.set(pathname, {
            aliasPath: pathname,
            canonicalPath,
            kind,
            label,
          });
        }
      }
    }
  }

  return [...aliases.values()];
}

function processReference(
  reference: string,
  currentServedPath: string,
  sourceFile: string,
  artifactPaths: Set<string>,
): void {
  if (isRootRelativeWithoutBase(reference)) {
    failures.push(
      `${sourceFile} 的 root-relative URL 未包含 BASE_PATH：${reference}`,
    );
  }

  const pathname = referencePathname(reference, currentServedPath);
  if (pathname === undefined) {
    return;
  }

  if (!findOutput(pathname, artifactPaths)) {
    failures.push(`${sourceFile} 連到不存在的站內資源：${reference}`);
  }
}

async function verifyHtmlReferences(
  htmlFiles: string[],
  artifactPaths: Set<string>,
): Promise<void> {
  let responsivePictureCount = 0;

  for (const file of htmlFiles) {
    const relative = artifactRelative(file);
    const currentServedPath = servedPathForArtifact(relative);
    const $ = load(await readFile(file, 'utf8'));
    const selectors: Array<[string, string]> = [
      ['a[href]', 'href'],
      ['amp-audio[src]', 'src'],
      ['amp-img[src]', 'src'],
      ['amp-story[background-audio]', 'background-audio'],
      ['amp-story[entity-logo-src]', 'entity-logo-src'],
      ['amp-story[poster-landscape-src]', 'poster-landscape-src'],
      ['amp-story[poster-portrait-src]', 'poster-portrait-src'],
      ['amp-story[poster-square-src]', 'poster-square-src'],
      ['amp-story[publisher-logo-src]', 'publisher-logo-src'],
      ['amp-story-page[background-audio]', 'background-audio'],
      ['amp-video[artwork]', 'artwork'],
      ['amp-video[poster]', 'poster'],
      ['amp-video[src]', 'src'],
      ['area[href]', 'href'],
      ['audio[src]', 'src'],
      ['[data-tooltip-icon]', 'data-tooltip-icon'],
      ['form[action]', 'action'],
      ['iframe[src]', 'src'],
      ['img[src]', 'src'],
      ['link[href]', 'href'],
      ['script[src]', 'src'],
      ['source[src]', 'src'],
      ['track[src]', 'src'],
      ['video[poster]', 'poster'],
      ['video[src]', 'src'],
    ];

    for (const [selector, attribute] of selectors) {
      $(selector).each((_index, element) => {
        const reference = $(element).attr(attribute);
        if (reference) {
          processReference(
            reference,
            currentServedPath,
            relative,
            artifactPaths,
          );
        }
      });
    }

    $('[srcset]').each((_index, element) => {
      const sourceSet = $(element).attr('srcset');
      if (!sourceSet || sourceSet.trimStart().startsWith('data:')) {
        return;
      }

      for (const candidate of sourceSet.split(',')) {
        const reference = candidate.trim().split(/\s+/, 1)[0];
        if (reference) {
          processReference(
            reference,
            currentServedPath,
            relative,
            artifactPaths,
          );
        }
      }
    });

    $('main img[width], main img[height]').each((_index, element) => {
      const image = $(element);
      for (const attribute of ['height', 'width'] as const) {
        const raw = image.attr(attribute);
        if (raw !== undefined && !(Number(raw) > 0)) {
          failures.push(
            `${relative} 含有無效的圖片 ${attribute}：${raw || '(empty)'}`,
          );
        }
      }
    });

    $('picture[data-responsive-image="true"]').each((_index, element) => {
      responsivePictureCount += 1;
      const picture = $(element);
      const image = picture.children('img[src]');
      const sources = picture.children('source[srcset]');
      if (image.length !== 1 || sources.length === 0) {
        failures.push(`${relative} 含有不完整的 responsive <picture>。`);
        return;
      }

      if (!image.attr('sizes') || image.attr('src')?.includes('/_optimized/')) {
        failures.push(
          `${relative} 的 responsive <picture> 未保留原圖 fallback 或 sizes。`,
        );
      }
      sources.each((_sourceIndex, source) => {
        if (!$(source).attr('sizes')) {
          failures.push(`${relative} 的 responsive <source> 缺少 sizes。`);
        }
      });
    });

    $('meta[http-equiv]').each((_index, element) => {
      if ($(element).attr('http-equiv')?.toLowerCase() !== 'refresh') {
        return;
      }

      const content = $(element).attr('content') ?? '';
      const match = /(?:^|;)\s*url\s*=\s*['"]?([^'";]+)/i.exec(content);
      if (match?.[1]) {
        processReference(match[1], currentServedPath, relative, artifactPaths);
      }
    });
  }

  check(
    responsivePictureCount > 0,
    'Dist 至少需要一個建置期產生的 responsive <picture>。',
  );
}

async function verifyTracking(htmlFiles: string[]): Promise<void> {
  const trackingExpected = isProductionTrackingTarget(
    configuredSiteUrl,
    true,
    configuredBase,
  );
  const expectedContainerId =
    PUBLIC_TRACKING_CONFIG.googleTagManagerContainerId;
  let astroPageCount = 0;

  for (const file of htmlFiles) {
    const relative = artifactRelative(file);
    const source = await readFile(file, 'utf8');
    const $ = load(source);
    const generator = $('meta[name="generator"]').attr('content') ?? '';
    const isAstroPage = generator.startsWith('Astro');
    const headTags = $('head > script[data-site-tracking="gtm"]');
    const activeTrackingSurface = $('script, noscript, amp-analytics')
      .map((_index, element) => $(element).toString())
      .get()
      .join('\n');
    const containerIds =
      activeTrackingSurface.match(/\bGTM-[A-Z0-9]+\b/gu) ?? [];
    const gtmLoaderCount = (
      activeTrackingSurface.match(
        /www\.googletagmanager\.com\/gtm\.js\?id=/gu,
      ) ?? []
    ).length;
    const gtmNoscriptCount = (
      activeTrackingSurface.match(
        /www\.googletagmanager\.com\/ns\.html\?id=/gu,
      ) ?? []
    ).length;

    if (isAstroPage) {
      astroPageCount += 1;
    }

    check(
      !activeTrackingSurface.includes(
        PUBLIC_TRACKING_CONFIG.googleAnalyticsMeasurementId,
      ),
      `${relative} 不得直接安裝 GA4；GA4 必須只由 GTM 管理。`,
    );
    check(
      !activeTrackingSurface.includes(
        PUBLIC_TRACKING_CONFIG.microsoftClarityProjectId,
      ) && !activeTrackingSurface.includes('clarity.ms/tag'),
      `${relative} 不得直接安裝 Clarity；Clarity 必須只由 GTM 管理。`,
    );
    check(
      !/\bUA-\d+-\d+\b/u.test(activeTrackingSurface),
      `${relative} 不得包含 Universal Analytics tag。`,
    );
    check(
      !activeTrackingSurface.includes('googletagmanager.com/gtag/js'),
      `${relative} 不得直接載入 gtag.js。`,
    );

    if (trackingExpected && isAstroPage) {
      check(
        headTags.length === 1,
        `${relative} 必須在 head 內包含且只包含一組 GTM bootstrap。`,
      );
      check(
        gtmNoscriptCount === 0,
        `${relative} 不得包含會繞過 runtime origin guard 的 GTM noscript。`,
      );
      check(
        headTags.text().includes('googletagmanager.com/gtm.js?id=') &&
          headTags
            .text()
            .includes(`window.location.origin==="${PRODUCTION_SITE_URL}"`),
        `${relative} 的 GTM bootstrap 缺少正式 origin 防護。`,
      );
      check(gtmLoaderCount === 1, `${relative} 必須且只能載入一次 gtm.js。`);
      check(
        containerIds.length === 1 && containerIds[0] === expectedContainerId,
        `${relative} 必須只包含 GTM container ${expectedContainerId}。`,
      );
    } else {
      check(
        headTags.length === 0 &&
          containerIds.length === 0 &&
          gtmLoaderCount === 0 &&
          gtmNoscriptCount === 0,
        `${relative} 不得在預覽或非 Astro fallback 輸出追蹤碼。`,
      );
    }
  }

  check(astroPageCount > 0, 'Dist 沒有可驗證的 Astro HTML 頁面。');
}

async function verifyCssReferences(
  cssFiles: string[],
  artifactPaths: Set<string>,
): Promise<void> {
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

  for (const file of cssFiles) {
    const relative = artifactRelative(file);
    const currentServedPath = `/${relative}`;
    const source = await readFile(file, 'utf8');
    let match: RegExpExecArray | null;

    while ((match = urlPattern.exec(source)) !== null) {
      const reference = match[2];
      if (reference) {
        processReference(reference, currentServedPath, relative, artifactPaths);
      }
    }
  }
}

function locationsFromXml(source: string): string[] {
  return [
    ...source.matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gis),
  ]
    .map((match) => match[1]?.replaceAll('&amp;', '&').trim())
    .filter((value): value is string => Boolean(value));
}

function normalizedLocation(value: string): string | undefined {
  const pathname = referencePathname(value, '/');
  if (!pathname) {
    return undefined;
  }

  return pathname.endsWith('/') && pathname !== '/'
    ? pathname
    : pathname.replace(/\/$/, '') || '/';
}

async function verifySitemap(
  canonicalEntries: CanonicalEntry[],
  artifactFiles: string[],
  artifactPaths: Set<string>,
): Promise<void> {
  check(
    artifactPaths.has('sitemap-index.xml'),
    '缺少 dist/sitemap-index.xml。',
  );
  const sitemapFiles = artifactFiles.filter(
    (file) =>
      /^sitemap(?:-|\.)/i.test(artifactRelative(file)) && file.endsWith('.xml'),
  );
  check(
    sitemapFiles.length >= 2,
    'Sitemap 應包含 index 與至少一個內容 sitemap。',
  );

  const sitemapLocations = new Set<string>();
  for (const file of sitemapFiles) {
    const source = await readFile(file, 'utf8');
    for (const location of locationsFromXml(source)) {
      const locationPath = configuredAbsolutePathname(
        location,
        `${artifactRelative(file)} <loc>`,
      );
      const pathname = locationPath
        ? normalizedLocation(locationPath)
        : undefined;
      if (pathname) {
        sitemapLocations.add(pathname);
      }

      if (locationPath?.endsWith('.xml')) {
        check(
          Boolean(findOutput(locationPath, artifactPaths)),
          `Sitemap index 指向不存在的檔案：${location}`,
        );
      }
    }
  }

  for (const entry of canonicalEntries) {
    const expected = normalizedLocation(entry.canonicalPath);
    check(
      Boolean(expected && sitemapLocations.has(expected)),
      `Sitemap 缺少 canonical URL：${entry.canonicalPath}`,
    );
  }
}

async function verifyRss(
  manifest: UnknownRecord,
  artifactPaths: Set<string>,
): Promise<void> {
  if (!check(artifactPaths.has('rss.xml'), '缺少 dist/rss.xml。')) {
    return;
  }

  const source = await readFile(path.join(distRoot, 'rss.xml'), 'utf8');
  check(
    /<rss\b/i.test(source) && /<channel\b/i.test(source),
    'dist/rss.xml 不是有效的 RSS channel。',
  );
  const itemCount = (source.match(/<item\b/gi) ?? []).length;
  const publishedNoteCount = [...artifactPaths].filter((relative) =>
    /^notes\/[^/]+\.html$/u.test(relative),
  ).length;
  const expectedItemCount = 86 + publishedNoteCount;
  check(
    itemCount === expectedItemCount,
    `RSS 應包含 ${expectedItemCount} 個 items，實際為 ${itemCount}。`,
  );

  const rssPaths = new Set<string>();
  const rssLinks = [
    ...source.matchAll(
      /<link>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/link>/gis,
    ),
  ]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  for (const link of rssLinks) {
    const pathname = configuredAbsolutePathname(link, 'RSS <link>');
    const normalized = pathname ? normalizedLocation(pathname) : undefined;
    if (normalized) {
      rssPaths.add(normalized);
    }
  }

  const posts = manifest.posts;
  if (Array.isArray(posts)) {
    for (const value of posts) {
      if (!isRecord(value)) {
        continue;
      }

      const canonicalPath = stringValue(value, 'canonicalPath');
      const expected = canonicalPath
        ? normalizedLocation(canonicalPath)
        : undefined;
      check(
        Boolean(expected && rssPaths.has(expected)),
        `RSS 缺少文章：${canonicalPath ?? '(canonicalPath missing)'}`,
      );
    }
  }

  for (const relative of artifactPaths) {
    if (!/^notes\/[^/]+\.html$/u.test(relative)) {
      continue;
    }

    const source = await readFile(
      path.join(distRoot, ...relative.split('/')),
      'utf8',
    );
    const $ = load(source);
    const robots = $('meta[name="robots"]').attr('content')?.toLowerCase();
    if (robots?.includes('noindex')) {
      continue;
    }

    const canonicalPath = `/${relative}`;
    const expected = normalizedLocation(canonicalPath);
    check(
      Boolean(expected && rssPaths.has(expected)),
      `RSS 缺少筆記：${canonicalPath}`,
    );
  }
}

async function verifyCanonicalFiles(
  entries: CanonicalEntry[],
  artifactPaths: Set<string>,
): Promise<void> {
  for (const entry of entries) {
    const output = findOutput(entry.canonicalPath, artifactPaths);
    if (
      !check(
        Boolean(output),
        `${entry.kind} ${entry.label} 缺少 canonical 實體輸出：${entry.canonicalPath}`,
      ) ||
      !output
    ) {
      continue;
    }

    if (!output.endsWith('.html')) {
      failures.push(
        `${entry.kind} ${entry.label} 的 canonical 輸出不是 HTML：${output}`,
      );
      continue;
    }

    const $ = load(
      await readFile(path.join(distRoot, ...output.split('/')), 'utf8'),
    );
    const canonicalHref = $('link[rel="canonical"]').attr('href');
    const markdownHref = $('link[rel="alternate"][type="text/markdown"]').attr(
      'href',
    );
    const actual = canonicalHref
      ? absoluteUrl(canonicalHref, `${output} rel=canonical`)?.toString()
      : undefined;
    const expected = expectedConfiguredUrl(entry.canonicalPath);
    const expectedMarkdown = expectedConfiguredUrl(
      markdownPathForCanonical(entry.canonicalPath),
    );
    const actualMarkdown = markdownHref
      ? absoluteUrl(
          markdownHref,
          `${output} rel=alternate type=text/markdown`,
        )?.toString()
      : undefined;
    check(Boolean(canonicalHref), `${output} 缺少 rel=canonical。`);
    check(
      Boolean(actual && expected && actual === expected),
      `${output} 的 canonical 必須是 ${expected ?? '(invalid SITE_URL)'}。`,
    );
    check(
      Boolean(actualMarkdown && actualMarkdown === expectedMarkdown),
      `${output} 的 Markdown alternate 必須是 ${expectedMarkdown ?? '(invalid SITE_URL)'}。`,
    );
    check(
      Boolean(
        findOutput(
          markdownPathForCanonical(entry.canonicalPath),
          artifactPaths,
        ),
      ),
      `${output} 缺少對應的 Markdown 實體輸出。`,
    );
  }
}

async function verifyAgentResources(
  canonicalEntries: CanonicalEntry[],
  artifactPaths: Set<string>,
): Promise<void> {
  const required = [
    '.nojekyll',
    'articles-llms.txt',
    'notes-llms.txt',
    'articles.md',
    'index.md',
    'llms.txt',
    'auth.md',
    'openapi.json',
    'api/openapi.json',
    'api/swagger.json',
    'api/content.json',
    'api/articles.json',
    'api/notes.json',
    '.well-known/api-catalog',
    '.well-known/ai-catalog.json',
    '.well-known/agent-skills/index.json',
    '.well-known/agent-skills/research-digital-engine/SKILL.md',
    '.well-known/mcp/server-card.json',
  ];
  for (const relative of required) {
    check(artifactPaths.has(relative), `缺少 agent resource：${relative}。`);
  }

  if (
    !artifactPaths.has('llms.txt') ||
    !artifactPaths.has('articles-llms.txt') ||
    !artifactPaths.has('notes-llms.txt')
  ) {
    return;
  }

  const llms = await readFile(path.join(distRoot, 'llms.txt'), 'utf8');
  const articleIndex = await readFile(
    path.join(distRoot, 'articles-llms.txt'),
    'utf8',
  );
  const noteIndex = await readFile(
    path.join(distRoot, 'notes-llms.txt'),
    'utf8',
  );
  check(llms.startsWith('# 數位引擎\n'), 'llms.txt 缺少網站標題。');
  check(
    llms.includes(expectedConfiguredUrl('/articles-llms.txt') ?? ''),
    'llms.txt 缺少 Agent 文章索引的正式 URL。',
  );
  check(
    llms.includes(expectedConfiguredUrl('/notes-llms.txt') ?? ''),
    'llms.txt 缺少 Agent 筆記索引的正式 URL。',
  );
  check(
    articleIndex.startsWith('# 數位引擎文章索引\n'),
    'articles-llms.txt 缺少文章索引標題。',
  );
  check(
    noteIndex.startsWith('# 數位引擎 Facebook 保存筆記索引\n'),
    'notes-llms.txt 缺少筆記索引標題。',
  );

  const posts = canonicalEntries.filter((entry) => entry.kind === 'posts');
  for (const post of posts) {
    const markdownPath = markdownPathForCanonical(post.canonicalPath);
    const markdownOutput = findOutput(markdownPath, artifactPaths);
    if (!check(Boolean(markdownOutput), `文章缺少 Markdown：${markdownPath}`)) {
      continue;
    }

    const expectedCanonical = expectedConfiguredUrl(post.canonicalPath);
    const expectedMarkdown = expectedConfiguredUrl(markdownPath);
    const source = await readFile(
      path.join(distRoot, ...(markdownOutput as string).split('/')),
      'utf8',
    );
    const parsed = matter(source);
    check(
      parsed.data.canonical === expectedCanonical,
      `${markdownOutput} frontmatter canonical 必須是 ${expectedCanonical}。`,
    );
    check(
      parsed.data.markdown === expectedMarkdown,
      `${markdownOutput} frontmatter markdown 必須是 ${expectedMarkdown}。`,
    );
    check(
      parsed.data.language === 'zh-Hant',
      `${markdownOutput} 必須宣告 language: zh-Hant。`,
    );
    check(
      parsed.content.trim().length > 150,
      `${markdownOutput} 的 agent-readable 內容過短。`,
    );
    check(
      Boolean(expectedMarkdown && articleIndex.includes(expectedMarkdown)),
      `articles-llms.txt 缺少 ${expectedMarkdown ?? markdownPath}。`,
    );
  }

  const noteHtmlPaths = [...artifactPaths].filter((relative) =>
    /^notes\/[^/]+\.html$/u.test(relative),
  );
  for (const relative of noteHtmlPaths) {
    const htmlSource = await readFile(
      path.join(distRoot, ...relative.split('/')),
      'utf8',
    );
    const $ = load(htmlSource);
    const robots =
      $('meta[name="robots"]').attr('content')?.toLowerCase() ?? '';
    if (robots.includes('noindex')) {
      continue;
    }

    const canonicalPath = `/${relative}`;
    const markdownPath = canonicalPath.replace(/\.html$/u, '.md');
    const markdownOutput = findOutput(markdownPath, artifactPaths);
    if (!check(Boolean(markdownOutput), `筆記缺少 Markdown：${markdownPath}`)) {
      continue;
    }

    const expectedMarkdown = expectedConfiguredUrl(markdownPath);
    check(
      Boolean(expectedMarkdown && noteIndex.includes(expectedMarkdown)),
      `notes-llms.txt 缺少 ${expectedMarkdown ?? markdownPath}。`,
    );
  }

  const indexRelative = '.well-known/agent-skills/index.json';
  if (!artifactPaths.has(indexRelative)) {
    return;
  }

  const indexSource = await readFile(
    path.join(distRoot, ...indexRelative.split('/')),
    'utf8',
  );
  let index: unknown;
  try {
    index = JSON.parse(indexSource);
  } catch {
    failures.push(`${indexRelative} 不是有效 JSON。`);
    return;
  }

  if (!isRecord(index)) {
    failures.push(`${indexRelative} 根節點必須是 object。`);
    return;
  }

  check(
    index.$schema ===
      'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    `${indexRelative} 使用非預期的 schema。`,
  );
  if (
    !check(
      Array.isArray(index.skills) && index.skills.length === 1,
      `${indexRelative} 必須精確列出一個真實 skill。`,
    ) ||
    !Array.isArray(index.skills)
  ) {
    return;
  }

  const skill = index.skills[0];
  if (!isRecord(skill)) {
    failures.push(`${indexRelative} skills[0] 必須是 object。`);
    return;
  }

  const skillName = stringValue(skill, 'name');
  const skillDescription = stringValue(skill, 'description');
  const skillUrl = stringValue(skill, 'url');
  const skillDigest = stringValue(skill, 'digest');
  check(
    skillName === 'research-digital-engine',
    `${indexRelative} skill name 無效。`,
  );
  check(skill.type === 'skill-md', `${indexRelative} skill type 無效。`);
  if (!skillUrl) {
    failures.push(`${indexRelative} skill URL 缺失。`);
    return;
  }

  const indexUrl = expectedConfiguredUrl(
    '/.well-known/agent-skills/index.json',
  );
  const resolvedSkillUrl = indexUrl ? new URL(skillUrl, indexUrl) : undefined;
  const skillPathname = resolvedSkillUrl
    ? configuredAbsolutePathname(
        resolvedSkillUrl.toString(),
        `${indexRelative} skill URL`,
      )
    : undefined;
  const skillOutput = skillPathname
    ? findOutput(skillPathname, artifactPaths)
    : undefined;
  if (!check(Boolean(skillOutput), `${indexRelative} 指向不存在的 skill。`)) {
    return;
  }

  const skillBytes = await readFile(
    path.join(distRoot, ...(skillOutput as string).split('/')),
  );
  const expectedDigest = `sha256:${createHash('sha256').update(skillBytes).digest('hex')}`;
  check(
    skillDigest === expectedDigest,
    `${indexRelative} skill digest 與 artifact 不符。`,
  );
  const parsedSkill = matter(skillBytes.toString('utf8'));
  check(
    parsedSkill.data.name === skillName,
    `${skillOutput} frontmatter name 與 index 不符。`,
  );
  check(
    parsedSkill.data.description === skillDescription,
    `${skillOutput} frontmatter description 與 index 不符。`,
  );
}

async function readJsonResource(
  relative: string,
  artifactPaths: Set<string>,
): Promise<UnknownRecord | undefined> {
  if (!artifactPaths.has(relative)) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(
      await readFile(path.join(distRoot, ...relative.split('/')), 'utf8'),
    );
    if (!isRecord(parsed)) {
      failures.push(`${relative} 根節點必須是 object。`);
      return undefined;
    }
    return parsed;
  } catch {
    failures.push(`${relative} 不是有效 JSON。`);
    return undefined;
  }
}

async function verifyPublicAgentResources(
  artifactPaths: Set<string>,
  canonicalEntries: CanonicalEntry[],
): Promise<void> {
  const openapi = await readJsonResource('openapi.json', artifactPaths);
  const content = await readJsonResource('api/content.json', artifactPaths);
  const articles = await readJsonResource('api/articles.json', artifactPaths);
  const notes = await readJsonResource('api/notes.json', artifactPaths);
  const catalog = await readJsonResource(
    '.well-known/api-catalog',
    artifactPaths,
  );
  const ardCatalog = await readJsonResource(
    '.well-known/ai-catalog.json',
    artifactPaths,
  );
  const serverCard = await readJsonResource(
    '.well-known/mcp/server-card.json',
    artifactPaths,
  );

  const articleCount = canonicalEntries.filter(
    (entry) => entry.kind === 'posts',
  ).length;
  if (articles) {
    const articleItems = articles.items;
    check(Array.isArray(articleItems), 'api/articles.json 缺少 items array。');
    check(articles.kind === 'articles', 'api/articles.json kind 無效。');
    check(
      articles.count === articleCount,
      `api/articles.json 必須列出 ${articleCount} 篇文章。`,
    );
    if (Array.isArray(articleItems)) {
      check(
        articleItems.every(
          (item) =>
            isRecord(item) &&
            item.kind === 'article' &&
            typeof item.slug === 'string' &&
            typeof item.title === 'string' &&
            typeof item.canonicalUrl === 'string' &&
            typeof item.markdownUrl === 'string',
        ),
        'api/articles.json 含有不完整的 content item。',
      );
      check(
        [...artifactPaths].filter((relative) =>
          /^api\/articles\/[^/]+\.json$/u.test(relative),
        ).length === articleItems.length,
        'api/articles.json 與文章 detail artifacts 數量不一致。',
      );
    }
  }

  if (notes) {
    const noteItems = notes.items;
    check(Array.isArray(noteItems), 'api/notes.json 缺少 items array。');
    check(notes.kind === 'notes', 'api/notes.json kind 無效。');
    if (Array.isArray(noteItems)) {
      check(
        noteItems.every(
          (item) =>
            isRecord(item) &&
            item.kind === 'note' &&
            typeof item.slug === 'string' &&
            typeof item.title === 'string' &&
            typeof item.canonicalUrl === 'string' &&
            typeof item.markdownUrl === 'string',
        ),
        'api/notes.json 含有不完整的 content item。',
      );
      check(
        [...artifactPaths].filter((relative) =>
          /^api\/notes\/[^/]+\.json$/u.test(relative),
        ).length === noteItems.length,
        'api/notes.json 與筆記 detail artifacts 數量不一致。',
      );
    }
  }

  if (content) {
    const contentItems = content.items;
    check(Array.isArray(contentItems), 'api/content.json 缺少 items array。');
    if (Array.isArray(contentItems)) {
      check(
        content.count === contentItems.length,
        'api/content.json count 不符。',
      );
      check(
        contentItems.every(
          (item) =>
            isRecord(item) &&
            (item.kind === 'article' || item.kind === 'note') &&
            typeof item.slug === 'string',
        ),
        'api/content.json 含有不完整的 content item。',
      );
    }
  }

  if (openapi) {
    check(openapi.openapi === '3.1.0', 'openapi.json 必須使用 OpenAPI 3.1。');
    const paths = openapi.paths;
    check(isRecord(paths), 'openapi.json 缺少 paths object。');
    for (const requiredPath of [
      '/api/content.json',
      '/api/articles.json',
      '/api/articles/{slug}.json',
      '/api/notes.json',
      '/api/notes/{slug}.json',
      '/mcp',
    ]) {
      check(
        isRecord(paths) && requiredPath in paths,
        `openapi.json 缺少 ${requiredPath}。`,
      );
    }
    const expectedServer = expectedConfiguredUrl('/');
    const servers = openapi.servers;
    check(
      Array.isArray(servers) &&
        servers.some(
          (server) => isRecord(server) && server.url === expectedServer,
        ),
      `openapi.json 缺少正式 server URL ${expectedServer ?? '(invalid SITE_URL)'}。`,
    );
  }

  if (catalog) {
    const linksets = catalog.linkset;
    check(
      Array.isArray(linksets) && linksets.length > 0,
      'API Catalog 缺少 linkset。',
    );
    const catalogItems = Array.isArray(linksets)
      ? linksets.flatMap((linkset) =>
          isRecord(linkset) && Array.isArray(linkset.item) ? linkset.item : [],
        )
      : [];
    const openapiUrl = expectedConfiguredUrl('/openapi.json');
    check(
      catalogItems.some((item) => isRecord(item) && item.href === openapiUrl),
      'API Catalog 缺少 OpenAPI href。',
    );
    check(
      catalogItems.some(
        (item) => isRecord(item) && item.href === expectedConfiguredUrl('/mcp'),
      ),
      'API Catalog 缺少 MCP endpoint href。',
    );
  }

  if (ardCatalog) {
    check(ardCatalog.specVersion === '1.0', 'ARD catalog specVersion 無效。');
    check(isRecord(ardCatalog.host), 'ARD catalog 缺少 host object。');
    const entries = ardCatalog.entries;
    check(
      Array.isArray(entries) && entries.length >= 3,
      'ARD catalog 必須至少列出三個公開 agent resource。',
    );
    if (isRecord(ardCatalog.host)) {
      check(
        typeof ardCatalog.host.displayName === 'string' &&
          typeof ardCatalog.host.identifier === 'string',
        'ARD catalog host 必須有 displayName 與 identifier。',
      );
    }
    if (Array.isArray(entries)) {
      check(
        entries.every((entry) => {
          if (!isRecord(entry)) {
            return false;
          }
          const hasUrl = typeof entry.url === 'string';
          const hasData = isRecord(entry.data);
          const queries = entry.representativeQueries;
          return (
            typeof entry.identifier === 'string' &&
            entry.identifier.startsWith('urn:air:') &&
            typeof entry.displayName === 'string' &&
            typeof entry.type === 'string' &&
            hasUrl !== hasData &&
            Array.isArray(queries) &&
            queries.length >= 2 &&
            queries.length <= 5 &&
            queries.every((query) => typeof query === 'string')
          );
        }),
        'ARD catalog entries 必須符合 identifier、type、url/data 與 representativeQueries 規則。',
      );
      const expectedArdUrls = [
        expectedConfiguredUrl('/api/content.json'),
        expectedConfiguredUrl('/openapi.json'),
        expectedConfiguredUrl('/.well-known/mcp/server-card.json'),
        expectedConfiguredUrl(
          '/.well-known/agent-skills/research-digital-engine/SKILL.md',
        ),
      ];
      for (const expectedUrl of expectedArdUrls) {
        check(
          entries.some((entry) => isRecord(entry) && entry.url === expectedUrl),
          `ARD catalog 缺少公開 resource URL ${expectedUrl ?? '(invalid SITE_URL)'}。`,
        );
      }
    }
  }

  if (serverCard) {
    check(
      serverCard.name === 'darrenhuang-public-content',
      'MCP Server Card 缺少 server name。',
    );
    check(
      serverCard.serverUrl === expectedConfiguredUrl('/mcp'),
      'MCP Server Card 缺少正式 serverUrl。',
    );
    check(
      serverCard.protocolVersion === '2025-06-18',
      'MCP Server Card protocolVersion 無效。',
    );
    const transport = serverCard.transport;
    const expectedEndpoint = configuredBase ? `${configuredBase}/mcp` : '/mcp';
    check(
      isRecord(transport) &&
        transport.type === 'streamable-http' &&
        transport.endpoint === expectedEndpoint,
      'MCP Server Card 缺少正確的 streamable HTTP endpoint。',
    );
    check(
      isRecord(serverCard.authentication) &&
        serverCard.authentication.required === false,
      'MCP Server Card 必須明確宣告目前不需要 authentication。',
    );
    check(
      Array.isArray(serverCard.tools) && serverCard.tools.length === 2,
      'MCP Server Card 必須列出兩個公開唯讀 tools。',
    );
  }

  if (artifactPaths.has('auth.md')) {
    const auth = await readFile(path.join(distRoot, 'auth.md'), 'utf8');
    check(
      auth.startsWith('# Auth.md — Authentication guidance\n'),
      'auth.md 缺少標題。',
    );
    check(auth.length > 500, 'auth.md 內容過短。');
    check(
      auth.includes('不提供會員登入') && auth.includes('不提供寫入'),
      'auth.md 必須說明目前的 authentication 與 write scope。',
    );
    check(
      auth.includes('Agent audience:') &&
        auth.includes('Registration/provisioning endpoint:') &&
        auth.includes('Supported registration methods:') &&
        auth.includes('Credential use:'),
      'auth.md 必須自包含說明 agent audience、provisioning endpoint、registration methods 與 credential use。',
    );
  }
}

async function verifyAliasFiles(
  entries: AliasEntry[],
  artifactPaths: Set<string>,
): Promise<void> {
  for (const entry of entries) {
    const output = findOutput(entry.aliasPath, artifactPaths);
    if (!output || !output.endsWith('.html')) {
      continue;
    }

    const $ = load(
      await readFile(path.join(distRoot, ...output.split('/')), 'utf8'),
    );
    const canonicalHref = $('link[rel="canonical"]').attr('href');
    const actual = canonicalHref
      ? absoluteUrl(canonicalHref, `${output} alias canonical`)?.toString()
      : undefined;
    const expected = productionSiteUrl(entry.canonicalPath).toString();
    check(Boolean(canonicalHref), `${output} 缺少 alias rel=canonical。`);
    check(
      actual === expected,
      `${output} 的 alias canonical 必須是 ${expected}。`,
    );
  }
}

async function verifyRobots(artifactPaths: Set<string>): Promise<void> {
  if (!check(artifactPaths.has('robots.txt'), '缺少 dist/robots.txt。')) {
    return;
  }

  const source = await readFile(path.join(distRoot, 'robots.txt'), 'utf8');
  const sitemapLines = source
    .split(/\r?\n/)
    .map((line) => /^Sitemap:\s*(\S+)\s*$/i.exec(line)?.[1])
    .filter((value): value is string => Boolean(value));
  const expected = expectedConfiguredUrl('/sitemap-index.xml');
  check(
    sitemapLines.length === 1 && sitemapLines[0] === expected,
    `robots.txt 的 Sitemap 必須是 ${expected ?? '(invalid SITE_URL)'}。`,
  );
}

async function main(): Promise<void> {
  if (!(await exists(distRoot))) {
    throw new Error(
      '找不到 dist。請先執行 npm run build，再執行 npm run verify:dist。',
    );
  }

  if (!(await exists(manifestPath))) {
    throw new Error(
      '找不到 migration/manifest.json。請先完成 importer 與 npm run verify:migration。',
    );
  }

  const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!isRecord(parsed)) {
    throw new Error('migration/manifest.json 的根節點必須是 JSON object。');
  }

  const artifactFiles = await walkFiles(distRoot);
  const artifactPaths = new Set(artifactFiles.map(artifactRelative));
  check(
    artifactPaths.has('_optimized/manifest.json'),
    '缺少 dist/_optimized/manifest.json 響應式圖片清單。',
  );
  let artifactSize = 0;

  for (const file of artifactFiles) {
    artifactSize += (await stat(file)).size;
  }

  check(
    artifactSize < pagesLimit,
    `Artifact 為 ${artifactSize} bytes，超過 GitHub Pages 1 GiB 上限。`,
  );
  if (artifactSize >= failureSize) {
    failures.push(
      `Artifact 為 ${(artifactSize / mebibyte).toFixed(1)} MiB，已達 900 MiB fail 門檻。`,
    );
  } else if (artifactSize >= warningSize) {
    warnings.push(
      `Artifact 為 ${(artifactSize / mebibyte).toFixed(1)} MiB，已達 750 MiB warning 門檻。`,
    );
  }

  const canonicalEntries = collectCanonicalEntries(parsed);
  check(
    canonicalEntries.filter((entry) => entry.kind === 'posts').length === 86,
    'Dist verifier 預期 manifest 有 86 篇 posts。',
  );
  check(
    canonicalEntries.filter((entry) => entry.kind === 'stories').length === 2,
    'Dist verifier 預期 manifest 有 2 篇 Stories。',
  );
  await verifyCanonicalFiles(canonicalEntries, artifactPaths);

  const aliases = collectAliases(parsed);
  for (const alias of aliases) {
    check(
      Boolean(findOutput(alias.aliasPath, artifactPaths)),
      `Alias 沒有實體 fallback 輸出：${alias.aliasPath}`,
    );
  }
  await verifyAliasFiles(aliases, artifactPaths);
  await verifyAgentResources(canonicalEntries, artifactPaths);
  await verifyPublicAgentResources(artifactPaths, canonicalEntries);

  const htmlFiles = artifactFiles.filter((file) =>
    file.toLowerCase().endsWith('.html'),
  );
  const cssFiles = artifactFiles.filter((file) =>
    file.toLowerCase().endsWith('.css'),
  );
  await verifyTracking(htmlFiles);
  await verifyHtmlReferences(htmlFiles, artifactPaths);
  await verifyCssReferences(cssFiles, artifactPaths);
  await verifySitemap(canonicalEntries, artifactFiles, artifactPaths);
  await verifyRss(parsed, artifactPaths);
  await verifyRobots(artifactPaths);

  if (check(artifactPaths.has('404.html'), '缺少 dist/404.html。')) {
    const notFound = await readFile(path.join(distRoot, '404.html'), 'utf8');
    check(
      /<meta\s+name=["']robots["'][^>]*noindex/i.test(notFound),
      '404.html 必須包含 noindex robots meta。',
    );
    check(/找不到|404/i.test(notFound), '404.html 缺少可讀的找不到頁面訊息。');
  }

  for (const warning of warnings) {
    console.warn(`[verify:dist] WARNING: ${warning}`);
  }

  if (failures.length > 0) {
    const uniqueFailures = [...new Set(failures)];
    console.error(`[verify:dist] FAILED：${uniqueFailures.length} 個問題。`);
    for (const failure of uniqueFailures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `[verify:dist] PASS：${canonicalEntries.length} 個 canonical outputs、${htmlFiles.length} 個 HTML 與 ${(artifactSize / mebibyte).toFixed(1)} MiB artifact 均符合規格。`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify:dist] FAILED：${message}`);
  process.exitCode = 1;
});
