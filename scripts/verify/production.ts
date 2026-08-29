import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

import { PRODUCTION_SITE_URL } from '../../site.config.js';

type RedirectMode = 'follow' | 'manual';
type UnknownRecord = Record<string, unknown>;

interface HttpResult {
  body: string;
  elapsedMs: number;
  response: Response;
}

interface RedirectCase {
  label: string;
  url: string;
}

interface RobotsGroup {
  agents: string[];
  allows: string[];
  disallows: string[];
}

export interface RobotsPolicy {
  sitemapUrls: string[];
  wildcardAllowsRoot: boolean;
  wildcardDisallowsRoot: boolean;
  wildcardGroupFound: boolean;
}

export interface SitemapDocument {
  kind: 'index' | 'urlset';
  locations: string[];
}

export const DEFAULT_KEY_PAGES = [
  '/',
  '/articles.html',
  '/about.html',
  '/seo-newsletter-issue-69.html',
  '/web-stories/boris-johnson-shady-seo-campaign/',
] as const;

const canonicalOrigin = new URL(PRODUCTION_SITE_URL);
const canonicalHost = canonicalOrigin.hostname.toLowerCase();
const apexHost = canonicalHost.startsWith('www.')
  ? canonicalHost.slice('www.'.length)
  : canonicalHost;
const githubPagesPreview = 'https://darrenhuangtw.github.io/darrenhuang.com/';
const timeoutMs = parseTimeout(process.env.PRODUCTION_VERIFY_TIMEOUT_MS);
const userAgent =
  'darrenhuang-production-verifier/1.0 (+https://github.com/DarrenHuangTW/darrenhuang.com)';

function parseTimeout(value: string | undefined): number {
  if (!value) {
    return 15_000;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1_000 ? parsed : 15_000;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeUrl(value: URL | string): string {
  const url = typeof value === 'string' ? new URL(value) : new URL(value);
  if (!url.pathname) {
    url.pathname = '/';
  }

  return url.toString();
}

function canonicalPath(value: URL | string): string {
  return new URL(normalizeUrl(value)).pathname || '/';
}

export function isCanonicalProductionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === canonicalHost &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

export function isExpectedCanonicalRedirect(
  source: string,
  location: string,
): boolean {
  try {
    const sourceUrl = new URL(source);
    const target = new URL(location, sourceUrl);
    return (
      isCanonicalProductionUrl(target.toString()) &&
      canonicalPath(target) === canonicalPath(sourceUrl) &&
      target.search === sourceUrl.search
    );
  } catch {
    return false;
  }
}

export function isManagedRobotsCanonicalization(
  source: string,
  status: number,
  location: string | null,
  responseContentType: string,
  body: string,
): boolean {
  try {
    const sourceUrl = new URL(source);
    const policy = inspectRobots(body);
    return (
      sourceUrl.protocol === 'https:' &&
      sourceUrl.hostname.toLowerCase() === apexHost &&
      sourceUrl.pathname === '/robots.txt' &&
      status === 200 &&
      Boolean(location) &&
      isExpectedCanonicalRedirect(source, location ?? '') &&
      responseContentType.split(';', 1)[0]?.trim().toLowerCase() ===
        'text/plain' &&
      policy.wildcardGroupFound &&
      policy.wildcardAllowsRoot &&
      !policy.wildcardDisallowsRoot
    );
  } catch {
    return false;
  }
}

export function inspectRobots(source: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  const sitemapUrls: string[] = [];
  let current: RobotsGroup = { agents: [], allows: [], disallows: [] };

  const flush = () => {
    if (current.agents.length > 0) {
      groups.push(current);
    }
    current = { agents: [], allows: [], disallows: [] };
  };

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      if (!line) {
        flush();
      }
      continue;
    }

    const separator = line.indexOf(':');
    if (separator < 1) {
      continue;
    }

    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (directive === 'user-agent') {
      if (current.allows.length > 0 || current.disallows.length > 0) {
        flush();
      }
      current.agents.push(value.toLowerCase());
    } else if (directive === 'allow') {
      current.allows.push(value);
    } else if (directive === 'disallow') {
      current.disallows.push(value);
    } else if (directive === 'sitemap' && value) {
      sitemapUrls.push(value);
    }
  }
  flush();

  const wildcard = groups.find((group) => group.agents.includes('*'));
  return {
    sitemapUrls,
    wildcardAllowsRoot: wildcard?.allows.includes('/') ?? false,
    wildcardDisallowsRoot: wildcard?.disallows.includes('/') ?? false,
    wildcardGroupFound: Boolean(wildcard),
  };
}

