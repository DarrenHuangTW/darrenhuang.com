export const SUPPORTED_LOCALES = ['zh-hant', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleMetadata {
  brandByline: string;
  dateLocale: string;
  htmlLang: string;
  label: string;
  ogLocale: string;
  siteName: string;
  urlPrefix: string;
}

export const DEFAULT_LOCALE: Locale = 'zh-hant';

export type TaxonomyKind = 'categories' | 'tags';

const ENGLISH_TAXONOMY_LABELS = {
  工作心得: 'Career Reflections',
  SEO電子報: 'SEO Newsletter',
  SEO相關: 'SEO',
  Uncategorized: 'Uncategorized',
} as const;

export const TAXONOMY_TRANSLATIONS = {
  en: {
    categories: ENGLISH_TAXONOMY_LABELS,
    tags: ENGLISH_TAXONOMY_LABELS,
  },
} as const;

export const LOCALE_METADATA = {
  'zh-hant': {
    brandByline: 'by Darren Huang',
    dateLocale: 'zh-TW',
    htmlLang: 'zh-Hant',
    label: '繁體中文',
    ogLocale: 'zh_TW',
    siteName: '數位引擎',
    urlPrefix: '',
  },
  en: {
    brandByline: 'by Darren Huang',
    dateLocale: 'en-US',
    htmlLang: 'en',
    label: 'English',
    ogLocale: 'en_US',
    siteName: 'Digital Engine',
    urlPrefix: 'en',
  },
} as const satisfies Record<Locale, LocaleMetadata>;
