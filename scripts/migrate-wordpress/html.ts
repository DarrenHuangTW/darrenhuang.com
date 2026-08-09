import path from 'node:path';
import { load } from 'cheerio';
import { decode } from 'html-entities';
import { PRODUCTION_SITE_URL } from '../../site.config';
import type { PublishedMediaFile } from './media';

export interface InternalLinkRewriteResult {
  html: string;
  unresolved: string[];
}

export function plainTextExcerpt(html: string, maximumLength = 220): string {
  const $ = load(html, null, false);
  const text = decode($.root().text())
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .trim();
  if (text.length <= maximumLength) return text;

  const clipped = text.slice(0, maximumLength + 1);
  const boundary = Math.max(
    clipped.lastIndexOf('。'),
    clipped.lastIndexOf(' '),
  );
  return `${clipped.slice(0, boundary > maximumLength * 0.6 ? boundary + 1 : maximumLength).trim()}…`;
}

export function internalLinkLookupKey(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Preserve literal percent sequences from old Blogger permalinks.
  }
  return decoded
    .replaceAll('\\', '/')
    .replace(/^\.?\/+|\/+$/g, '')
    .normalize('NFC')
    .toLocaleLowerCase('en-US');
}

export function rewriteInternalContentLinks(options: {
  html: string;
  redirects: Map<string, string>;
  excludedSlugs: Set<string>;
  internalHosts?: string[];
}): InternalLinkRewriteResult {
  const $ = load(options.html, null, false);
  const unresolved = new Set<string>();
  const internalHosts = new Set([
    '127.0.0.1',
    'darrenhuang.com',
    'member.darrenhuang.com',
    'www.darrenhuang.com',
    ...(options.internalHosts ?? []).map((host) => host.toLowerCase()),
  ]);

  $('a[href]').each((_index, element) => {
    const anchor = $(element);
    const sourceHref = anchor.attr('href')?.trim();
    if (!sourceHref || sourceHref.startsWith('#')) return;
    if (/^https?:\/\/[^/]*\s/i.test(sourceHref)) {
      anchor.replaceWith(anchor.contents());
      unresolved.add(sourceHref);
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(
        sourceHref.startsWith('//') ? `https:${sourceHref}` : sourceHref,
        `${PRODUCTION_SITE_URL}/`,
      );
    } catch {
      anchor.replaceWith(anchor.contents());
      unresolved.add(sourceHref);
      return;
    }

    const explicitlyExternal =
      /^(?:https?:)?\/\//i.test(sourceHref) &&
      !internalHosts.has(parsed.hostname.toLowerCase());
    if (explicitlyExternal || !['http:', 'https:'].includes(parsed.protocol))
      return;

    const pathKey = internalLinkLookupKey(parsed.pathname);
    if (pathKey.startsWith('wp-content/uploads/')) return;
    if (/^(?:wp-admin|wp-login\.php)(?:\/|$)/i.test(pathKey)) {
      anchor.replaceWith(anchor.contents());
      unresolved.add(sourceHref);
      return;
    }
    if (pathKey === 'membership' || pathKey === '會員登入') {
      anchor.attr('href', './about.html');
      return;
    }
    if (parsed.searchParams.has('attachment_id')) {
      anchor.replaceWith(anchor.contents());
      unresolved.add(sourceHref);
      return;
    }

    const storyMatch = /^stories\/([^/]+)$/.exec(pathKey);
    if (storyMatch?.[1]) {
      anchor.attr('href', `./web-stories/${storyMatch[1]}/`);
      return;
    }

    const basename = path.posix.basename(pathKey).replace(/\.html$/i, '');
    const mapped =
      options.redirects.get(pathKey) ??
      options.redirects.get(pathKey.replace(/\.html$/i, '')) ??
      options.redirects.get(basename);
    if (mapped) {
      anchor.attr('href', `.${mapped}${parsed.search}${parsed.hash}`);
      return;
    }

    if (
      options.excludedSlugs.has(basename) ||
      /^\d{4}\/\d{2}\//.test(pathKey)
    ) {
      anchor.replaceWith(anchor.contents());
      unresolved.add(sourceHref);
    }
  });

  return { html: $.html().trim(), unresolved: [...unresolved].sort() };
}

function dependencyPath(rawValue: string): string {
  let value = rawValue.split('#', 1)[0]!.split('?', 1)[0]!;
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep literal percent sequences when a historical filename is not URL encoded correctly.
  }
  return value.normalize('NFC');
}

