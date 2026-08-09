import { parse } from '@wordpress/block-serialization-default-parser';
import { load } from 'cheerio';

import {
  escapeHtml,
  redactPublicCredentialValues,
  sanitizePublicUrl,
  sanitizeTransformedHtml,
} from './sanitize.js';
import type {
  EmbedProvider,
  EmbedReportEntry,
  GutenbergAttributes,
  GutenbergBlock,
  MediaDependency,
  MediaDependencyKind,
  TransformOptions,
  TransformReport,
  TransformResult,
} from './types.js';
import {
  getInternalHosts,
  isExternalUrl,
  replacePrivateOriginLiterals,
  rewriteWordPressUrl,
} from './urls.js';

const KNOWN_CORE_BLOCKS = new Set([
  'core/audio',
  'core/button',
  'core/buttons',
  'core/code',
  'core/column',
  'core/columns',
  'core/cover',
  'core/file',
  'core/freeform',
  'core/gallery',
  'core/group',
  'core/heading',
  'core/html',
  'core/image',
  'core/list',
  'core/list-item',
  'core/media-text',
  'core/paragraph',
  'core/preformatted',
  'core/pullquote',
  'core/quote',
  'core/separator',
  'core/spacer',
  'core/table',
  'core/video',
]);

const ACCORDION_BLOCKS = new Set([
  'coblocks/accordion',
  'coblocks/accordion-item',
  'genesis-blocks/gb-accordion',
]);

