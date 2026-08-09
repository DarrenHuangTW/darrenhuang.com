import { load } from 'cheerio';

import { redactPublicCredentialValues, sanitizePublicUrl } from './sanitize.js';

import type {
  StoryAnalysis,
  StoryAnalysisOptions,
  StoryAsset,
  StoryAssetKind,
  StoryPageAnalysis,
} from './types.js';
import {
  ensureTrailingSlash,
  getInternalHosts,
  isExternalUrl,
  replacePrivateOriginLiterals,
  rewriteWordPressUrl,
  toAbsoluteUrl,
} from './urls.js';

const DEFAULT_SITE_URL = 'https://www.darrenhuang.com/';
const DEFAULT_PUBLISHER_LOGO_PATH =
  '/wp-content/uploads/2020/10/數位引擎-logo.png';
const STORY_URL_ATTRIBUTES = [
  'artwork',
  'background-audio',
  'data-tooltip-icon',
  'entity-logo-src',
  'entity-url',
  'href',
  'poster',
  'poster-landscape-src',
  'poster-portrait-src',
  'poster-square-src',
  'publisher-logo-src',
  'src',
] as const;

export function analyzeStoryHtml(
  rawHtml: string,
  options: StoryAnalysisOptions = {},
): StoryAnalysis {
  const isDocument = /<html\b/i.test(rawHtml);
  const $ = load(rawHtml, {}, isDocument);
  const warnings: string[] = [];
  const siteUrl = ensureTrailingSlash(options.siteUrl ?? DEFAULT_SITE_URL);
  const language = options.language ?? 'zh-Hant';
  const title = replacePrivateOriginLiterals(
    getStoryTitle($, options.title),
    options.internalHosts,
  );
  const canonicalUrl = getCanonicalUrl($, options, siteUrl);
  const internalHosts = getInternalHosts(options.internalHosts);

  removeUnsafeStoryMarkup($, warnings);
  sanitizeStoryUrls($);
  const pages = analyzePages($, title, options, internalHosts);
  rewriteStoryUrls($, options, warnings);
  normalizeStoryDocument($, {
    canonicalUrl,
    isDocument,
    language,
    publisherLogoUrl: getPublisherLogoUrl(options, siteUrl),
    title,
    warnings,
  });

  const globalAssets = collectGlobalStoryAssets($, options, internalHosts);
  const assets = [...pages.flatMap((page) => page.assets), ...globalAssets];
  const links = unique(pages.flatMap((page) => page.links));
  const transcript = pages.flatMap((page) => page.transcript);
  const pageIds = pages.map((page) => page.id);

  if (pages.length === 0) {
    warnings.push('No amp-story-page elements were found.');
  }

  if (new Set(pageIds).size !== pageIds.length) {
    warnings.push('Duplicate amp-story-page IDs were found.');
  }

  return {
    assets,
    canonicalUrl,
    language,
    links,
    normalizedHtml: replacePrivateOriginLiterals(
      redactPublicCredentialValues($.html()),
      options.internalHosts,
    ),
    pageCount: pages.length,
    pages,
    title,
    transcript,
    warnings,
  };
}

export const analyzeStoryAmpHtml = analyzeStoryHtml;

interface NormalizeStoryOptions {
  canonicalUrl: string | null;
  isDocument: boolean;
  language: string;
  publisherLogoUrl: string;
  title: string;
  warnings: string[];
}

function normalizeStoryDocument(
  $: ReturnType<typeof load>,
  options: NormalizeStoryOptions,
): void {
  const story = $('amp-story').first();

  if (!options.isDocument) {
    options.warnings.push(
      'Story input is an HTML fragment; lang, canonical, and publisher logo cannot be injected into a document shell.',
    );
    return;
  }

  const html = $('html').first();
  html.attr('amp', '');
  html.attr('lang', options.language);

  if (options.canonicalUrl !== null) {
    const canonicalLinks = $('link[rel~="canonical"]');

    if (canonicalLinks.length === 0) {
      $('head').append(
        `<link rel="canonical" href="${escapeAttribute(options.canonicalUrl)}">`,
      );
    } else {
      canonicalLinks.first().attr('href', options.canonicalUrl);
      canonicalLinks.slice(1).remove();
    }
  } else {
    options.warnings.push('Story canonical URL could not be determined.');
  }

  if (story.length === 0) {
    options.warnings.push('No outer amp-story element was found.');
    return;
  }

  story.attr('publisher-logo-src', options.publisherLogoUrl);

  if (options.title !== '') {
    story.attr('title', options.title);
    const titleElement = $('head > title').first();

    if (titleElement.length === 0) {
      $('head').prepend(`<title>${escapeText(options.title)}</title>`);
    } else {
      titleElement.text(options.title);
    }
  }
}