export function enrichLocalMediaHtml(
  html: string,
  mediaFiles: PublishedMediaFile[],
): string {
  const byPath = new Map(
    mediaFiles.map((file) => [file.path.normalize('NFC'), file]),
  );
  const $ = load(html, null, false);

  $('img').each((_index, element) => {
    const image = $(element);
    const src = image.attr('src');
    if (!src) return;
    const media = byPath.get(dependencyPath(src));

    image.attr('loading', image.attr('loading') ?? 'lazy');
    image.attr('decoding', image.attr('decoding') ?? 'async');
    if (media?.width && !image.attr('width'))
      image.attr('width', String(media.width));
    if (media?.height && !image.attr('height'))
      image.attr('height', String(media.height));
    if (image.attr('alt') === undefined) image.attr('alt', '');
  });

  $('video').each((_index, element) => {
    const video = $(element);
    video.attr('controls', '');
    video.attr('playsinline', '');
    video.attr('preload', video.attr('preload') ?? 'metadata');
  });

  $('audio').each((_index, element) => {
    const audio = $(element);
    audio.attr('controls', '');
    audio.attr('preload', audio.attr('preload') ?? 'metadata');
  });

  for (const attribute of ['href', 'poster', 'src']) {
    $(`[${attribute}]`).each((_index, element) => {
      const current = $(element).attr(attribute);
      if (current?.startsWith('/') && !current.startsWith('//')) {
        $(element).attr(attribute, `.${current}`);
      }
    });
  }

  $('[srcset]').each((_index, element) => {
    const srcset = $(element).attr('srcset');
    if (!srcset) return;
    $(element).attr(
      'srcset',
      srcset
        .split(',')
        .map((candidate) => candidate.trim().replace(/^\/(?!\/)/, './'))
        .join(', '),
    );
  });

  $('[style]').each((_index, element) => {
    const style = $(element).attr('style');
    if (!style) return;
    $(element).attr(
      'style',
      style.replace(/url\((['"]?)\/(?!\/)/gi, 'url($1./'),
    );
  });

  $('[data-full-url], [data-link]').each((_index, element) => {
    $(element).removeAttr('data-full-url').removeAttr('data-link');
  });
  $('[data-id]').each((_index, element) => {
    const dataId = $(element).attr('data-id');
    if (dataId && /^https?:\/\//i.test(dataId))
      $(element).removeAttr('data-id');
  });

  return $.html()
    .replace(
      /https?:\/\/(?:127\.0\.0\.1|(?:www\.|member\.)?darrenhuang\.com)\/wp-content\/uploads\//gi,
      './wp-content/uploads/',
    )
    .replace(
      /https?:\/\/(?:127\.0\.0\.1|www\.darrenhuang\.com)/gi,
      PRODUCTION_SITE_URL,
    )
    .trim();
}

export function makeStoryAssetsBasePortable(html: string): string {
  return html
    .replace(
      /https?:\/\/(?:127\.0\.0\.1|(?:www\.|member\.)?darrenhuang\.com)(?=\/wp-content\/uploads\/)/gi,
      '',
    )
    .replace(
      /(^|[="'(\s,])\/wp-content\/uploads\//g,
      '$1../../wp-content/uploads/',
    )
    .replace(/(^|[="'(\s,])\/story-media\//g, '$1../../story-media/')
    .replace(/(^|[="'(\s,])\/favicon\.svg/g, '$1../../favicon.svg')
    .replace(/href="\/"/g, 'href="../../"');
}

export function normalizePublishedDate(localWordPressDate: string): string {
  const match = localWordPressDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match)
    throw new Error(`Invalid WordPress local date: ${localWordPressDate}`);
  return match[1]!;
}

export function safeDecodeSlug(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // Preserve a historical slug with literal percent sequences.
  }

  const normalized = decoded.normalize('NFC').replace(/^\/+|\/+$/g, '');
  if (
    !normalized ||
    normalized.includes('/') ||
    normalized === '.' ||
    normalized === '..'
  ) {
    throw new Error(`Unsafe WordPress slug: ${value}`);
  }
  return normalized;
}

export function normalizeMediaDependency(value: string): string | null {
  const pathOnly = dependencyPath(value);
  const marker = '/wp-content/uploads/';
  const index = pathOnly.indexOf(marker);
  return index >= 0 ? pathOnly.slice(index) : null;
}