const MEDIA_EXTENSION =
  /\.(?:avif|gif|jpe?g|pdf|png|svg|webp|mp3|m4a|ogg|wav|flac|mp4|m4v|mov|ogv|webm)(?:[?#]|$)/i;

interface TransformContext {
  internalHosts: Set<string>;
  mediaKeys: Set<string>;
  options: TransformOptions;
  report: TransformReport;
}

interface RenderedEmbed {
  html: string;
  renderedAs: EmbedReportEntry['renderedAs'];
}

export function parseGutenbergAst(content: string): GutenbergBlock[] {
  return parse(content) as unknown as GutenbergBlock[];
}

export function transformWordPressContent(
  content: string,
  options: TransformOptions = {},
): TransformResult {
  const ast = parseGutenbergAst(content);
  const report: TransformReport = {
    embeds: [],
    mediaDependencies: [],
    unknownBlocks: [],
    warnings: [],
  };
  const context: TransformContext = {
    internalHosts: getInternalHosts(options.internalHosts),
    mediaKeys: new Set(),
    options,
    report,
  };
  const rendered = ast.map((block) => renderBlock(block, context)).join('');
  const html = transformHtmlFragment(rendered, context);

  return { ast, html, report };
}

function renderBlock(block: GutenbergBlock, context: TransformContext): string {
  const { blockName } = block;

  if (blockName === null) {
    return block.innerHTML;
  }

  if (blockName === 'core/embed' || blockName.startsWith('core-embed/')) {
    return renderEmbedBlock(block, context);
  }

  if (blockName === 'core/more') {
    return '';
  }

  if (blockName === 'mailchimp-for-wp/form') {
    const formId = getStringAttribute(block, 'id');
    const idAttribute = formId
      ? ` data-source-form-id="${escapeHtml(formId)}"`
      : '';

    return `<aside class="wp-static-form-notice" role="note"${idAttribute}><p>原電子報訂閱表單已停止運作。請使用網站目前提供的訂閱方式。</p></aside>`;
  }

  const composed = composeInnerContent(block, context);

  if (ACCORDION_BLOCKS.has(blockName)) {
    return composed;
  }

  if (blockName === 'genesis-blocks/gb-notice') {
    return `<aside class="wp-callout wp-callout--notice" role="note">${composed}</aside>`;
  }

  if (blockName === 'coblocks/alert') {
    return `<aside class="wp-callout wp-callout--alert" role="note">${composed}</aside>`;
  }

  if (blockName === 'coblocks/gallery-carousel') {
    return `<div class="wp-gallery wp-gallery--carousel-fallback">${composed}</div>`;
  }

  if (KNOWN_CORE_BLOCKS.has(blockName)) {
    return composed;
  }

  context.report.unknownBlocks.push({
    attrs: sanitizeReportAttributes(block.attrs, context.options.internalHosts),
    blockName,
    htmlPreview: collapseWhitespace(
      sanitizeHtmlPreview(composed, context.options.internalHosts),
    ).slice(0, 240),
    strategy: 'sanitized-html',
  });

  return `<div class="wp-block-fallback" data-wp-block="${escapeHtml(blockName)}">${composed}</div>`;
}

function composeInnerContent(
  block: GutenbergBlock,
  context: TransformContext,
): string {
  let childIndex = 0;
  let output = '';

  for (const segment of block.innerContent) {
    if (segment === null) {
      const child = block.innerBlocks[childIndex];

      if (child === undefined) {
        context.report.warnings.push(
          `Block ${block.blockName ?? '(classic)'} has an unmatched inner-content placeholder.`,
        );
      } else {
        output += renderBlock(child, context);
        childIndex += 1;
      }
    } else {
      output += segment;
    }
  }

  if (childIndex < block.innerBlocks.length) {
    context.report.warnings.push(
      `Block ${block.blockName ?? '(classic)'} has ${block.innerBlocks.length - childIndex} unplaced inner block(s).`,
    );

    output += block.innerBlocks
      .slice(childIndex)
      .map((child) => renderBlock(child, context))
      .join('');
  }

  return output;
}

function renderEmbedBlock(
  block: GutenbergBlock,
  context: TransformContext,
): string {
  const blockName = block.blockName ?? 'core/embed';
  const rawUrl =
    getStringAttribute(block, 'url') ?? extractFirstUrl(block.innerHTML) ?? '';
  const sourceUrl = rewriteWordPressUrl(rawUrl, context.options.internalHosts);
  const provider = getEmbedProvider(block, sourceUrl);
  const rendered = renderEmbed(provider, sourceUrl);

  recordEmbed(context, {
    blockName,
    provider,
    renderedAs: rendered.renderedAs,
    sourceUrl,
  });

  return rendered.html;
}

function renderEmbed(
  provider: EmbedProvider,
  sourceUrl: string,
): RenderedEmbed {
  if (provider === 'youtube') {
    return renderYoutubeEmbed(sourceUrl);
  }

  if (provider === 'twitter') {
    return {
      html: `<blockquote class="embed embed--twitter"><p>Twitter／X 貼文</p>${renderPermanentLink(sourceUrl, '在 Twitter／X 查看原始貼文')}</blockquote>`,
      renderedAs: 'url-blockquote',
    };
  }

  if (provider === 'spotify') {
    return renderSpotifyEmbed(sourceUrl);
  }

  return renderGenericEmbed(provider, sourceUrl);
}

function renderYoutubeEmbed(sourceUrl: string): RenderedEmbed {
  const parsed = parseYoutubeUrl(sourceUrl);

  if (parsed === null) {
    return renderGenericEmbed('youtube', sourceUrl);
  }

  const query = parsed.embedQuery.toString();
  const iframeUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(parsed.videoId)}${query === '' ? '' : `?${query}`}`;
  const permanentUrl = isHttpUrl(sourceUrl)
    ? sourceUrl
    : `https://www.youtube.com/watch?v=${encodeURIComponent(parsed.videoId)}`;

  return {
    html: `<figure class="embed embed--youtube"><div class="embed__frame"><iframe src="${escapeHtml(iframeUrl)}" title="YouTube video player" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><figcaption>${renderPermanentLink(permanentUrl, '在 YouTube 查看原始影片')}</figcaption></figure>`,
    renderedAs: 'lazy-iframe',
  };
}

function renderSpotifyEmbed(sourceUrl: string): RenderedEmbed {
  let parsed: URL;

  try {
    parsed = new URL(sourceUrl);
  } catch {
    return renderGenericEmbed('spotify', sourceUrl);
  }

  const match = parsed.pathname.match(
    /^\/(episode|playlist|show|track)\/([A-Za-z0-9]+)\/?$/,
  );

  if (match === null) {
    return renderGenericEmbed('spotify', sourceUrl);
  }

  const type = match[1];
  const id = match[2];

  if (type === undefined || id === undefined) {
    return renderGenericEmbed('spotify', sourceUrl);
  }

  const iframeUrl = `https://open.spotify.com/embed/${type}/${id}`;

  return {
    html: `<figure class="embed embed--spotify"><iframe src="${escapeHtml(iframeUrl)}" title="Spotify ${escapeHtml(type)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe><figcaption>${renderPermanentLink(sourceUrl, '在 Spotify 查看原始內容')}</figcaption></figure>`,
    renderedAs: 'lazy-iframe',
  };
}

function renderGenericEmbed(
  provider: EmbedProvider,
  sourceUrl: string,
): RenderedEmbed {
  const providerLabel: Record<EmbedProvider, string> = {
    facebook: 'Facebook',
    generic: '原始網站',
    slideshare: 'SlideShare',
    spotify: 'Spotify',
    twitter: 'Twitter／X',
    youtube: 'YouTube',
  };
  const link = renderPermanentLink(
    sourceUrl,
    `在 ${providerLabel[provider]} 查看原始內容`,
  );

  return {
    html: `<aside class="embed embed--fallback" data-embed-provider="${provider}"><p>此第三方內容需要前往來源網站查看。</p>${link}</aside>`,
    renderedAs: sourceUrl === '' ? 'generic-fallback' : 'permanent-link',
  };
}

function renderPermanentLink(url: string, label: string): string {
  if (!isSafePublicLink(url)) {
    return `<span class="embed__missing-link">${escapeHtml(label)}（來源網址缺失）</span>`;
  }

  return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function transformHtmlFragment(
  fragment: string,
  context: TransformContext,
): string {
  const $ = load(fragment, {}, false);

  $('amp-facebook-page[data-href]').each((_index, element) => {
    const node = $(element);
    const sourceUrl = rewriteWordPressUrl(
      node.attr('data-href') ?? '',
      context.options.internalHosts,
    );
    const rendered = renderGenericEmbed('facebook', sourceUrl);

    recordEmbed(context, {
      blockName: 'raw-html/amp-facebook-page',
      provider: 'facebook',
      renderedAs: rendered.renderedAs,
      sourceUrl,
    });
    node.replaceWith(rendered.html);
  });

  $('iframe').each((_index, element) => {
    const node = $(element);
    const source = node.attr('src')?.trim() ?? '';

    if (isControlledIframe(source)) {
      return;
    }

    if (source === '') {
      context.report.warnings.push(
        'Removed a raw iframe without a source URL.',
      );
      node.remove();
      return;
    }

    const sourceUrl = rewriteWordPressUrl(
      source,
      context.options.internalHosts,
    );
    const provider = inferProviderFromUrl(sourceUrl);
    const rendered = renderEmbed(provider, sourceUrl);

    recordEmbed(context, {
      blockName: 'raw-html/iframe',
      provider,
      renderedAs: rendered.renderedAs,
      sourceUrl,
    });
    node.replaceWith(rendered.html);
  });

  sanitizeElementUrls($);
  collectMediaDependencies($, context);
  rewriteElementUrls($, context);

  $('a[target="_blank"]').each((_index, element) => {
    const node = $(element);
    const rel = new Set((node.attr('rel') ?? '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    node.attr('rel', [...rel].join(' '));
  });

  return replacePrivateOriginLiterals(
    redactPublicCredentialValues(sanitizeTransformedHtml($.html())),
    context.options.internalHosts,
  );
}

function sanitizeElementUrls($: ReturnType<typeof load>): void {
  const urlAttributes = [
    'data-href',
    'data-lazy-src',
    'data-src',
    'data-thumbnail-src',
    'href',
    'poster',
    'src',
  ];

  $('*').each((_index, element) => {
    const node = $(element);

    for (const attribute of urlAttributes) {
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

function sanitizeHtmlPreview(
  value: string,
  internalHosts: string[] = [],
): string {
  const $ = load(value, {}, false);
  sanitizeElementUrls($);

  return replacePrivateOriginLiterals(
    redactPublicCredentialValues(sanitizeTransformedHtml($.html())),
    internalHosts,
  );
}

function rewriteElementUrls(
  $: ReturnType<typeof load>,
  context: TransformContext,
): void {
  const urlAttributes = [
    'data-href',
    'data-lazy-src',
    'data-src',
    'data-thumbnail-src',
    'href',
    'poster',
    'src',
  ];

  $('*').each((_index, element) => {
    const node = $(element);

    for (const attribute of urlAttributes) {
      const value = node.attr(attribute);

      if (value !== undefined) {
        node.attr(
          attribute,
          rewriteWordPressUrl(value, context.options.internalHosts),
        );
      }
    }

    const srcset = node.attr('srcset');

    if (srcset !== undefined) {
      node.attr('srcset', rewriteSrcset(srcset, context.options.internalHosts));
    }
  });
}

function collectMediaDependencies(
  $: ReturnType<typeof load>,
  context: TransformContext,
): void {
  $('img').each((_index, element) => {
    const node = $(element);
    recordMediaAttribute(node.attr('src'), 'image', context);
    recordMediaAttribute(node.attr('data-src'), 'image', context);

    for (const candidate of parseSrcset(node.attr('srcset') ?? '')) {
      recordMediaAttribute(candidate, 'image', context);
    }
  });

  $('video').each((_index, element) => {
    const node = $(element);
    recordMediaAttribute(node.attr('src'), 'video', context);
    recordMediaAttribute(node.attr('poster'), 'poster', context);
  });

  $('audio').each((_index, element) => {
    const source = $(element).attr('src');
    recordMediaAttribute(source, 'audio', context);
  });

  $('source[src]').each((_index, element) => {
    const node = $(element);
    const source = node.attr('src');
    const kind: MediaDependencyKind =
      node.parents('audio').length > 0 ? 'audio' : 'video';
    recordMediaAttribute(source, kind, context);
  });

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');

    if (
      href !== undefined &&
      (href.includes('/wp-content/uploads/') || MEDIA_EXTENSION.test(href))
    ) {
      recordMediaAttribute(href, kindFromUrl(href), context);
    }
  });
}

function recordMediaAttribute(
  originalUrl: string | undefined,
  kind: MediaDependencyKind,
  context: TransformContext,
): void {
  if (originalUrl === undefined) {
    return;
  }

  const sanitizedUrl = sanitizePublicUrl(originalUrl);
  const rewrittenUrl = rewriteWordPressUrl(
    sanitizedUrl,
    context.options.internalHosts,
  );
  const key = `${kind}\u0000${rewrittenUrl}`;

  if (context.mediaKeys.has(key)) {
    return;
  }

  context.mediaKeys.add(key);
  const dependency: MediaDependency = {
    external: isExternalUrl(sanitizedUrl, context.internalHosts),
    kind,
    originalUrl: isExternalUrl(sanitizedUrl, context.internalHosts)
      ? sanitizedUrl
      : rewrittenUrl,
    rewrittenUrl,
  };
  context.report.mediaDependencies.push(dependency);
}

function recordEmbed(context: TransformContext, entry: EmbedReportEntry): void {
  context.report.embeds.push({
    ...entry,
    sourceUrl: sanitizePublicUrl(entry.sourceUrl),
  });
}

function getEmbedProvider(
  block: GutenbergBlock,
  sourceUrl: string,
): EmbedProvider {
  if (block.blockName?.startsWith('core-embed/')) {
    return normalizeProvider(block.blockName.slice('core-embed/'.length));
  }

  const provider = getStringAttribute(block, 'providerNameSlug');

  return provider === null
    ? inferProviderFromUrl(sourceUrl)
    : normalizeProvider(provider);
}

function inferProviderFromUrl(value: string): EmbedProvider {
  let hostname: string;

  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    return 'generic';
  }

  if (
    hostname === 'youtu.be' ||
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com')
  ) {
    return 'youtube';
  }

  if (
    hostname === 'twitter.com' ||
    hostname.endsWith('.twitter.com') ||
    hostname === 'x.com' ||
    hostname.endsWith('.x.com')
  ) {
    return 'twitter';
  }

  if (hostname === 'open.spotify.com' || hostname.endsWith('.spotify.com')) {
    return 'spotify';
  }

  if (hostname === 'slideshare.net' || hostname.endsWith('.slideshare.net')) {
    return 'slideshare';
  }

  if (hostname === 'facebook.com' || hostname.endsWith('.facebook.com')) {
    return 'facebook';
  }

  return 'generic';
}

function normalizeProvider(value: string): EmbedProvider {
  const provider = value.trim().toLowerCase();

  if (provider === 'youtube') return 'youtube';
  if (provider === 'twitter' || provider === 'x') return 'twitter';
  if (provider === 'spotify') return 'spotify';
  if (provider === 'slideshare') return 'slideshare';
  if (provider === 'facebook') return 'facebook';

  return 'generic';
}

function getStringAttribute(block: GutenbergBlock, key: string): string | null {
  const value = block.attrs?.[key];

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return null;
}

function extractFirstUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s"'<>]+/i);

  return match?.[0]?.trim() ?? null;
}

function parseYoutubeUrl(
  sourceUrl: string,
): { embedQuery: URLSearchParams; videoId: string } | null {
  let parsed: URL;

  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split('/').filter(Boolean);
  let videoId: string | null = null;

  if (hostname === 'youtu.be') {
    videoId = parts[0] ?? null;
  } else if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else if (parts[0] === 'embed' || parts[0] === 'shorts') {
      videoId = parts[1] ?? null;
    }
  }

  if (videoId === null || !/^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
    return null;
  }

  const embedQuery = new URLSearchParams();
  const list = parsed.searchParams.get('list');
  const index = parsed.searchParams.get('index');
  const start =
    parsed.searchParams.get('start') ??
    parseYoutubeTime(parsed.searchParams.get('t'));

  if (list !== null) embedQuery.set('list', list);
  if (index !== null && /^\d+$/.test(index)) embedQuery.set('index', index);
  if (start !== null && /^\d+$/.test(start)) embedQuery.set('start', start);

  return { embedQuery, videoId };
}

function parseYoutubeTime(value: string | null): string | null {
  if (value === null) return null;
  if (/^\d+$/.test(value)) return value;

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);

  if (match === null) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return String(hours * 3600 + minutes * 60 + seconds);
}

function isControlledIframe(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return (
      hostname === 'www.youtube-nocookie.com' || hostname === 'open.spotify.com'
    );
  } catch {
    return false;
  }
}

function rewriteSrcset(value: string, internalHosts: string[] = []): string {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const url = parts.shift();

      if (url === undefined) return '';

      const rewritten = rewriteWordPressUrl(
        sanitizePublicUrl(url),
        internalHosts,
      );

      return [rewritten, ...parts].join(' ');
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

function sanitizeReportAttributes(
  attributes: GutenbergAttributes,
  internalHosts: string[] = [],
): GutenbergAttributes {
  if (attributes === null) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      sanitizeReportValue(value, key, internalHosts),
    ]),
  );
}