function locationsFromContainer(
  container: unknown,
  collectionName: string,
): string[] {
  if (!isRecord(container)) {
    return [];
  }

  return asArray(container[collectionName]).flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const location = stringValue(entry.loc)?.trim();
    return location ? [location] : [];
  });
}

export function parseSitemapLocations(source: string): SitemapDocument {
  const parsed: unknown = new XMLParser({
    ignoreAttributes: true,
    processEntities: false,
    trimValues: true,
  }).parse(source);

  if (isRecord(parsed) && isRecord(parsed.sitemapindex)) {
    return {
      kind: 'index',
      locations: locationsFromContainer(parsed.sitemapindex, 'sitemap'),
    };
  }

  if (isRecord(parsed) && isRecord(parsed.urlset)) {
    return {
      kind: 'urlset',
      locations: locationsFromContainer(parsed.urlset, 'url'),
    };
  }

  throw new Error('XML root must be sitemapindex or urlset.');
}

class Reporter {
  readonly failures: string[] = [];

  result(label: string, issues: string[], detail: string): void {
    if (issues.length === 0) {
      console.log(`[verify:production] PASS ${label} — ${detail}`);
      return;
    }

    const message = issues.join('; ');
    this.failures.push(`${label}: ${message}`);
    console.error(`[verify:production] FAIL ${label} — ${message}`);
  }
}