function analyzePages(
  $: ReturnType<typeof load>,
  title: string,
  options: StoryAnalysisOptions,
  internalHosts: Set<string>,
): StoryPageAnalysis[] {
  const pages: StoryPageAnalysis[] = [];

  $('amp-story-page').each((zeroBasedIndex, element) => {
    const page = $(element);
    const index = zeroBasedIndex + 1;
    const transcript = extractPageTranscript(
      $,
      page,
      title,
      options.internalHosts,
    );
    const assets = collectPageAssets($, page, index, options, internalHosts);
    const links = unique(
      page
        .find('a[href]')
        .toArray()
        .map((anchor) =>
          rewriteWordPressUrl(
            sanitizePublicUrl($(anchor).attr('href') ?? ''),
            options.internalHosts,
          ),
        )
        .filter((value) => value !== '' && !isUnsafeUrl(value)),
    );

    pages.push({
      assets,
      autoAdvanceAfter: page.attr('auto-advance-after') ?? null,
      id: page.attr('id')?.trim() || `page-${index}`,
      index,
      links,
      transcript,
    });
  });

  return pages;
}

function extractPageTranscript(
  $: ReturnType<typeof load>,
  page: ReturnType<ReturnType<typeof load>>,
  title: string,
  internalHosts: string[] = [],
): string[] {
  const transcript: string[] = [];

  page.find('h1, h2, h3, p').each((_index, element) => {
    const node = $(element);

    if (node.parents('h1, h2, h3, p').length > 0) {
      return;
    }

    appendUniqueText(transcript, node.text(), title, internalHosts);
  });

  page.find('a[href]').each((_index, element) => {
    appendUniqueText(transcript, $(element).text(), title, internalHosts);
  });

  return transcript;
}

function collectPageAssets(
  $: ReturnType<typeof load>,
  page: ReturnType<ReturnType<typeof load>>,
  pageIndex: number,
  options: StoryAnalysisOptions,
  internalHosts: Set<string>,
): StoryAsset[] {
  const assets: StoryAsset[] = [];
  const keys = new Set<string>();

  page.find('img, amp-img').each((_index, element) => {
    const node = $(element);
    addStoryAsset(
      assets,
      keys,
      node.attr('src'),
      'image',
      pageIndex,
      element.name,
      'src',
      options,
      internalHosts,
    );

    for (const candidate of parseSrcset(node.attr('srcset') ?? '')) {
      addStoryAsset(
        assets,
        keys,
        candidate,
        'image',
        pageIndex,
        element.name,
        'srcset',
        options,
        internalHosts,
      );
    }
  });

  page.find('video, amp-video').each((_index, element) => {
    const node = $(element);
    addStoryAsset(
      assets,
      keys,
      node.attr('src'),
      'video',
      pageIndex,
      element.name,
      'src',
      options,
      internalHosts,
    );
    addStoryAsset(
      assets,
      keys,
      node.attr('poster'),
      'poster',
      pageIndex,
      element.name,
      'poster',
      options,
      internalHosts,
    );
    addStoryAsset(
      assets,
      keys,
      node.attr('artwork'),
      'poster',
      pageIndex,
      element.name,
      'artwork',
      options,
      internalHosts,
    );
  });

  page.find('audio, amp-audio').each((_index, element) => {
    addStoryAsset(
      assets,
      keys,
      $(element).attr('src'),
      'audio',
      pageIndex,
      element.name,
      'src',
      options,
      internalHosts,
    );
  });

  page.find('source[src]').each((_index, element) => {
    const node = $(element);
    const kind: StoryAssetKind =
      node.parents('audio, amp-audio').length > 0 ? 'audio' : 'video';
    addStoryAsset(
      assets,
      keys,
      node.attr('src'),
      kind,
      pageIndex,
      element.name,
      'src',
      options,
      internalHosts,
    );
  });

  addStoryAsset(
    assets,
    keys,
    page.attr('background-audio'),
    'audio',
    pageIndex,
    'amp-story-page',
    'background-audio',
    options,
    internalHosts,
  );

  page.find('[data-tooltip-icon]').each((_index, element) => {
    addStoryAsset(
      assets,
      keys,
      $(element).attr('data-tooltip-icon'),
      'image',
      pageIndex,
      element.name,
      'data-tooltip-icon',
      options,
      internalHosts,
    );
  });

  return assets;
}