function sanitizeReportValue(
  value: unknown,
  key = '',
  internalHosts: string[] = [],
): unknown {
  if (typeof value === 'string') {
    if (/^api[_-]?key$/i.test(key) && value.length >= 20) {
      return 'REDACTED';
    }

    if (
      /^(?:access[_-]?token|auth[_-]?token|awsaccesskeyid|bearer[_-]?token|client[_-]?secret|key-pair-id|policy|refresh[_-]?token|secret|signature|token|x-amz-credential|x-amz-security-token|x-amz-signature)$/i.test(
        key,
      ) &&
      value.length >= 12
    ) {
      return 'REDACTED';
    }

    return replacePrivateOriginLiterals(
      sanitizePublicUrl(value),
      internalHosts,
    );
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeReportValue(entry, key, internalHosts));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizeReportValue(entry, key, internalHosts),
      ]),
    );
  }

  return value;
}

function parseSrcset(value: string): string[] {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter((candidate): candidate is string => Boolean(candidate));
}

function kindFromUrl(value: string): MediaDependencyKind {
  if (/\.pdf(?:[?#]|$)/i.test(value)) return 'document';
  if (/\.(?:mp3|m4a|ogg|wav|flac)(?:[?#]|$)/i.test(value)) return 'audio';
  if (/\.(?:mp4|m4v|mov|ogv|webm)(?:[?#]|$)/i.test(value)) return 'video';

  return 'image';
}

function isSafePublicLink(value: string): boolean {
  return value.startsWith('/') || isHttpUrl(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
