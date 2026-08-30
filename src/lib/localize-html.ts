import { load } from 'cheerio';

import { withBase } from './urls';

const LOCAL_ORIGIN = 'https://local.invalid';
const PRODUCTION_HOSTS = new Set([
  'darrenhuang.com',
  'www.darrenhuang.com',
  'local.invalid',
]);

interface LocalizeTranslatedHtmlOptions {
  counterparts: ReadonlyMap<string, string>;
  sourceCanonicalPath: string;
}

function resolvedInternalUrl(
  reference: string,
  sourceCanonicalPath: string,
): URL | undefined {
  if (
    !reference ||
    reference.startsWith('#') ||
    /^(?:data|mailto|tel|javascript|blob):/iu.test(reference)
  ) {
    return undefined;
  }

  try {
    const resolved = new URL(
      reference,
      `${LOCAL_ORIGIN}${sourceCanonicalPath}`,
    );
    return PRODUCTION_HOSTS.has(resolved.hostname.toLowerCase())
      ? resolved
      : undefined;
  } catch {
    return undefined;
  }
}

function localizedReference(
  reference: string,
  sourceCanonicalPath: string,
  counterparts: ReadonlyMap<string, string>,
): { href: string; translated: boolean } | undefined {
  const resolved = resolvedInternalUrl(reference, sourceCanonicalPath);
  if (!resolved) return undefined;

  const counterpart = counterparts.get(resolved.pathname);
  const pathname = counterpart ?? resolved.pathname;
  return {
    href: `${withBase(pathname)}${resolved.search}${resolved.hash}`,
    translated: counterpart !== undefined,
  };
}

function localizedAssetReference(
  reference: string,
  sourceCanonicalPath: string,
): string | undefined {
  const resolved = resolvedInternalUrl(reference, sourceCanonicalPath);
  if (!resolved) return undefined;
  return `${withBase(resolved.pathname)}${resolved.search}${resolved.hash}`;
}

function localizedSrcset(value: string, sourceCanonicalPath: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const [reference, ...descriptor] = candidate.trim().split(/\s+/u);
      if (!reference) return candidate;
      const localized = localizedAssetReference(reference, sourceCanonicalPath);
      return [localized ?? reference, ...descriptor].join(' ');
    })
    .join(', ');
}

export function localizeTranslatedHtml(
  html: string,
  options: LocalizeTranslatedHtmlOptions,
): string {
  const $ = load(html, null, false);

  $('[src], [poster]').each((_index, element) => {
    for (const attribute of ['src', 'poster'] as const) {
      const value = $(element).attr(attribute);
      if (!value) continue;
      const localized = localizedAssetReference(
        value,
        options.sourceCanonicalPath,
      );
      if (localized) $(element).attr(attribute, localized);
    }
  });

  $('[srcset]').each((_index, element) => {
    const value = $(element).attr('srcset');
    if (value) {
      $(element).attr(
        'srcset',
        localizedSrcset(value, options.sourceCanonicalPath),
      );
    }
  });

  $('a[href]').each((_index, element) => {
    const anchor = $(element);
    const href = anchor.attr('href');
    if (!href) return;
    const localized = localizedReference(
      href,
      options.sourceCanonicalPath,
      options.counterparts,
    );
    if (!localized) return;
    anchor.attr('href', localized.href);
    if (!localized.translated && /\.html(?:$|[?#])/u.test(localized.href)) {
      anchor.attr('lang', 'zh-Hant');
    }
  });

  return $.html().trim();
}