function collectGlobalStoryAssets(
  $: ReturnType<typeof load>,
  options: StoryAnalysisOptions,
  internalHosts: Set<string>,
): StoryAsset[] {
  const assets: StoryAsset[] = [];
  const keys = new Set<string>();
  const story = $('amp-story').first();

  addStoryAsset(
    assets,
    keys,
    story.attr('poster-portrait-src'),
    'poster',
    null,
    'amp-story',
    'poster-portrait-src',
    options,
    internalHosts,
  );
  addStoryAsset(
    assets,
    keys,
    story.attr('poster-square-src'),
    'poster',
    null,
    'amp-story',
    'poster-square-src',
    options,
    internalHosts,
  );
  addStoryAsset(
    assets,
    keys,
    story.attr('poster-landscape-src'),
    'poster',
    null,
    'amp-story',
    'poster-landscape-src',
    options,
    internalHosts,
  );
  addStoryAsset(
    assets,
    keys,
    story.attr('publisher-logo-src'),
    'publisher-logo',
    null,
    'amp-story',
    'publisher-logo-src',
    options,
    internalHosts,
  );
  addStoryAsset(
    assets,
    keys,
    story.attr('entity-logo-src'),
    'image',
    null,
    'amp-story',
    'entity-logo-src',
    options,
    internalHosts,
  );
  addStoryAsset(
    assets,
    keys,
    story.attr('background-audio'),
    'audio',
    null,
    'amp-story',
    'background-audio',
    options,
    internalHosts,
  );

  return assets;
}

function addStoryAsset(
  assets: StoryAsset[],
  keys: Set<string>,
  sourceUrl: string | undefined,
  kind: StoryAssetKind,
  pageIndex: number | null,
  tagName: string,
  attribute: string,
  options: StoryAnalysisOptions,
  internalHosts: Set<string>,
): void {
  if (sourceUrl === undefined || sourceUrl.trim() === '') {
    return;
  }

  const sanitizedUrl = sanitizePublicUrl(sourceUrl);
  const rewrittenUrl = rewriteWordPressUrl(sanitizedUrl, options.internalHosts);

  if (isUnsafeUrl(rewrittenUrl)) {
    return;
  }
  const key = `${kind}\u0000${rewrittenUrl}\u0000${pageIndex ?? 'global'}`;

  if (keys.has(key)) {
    return;
  }

  keys.add(key);
  assets.push({
    attribute,
    external: isExternalUrl(sanitizedUrl, internalHosts),
    kind,
    pageIndex,
    rewrittenUrl,
    sourceUrl: isExternalUrl(sanitizedUrl, internalHosts)
      ? sanitizedUrl
      : rewrittenUrl,
    tagName,
  });
}

function rewriteStoryUrls(
  $: ReturnType<typeof load>,
  options: StoryAnalysisOptions,
  warnings: string[],
): void {
  $('*').each((_index, element) => {
    const node = $(element);

    if (node.is('link[rel~="canonical"]')) {
      return;
    }

    for (const attribute of STORY_URL_ATTRIBUTES) {
      const value = node.attr(attribute);

      if (value !== undefined) {
        const rewritten = rewriteWordPressUrl(
          sanitizePublicUrl(value),
          options.internalHosts,
        );

        if (isUnsafeUrl(rewritten)) {
          node.removeAttr(attribute);
          warnings.push(`Removed unsafe Story URL from ${attribute}.`);
        } else {
          node.attr(attribute, rewritten);
        }
      }
    }

    const srcset = node.attr('srcset');

    if (srcset !== undefined) {
      node.attr('srcset', rewriteSrcset(srcset, options.internalHosts));
    }
  });
}

function sanitizeStoryUrls($: ReturnType<typeof load>): void {
  $('*').each((_index, element) => {
    const node = $(element);

    for (const attribute of STORY_URL_ATTRIBUTES) {
      const value = node.attr(attribute);
      if (value !== undefined) {
        node.attr(attribute, sanitizePublicUrl(value));
      }
    }

    const srcset = node.attr('srcset');
    if (srcset !== undefined) {
      node.attr('srcset', sanitizeSrcset(srcset));
    }
  });
}