async function get(url: string, redirect: RedirectMode): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html, text/plain, application/xml, */*',
        'user-agent': userAgent,
      },
      method: 'GET',
      redirect,
      signal: controller.signal,
    });
    const body = await response.text();
    return { body, elapsedMs: Date.now() - startedAt, response };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${url}: ${message}`, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

async function tryGet(
  reporter: Reporter,
  label: string,
  url: string,
  redirect: RedirectMode,
): Promise<HttpResult | undefined> {
  try {
    return await get(url, redirect);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    reporter.result(label, [message], url);
    return undefined;
  }
}

function contentType(response: Response): string {
  return response.headers.get('content-type')?.toLowerCase() ?? '';
}

function isHtml(response: Response): boolean {
  return contentType(response).includes('text/html');
}

function isXml(response: Response): boolean {
  const type = contentType(response);
  return type.includes('xml') || type.includes('text/plain');
}

function sameCanonicalUrl(actual: string, expected: string): boolean {
  try {
    return normalizeUrl(actual) === normalizeUrl(expected);
  } catch {
    return false;
  }
}

function isExpectedCanonicalHref(
  href: string | undefined,
  expected: string,
): boolean {
  if (!href) {
    return false;
  }

  try {
    return sameCanonicalUrl(new URL(href, expected).toString(), expected);
  } catch {
    return false;
  }
}

function statusLabel(response: Response): string {
  return `${response.status} ${response.statusText}`.trim();
}

async function verifyRedirects(reporter: Reporter): Promise<void> {
  const cases: RedirectCase[] = [
    { label: 'HTTP apex redirect', url: 'http://darrenhuang.com/' },
    { label: 'HTTPS apex redirect', url: 'https://darrenhuang.com/' },
    { label: 'HTTP www redirect', url: 'http://www.darrenhuang.com/' },
    {
      label: 'Apex redirect preserves path and query',
      url: 'https://darrenhuang.com/robots.txt?transfer-check=1',
    },
  ];

  for (const item of cases) {
    const result = await tryGet(reporter, item.label, item.url, 'manual');
    if (!result) {
      continue;
    }

    const location = result.response.headers.get('location');
    const managedRobotsCanonicalization = isManagedRobotsCanonicalization(
      item.url,
      result.response.status,
      location,
      contentType(result.response),
      result.body,
    );
    const issues: string[] = [];
    if (
      ![301, 308].includes(result.response.status) &&
      !managedRobotsCanonicalization
    ) {
      issues.push(
        `expected 301 or 308, got ${statusLabel(result.response)}; only the apex robots.txt may use Cloudflare Managed robots canonicalization`,
      );
    }
    if (!location) {
      issues.push('missing Location header');
    } else if (!isExpectedCanonicalRedirect(item.url, location)) {
      issues.push(`unexpected Location ${location}`);
    }

    reporter.result(
      item.label,
      issues,
      `${statusLabel(result.response)} in ${result.elapsedMs} ms${
        location ? ` → ${location}` : ''
      }${managedRobotsCanonicalization ? ' (Cloudflare Managed robots policy)' : ''}`,
    );
  }
}

async function verifyCanonicalHost(reporter: Reporter): Promise<void> {
  const url = new URL('/', canonicalOrigin).toString();
  const result = await tryGet(reporter, 'Canonical HTTPS host', url, 'manual');
  if (!result) {
    return;
  }

  const issues: string[] = [];
  if (result.response.status !== 200) {
    issues.push(`expected 200, got ${statusLabel(result.response)}`);
  }
  if (!isHtml(result.response)) {
    issues.push(
      `expected HTML, got ${contentType(result.response) || 'no content type'}`,
    );
  }
  if (!sameCanonicalUrl(result.response.url, url)) {
    issues.push(`unexpected final URL ${result.response.url}`);
  }

  reporter.result(
    'Canonical HTTPS host',
    issues,
    `${statusLabel(result.response)} in ${result.elapsedMs} ms`,
  );
}

async function verifyGithubPages(reporter: Reporter): Promise<void> {
  const result = await tryGet(
    reporter,
    'GitHub Pages preview availability',
    githubPagesPreview,
    'manual',
  );
  if (!result) {
    return;
  }

  const issues: string[] = [];
  const location = result.response.headers.get('location');
  const isRedirect = [301, 308].includes(result.response.status);
  const isDirectPage = result.response.status === 200;

  if (!isRedirect && !isDirectPage) {
    issues.push(
      `expected 200 or a permanent redirect, got ${statusLabel(result.response)}`,
    );
  }
  if (
    isRedirect &&
    (!location ||
      !sameCanonicalUrl(location, new URL('/', canonicalOrigin).toString()))
  ) {
    issues.push(`unexpected Location ${location ?? '(missing)'}`);
  }
  if (isDirectPage) {
    if (!isHtml(result.response)) {
      issues.push(
        `expected HTML, got ${contentType(result.response) || 'no content type'}`,
      );
    }
    if (
      !/<html[\s>]/iu.test(result.body) ||
      !result.body.includes('讓寫過的內容')
    ) {
      issues.push(
        'direct Pages response does not look like the published site',
      );
    }
  }

  reporter.result(
    'GitHub Pages preview availability',
    issues,
    `${statusLabel(result.response)} in ${result.elapsedMs} ms${
      location ? ` → ${location}` : ''
    }`,
  );
}

async function verifyRobots(reporter: Reporter): Promise<void> {
  const url = new URL('/robots.txt', canonicalOrigin).toString();
  const result = await tryGet(reporter, 'robots.txt', url, 'follow');
  if (!result) {
    return;
  }

  const policy = inspectRobots(result.body);
  const expectedSitemap = new URL(
    '/sitemap-index.xml',
    canonicalOrigin,
  ).toString();
  const issues: string[] = [];

  if (result.response.status !== 200) {
    issues.push(`expected 200, got ${statusLabel(result.response)}`);
  }
  if (!contentType(result.response).includes('text/plain')) {
    issues.push(
      `expected text/plain, got ${contentType(result.response) || 'no content type'}`,
    );
  }
  if (!sameCanonicalUrl(result.response.url, url)) {
    issues.push(`unexpected final URL ${result.response.url}`);
  }
  if (!policy.wildcardGroupFound) {
    issues.push('missing User-agent: * group');
  }
  if (!policy.wildcardAllowsRoot) {
    issues.push('User-agent: * does not Allow: /');
  }
  if (policy.wildcardDisallowsRoot) {
    issues.push('User-agent: * also contains Disallow: /');
  }
  if (
    policy.sitemapUrls.length !== 1 ||
    !sameCanonicalUrl(policy.sitemapUrls[0] ?? '', expectedSitemap)
  ) {
    issues.push(`expected one Sitemap: ${expectedSitemap}`);
  }

  reporter.result(
    'robots.txt',
    issues,
    `${statusLabel(result.response)} in ${result.elapsedMs} ms`,
  );
}

async function verifySitemap(reporter: Reporter): Promise<void> {
  const indexUrl = new URL('/sitemap-index.xml', canonicalOrigin).toString();
  const indexResult = await tryGet(
    reporter,
    'Sitemap index',
    indexUrl,
    'follow',
  );
  if (!indexResult) {
    return;
  }

  const indexIssues: string[] = [];
  if (indexResult.response.status !== 200) {
    indexIssues.push(`expected 200, got ${statusLabel(indexResult.response)}`);
  }
  if (!isXml(indexResult.response)) {
    indexIssues.push(
      `expected XML, got ${contentType(indexResult.response) || 'no content type'}`,
    );
  }
  if (!sameCanonicalUrl(indexResult.response.url, indexUrl)) {
    indexIssues.push(`unexpected final URL ${indexResult.response.url}`);
  }

  let index: SitemapDocument | undefined;
  try {
    index = parseSitemapLocations(indexResult.body);
    if (index.kind !== 'index') {
      indexIssues.push('root document is not a sitemap index');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    indexIssues.push(`invalid XML: ${message}`);
  }

  const childUrls = (index?.locations ?? []).map((location) => {
    try {
      return new URL(location);
    } catch {
      return undefined;
    }
  });
  if (childUrls.length === 0) {
    indexIssues.push('sitemap index contains no child sitemap locations');
  }

  const validChildUrls = childUrls.filter(
    (url): url is URL =>
      url instanceof URL &&
      isCanonicalProductionUrl(url.toString()) &&
      /^\/sitemap(?:-|\.)[^/]+\.xml$/iu.test(url.pathname),
  );
  if (validChildUrls.length !== childUrls.length) {
    indexIssues.push('sitemap index contains an invalid or off-host child URL');
  }

  reporter.result(
    'Sitemap index',
    indexIssues,
    `${statusLabel(indexResult.response)} in ${indexResult.elapsedMs} ms; ${validChildUrls.length} child sitemap(s)`,
  );

  const allLocations = new Set<string>();
  const childResults = await Promise.all(
    validChildUrls.map(async (childUrl) => ({
      childUrl,
      result: await tryGet(
        reporter,
        `Sitemap ${childUrl.pathname}`,
        childUrl.toString(),
        'follow',
      ),
    })),
  );

  for (const { childUrl, result } of childResults) {
    if (!result) {
      continue;
    }

    const issues: string[] = [];
    if (result.response.status !== 200) {
      issues.push(`expected 200, got ${statusLabel(result.response)}`);
    }
    if (!isXml(result.response)) {
      issues.push(
        `expected XML, got ${contentType(result.response) || 'no content type'}`,
      );
    }
    if (!sameCanonicalUrl(result.response.url, childUrl.toString())) {
      issues.push(`unexpected final URL ${result.response.url}`);
    }

    try {
      const document = parseSitemapLocations(result.body);
      if (document.kind !== 'urlset') {
        issues.push('root document is not a URL set');
      }
      if (document.locations.length === 0) {
        issues.push('URL set contains no locations');
      }
      for (const location of document.locations) {
        if (!isCanonicalProductionUrl(location)) {
          issues.push(`off-host or non-HTTPS URL ${location}`);
          continue;
        }
        allLocations.add(normalizeUrl(location));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`invalid XML: ${message}`);
    }

    reporter.result(
      `Sitemap ${childUrl.pathname}`,
      issues,
      `${statusLabel(result.response)} in ${result.elapsedMs} ms`,
    );
  }

  const missingKeyPages = DEFAULT_KEY_PAGES.filter(
    (page) => !allLocations.has(normalizeUrl(new URL(page, canonicalOrigin))),
  );
  reporter.result(
    'Sitemap key URLs',
    missingKeyPages.length > 0 ? [`missing ${missingKeyPages.join(', ')}`] : [],
    `${allLocations.size} canonical URL(s) found`,
  );
}

async function verifyKeyPage(
  reporter: Reporter,
  pagePath: string,
): Promise<void> {
  const url = new URL(pagePath, canonicalOrigin).toString();
  const result = await tryGet(reporter, `Key page ${pagePath}`, url, 'follow');
  if (!result) {
    return;
  }

  const issues: string[] = [];
  if (result.response.status !== 200) {
    issues.push(`expected 200, got ${statusLabel(result.response)}`);
  }
  if (!isHtml(result.response)) {
    issues.push(
      `expected HTML, got ${contentType(result.response) || 'no content type'}`,
    );
  }
  if (!sameCanonicalUrl(result.response.url, url)) {
    issues.push(`unexpected final URL ${result.response.url}`);
  }

  const $ = load(result.body);
  if ($('html').length === 0 || $('title').first().text().trim() === '') {
    issues.push('response does not contain a usable HTML title');
  }

  const robots = $('meta[name="robots"]').attr('content')?.toLowerCase() ?? '';
  if (robots.includes('noindex')) {
    issues.push('page is marked noindex');
  }

  const canonical = $('link[rel="canonical"]').attr('href');
  if (!isExpectedCanonicalHref(canonical, url)) {
    issues.push(`canonical link is not ${url}`);
  }

  reporter.result(
    `Key page ${pagePath}`,
    issues,
    `${statusLabel(result.response)} in ${result.elapsedMs} ms`,
  );
}

async function verifyKeyPages(reporter: Reporter): Promise<void> {
  for (const pagePath of DEFAULT_KEY_PAGES) {
    await verifyKeyPage(reporter, pagePath);
  }
}

export async function runProductionVerification(): Promise<number> {
  const reporter = new Reporter();
  console.log(
    `[verify:production] Read-only GET verification for ${canonicalOrigin.origin}.`,
  );
  console.log(
    `[verify:production] Timeout: ${timeoutMs} ms per request; manual DNS/email gates are documented in migration-report/production-transfer-verification.md.`,
  );

  await verifyRedirects(reporter);
  await verifyCanonicalHost(reporter);
  await verifyGithubPages(reporter);
  await verifyRobots(reporter);
  await verifySitemap(reporter);
  await verifyKeyPages(reporter);

  if (reporter.failures.length > 0) {
    console.error(
      `[verify:production] FAILED: ${reporter.failures.length} check(s) need attention.`,
    );
    return 1;
  }

  console.log(
    '[verify:production] PASS: public redirect, HTTPS, GitHub Pages, robots.txt, sitemap, and key-page checks passed.',
  );
  console.log(
    '[verify:production] Registrar, DNS, and email continuity still require the manual checklist.',
  );
  return 0;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const scriptPath = path.resolve(fileURLToPath(import.meta.url));

if (entryPath === scriptPath) {
  runProductionVerification()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[verify:production] FAILED: ${message}`);
      process.exitCode = 1;
    });
}
