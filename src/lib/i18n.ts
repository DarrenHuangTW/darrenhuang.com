import {
  DEFAULT_LOCALE,
  LOCALE_METADATA,
  SUPPORTED_LOCALES,
  TAXONOMY_TRANSLATIONS,
  type Locale,
  type LocaleMetadata,
  type TaxonomyKind,
} from '../i18n/config';
import { slugifyTaxonomy } from './taxonomy';

const basePath = normalizeBasePath(import.meta.env.BASE_URL);
const localizedInterfacePaths = new Set([
  '/',
  '/about.html',
  '/articles.html',
  '/categories.html',
  '/contact.html',
  '/developers.html',
  '/membership.html',
  '/notes.html',
  '/privacy.html',
  '/tags.html',
  '/web-stories.html',
]);

function normalizeBasePath(value: string): string {
  const normalized = `/${value.replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

function splitPathSuffix(path: string): [pathname: string, suffix: string] {
  const suffixIndex = path.search(/[?#]/u);
  return suffixIndex === -1
    ? [path, '']
    : [path.slice(0, suffixIndex), path.slice(suffixIndex)];
}

function withoutBase(pathname: string): string {
  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  return pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname;
}

function withoutLocalePrefix(pathname: string): string {
  const normalized = `/${pathname.replace(/^\/+/, '')}`;

  for (const locale of SUPPORTED_LOCALES) {
    const prefix = localePrefix(locale);
    if (!prefix) continue;
    if (normalized === prefix) return '/';
    if (normalized.startsWith(`${prefix}/`)) {
      return normalized.slice(prefix.length);
    }
  }

  return normalized;
}

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function localeFromPathname(pathname: string): Locale {
  const [pathWithoutSuffix] = splitPathSuffix(pathname);
  const sitePath = withoutBase(pathWithoutSuffix || '/');
  const firstSegment = sitePath.replace(/^\/+/, '').split('/')[0] ?? '';

  return (
    SUPPORTED_LOCALES.find(
      (locale) => LOCALE_METADATA[locale].urlPrefix === firstSegment,
    ) ?? DEFAULT_LOCALE
  );
}

export function localePrefix(locale: Locale): string {
  const prefix = LOCALE_METADATA[locale].urlPrefix;
  return prefix ? `/${prefix}` : '';
}

export function localizedPath(path: string, locale: Locale): string {
  if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/iu.test(path)) return path;

  const [pathname, suffix] = splitPathSuffix(path);
  const sitePath = withoutLocalePrefix(withoutBase(pathname || '/'));
  const prefix = localePrefix(locale);
  const localized = `${prefix}${sitePath === '/' ? '/' : sitePath}`;
  const withBase = `${basePath}${localized}` || '/';

  return `${withBase}${suffix}`;
}

export function formatLocalizedDate(
  value: Date | number | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'long',
    timeZone: 'Asia/Taipei',
  },
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(
    LOCALE_METADATA[locale].dateLocale,
    options,
  ).format(date);
}

export function getLocaleMetadata(locale: Locale): LocaleMetadata {
  return LOCALE_METADATA[locale];
}

export function interfaceAlternates(
  canonicalPath: string,
): Partial<Record<Locale, string>> {
  const [pathname] = splitPathSuffix(canonicalPath);
  const sitePath = withoutLocalePrefix(withoutBase(pathname || '/'));
  if (!localizedInterfacePaths.has(sitePath)) return {};

  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      `${localePrefix(locale)}${sitePath === '/' ? '/' : sitePath}`,
    ]),
  ) as Partial<Record<Locale, string>>;
}

export function taxonomyAlternates(
  kind: TaxonomyKind,
  label: string,
): Partial<Record<Locale, string>> {
  const translations = TAXONOMY_TRANSLATIONS.en[kind];
  const entries = Object.entries(translations);
  const match = entries.find(
    ([sourceLabel, englishLabel]) =>
      label === sourceLabel || label === englishLabel,
  );
  if (!match) return {};

  const [sourceLabel, englishLabel] = match;
  return {
    'zh-hant': `/${kind}/${slugifyTaxonomy(sourceLabel)}.html`,
    en: `/en/${kind}/${slugifyTaxonomy(englishLabel)}.html`,
  };
}