function removeUnsafeStoryMarkup(
  $: ReturnType<typeof load>,
  warnings: string[],
): void {
  const activeNestedContent = $(
    'amp-iframe[srcdoc], applet, embed, frame, frameset, iframe, object',
  );
  let removedActiveNestedContent = activeNestedContent.length > 0;
  activeNestedContent.remove();

  $('[srcdoc]').each((_index, element) => {
    $(element).removeAttr('srcdoc');
    removedActiveNestedContent = true;
  });

  if (removedActiveNestedContent) {
    warnings.push('Removed active nested content from Story HTML.');
  }

  const navigationMarkup = $('base').add(
    $('meta[http-equiv]').filter((_index, element) =>
      /^\s*refresh\s*$/i.test($(element).attr('http-equiv') ?? ''),
    ),
  );
  if (navigationMarkup.length > 0) {
    navigationMarkup.remove();
    warnings.push('Removed navigation-affecting markup from Story HTML.');
  }

  $('*').each((_index, element) => {
    const node = $(element);
    const attributes = node.attr();

    for (const attribute of Object.keys(attributes ?? {})) {
      if (/^on/i.test(attribute)) {
        node.removeAttr(attribute);
        warnings.push(`Removed event handler attribute ${attribute}.`);
      }
    }
  });

  $('script').each((_index, element) => {
    const node = $(element);
    const type = node.attr('type')?.toLowerCase();
    const source = node.attr('src');

    if (type === 'application/ld+json' || isAllowedAmpRuntime(source)) {
      return;
    }

    node.remove();
    warnings.push('Removed a non-AMP script from Story HTML.');
  });
}

function getCanonicalUrl(
  $: ReturnType<typeof load>,
  options: StoryAnalysisOptions,
  siteUrl: string,
): string | null {
  if (options.canonicalUrl !== undefined) {
    return ensureTrailingSlash(
      toAbsoluteUrl(sanitizePublicUrl(options.canonicalUrl), siteUrl),
    );
  }

  if (options.slug !== undefined && options.slug.trim() !== '') {
    return new URL(
      `/web-stories/${encodeURIComponent(options.slug.trim())}/`,
      siteUrl,
    ).toString();
  }

  const existing = $('link[rel~="canonical"]').first().attr('href');

  if (existing === undefined || existing.trim() === '') {
    return null;
  }

  return ensureTrailingSlash(
    toAbsoluteUrl(sanitizePublicUrl(existing.trim()), siteUrl),
  );
}

function getPublisherLogoUrl(
  options: StoryAnalysisOptions,
  siteUrl: string,
): string {
  const configured = options.publisherLogoUrl?.trim();

  if (configured) {
    return sanitizePublicUrl(configured);
  }

  return toAbsoluteUrl(DEFAULT_PUBLISHER_LOGO_PATH, siteUrl);
}

function getStoryTitle(
  $: ReturnType<typeof load>,
  titleOverride: string | undefined,
): string {
  if (titleOverride !== undefined) {
    return redactPublicCredentialValues(collapseWhitespace(titleOverride));
  }

  return redactPublicCredentialValues(
    collapseWhitespace(
      $('amp-story').first().attr('title') ?? $('title').first().text(),
    ),
  );
}

function appendUniqueText(
  output: string[],
  rawText: string,
  title: string,
  internalHosts: string[] = [],
): void {
  const text = replacePrivateOriginLiterals(
    redactPublicCredentialValues(collapseWhitespace(rawText)),
    internalHosts,
  )
    .replaceAll('{content}', title)
    .trim();

  if (text !== '' && !output.includes(text)) {
    output.push(text);
  }
}

function rewriteSrcset(value: string, internalHosts: string[] = []): string {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const url = parts.shift();

      if (url === undefined) return '';

      return [
        rewriteWordPressUrl(sanitizePublicUrl(url), internalHosts),
        ...parts,
      ].join(' ');
    })
    .filter(Boolean)
    .join(', ');
}

function sanitizeSrcset(value: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const url = parts.shift();

      if (url === undefined) return '';

      return [sanitizePublicUrl(url), ...parts].join(' ');
    })
    .filter(Boolean)
    .join(', ');
}

function parseSrcset(value: string): string[] {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter((candidate): candidate is string => Boolean(candidate));
}

function isAllowedAmpRuntime(source: string | undefined): boolean {
  if (source === undefined) return false;

  try {
    const parsed = new URL(source);

    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'cdn.ampproject.org' &&
      (parsed.pathname === '/v0.js' || parsed.pathname.startsWith('/v0/'))
    );
  } catch {
    return false;
  }
}

function isUnsafeUrl(value: string): boolean {
  return /^(?:data|javascript|vbscript):/i.test(value.trim());
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
