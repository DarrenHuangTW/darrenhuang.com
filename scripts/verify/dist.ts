import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { load } from 'cheerio';
import { PRODUCTION_SITE_URL, productionSiteUrl } from '../../site.config';

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
  check(itemCount === 86, `RSS 應包含 86 個 items，實際為 ${itemCount}。`);

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
  if (!Array.isArray(posts)) {
    return;
  }

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
    const actual = canonicalHref
      ? absoluteUrl(canonicalHref, `${output} rel=canonical`)?.toString()
      : undefined;
    const expected = expectedConfiguredUrl(entry.canonicalPath);
    check(Boolean(canonicalHref), `${output} 缺少 rel=canonical。`);
    check(
      Boolean(actual && expected && actual === expected),
      `${output} 的 canonical 必須是 ${expected ?? '(invalid SITE_URL)'}。`,
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

  const htmlFiles = artifactFiles.filter((file) =>
    file.toLowerCase().endsWith('.html'),
  );
  const cssFiles = artifactFiles.filter((file) =>
    file.toLowerCase().endsWith('.css'),
  );
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
