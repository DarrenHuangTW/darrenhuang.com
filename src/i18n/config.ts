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

const ENGLISH_CATEGORY_LABELS = {
  工作心得: 'Career Reflections',
  SEO電子報: 'SEO Newsletter',
  SEO相關: 'SEO',
  內容策略: 'Content Strategy',
  分析: 'Analytics',
  工具: 'Tools',
  搜尋: 'Search',
  網站技術: 'Web Technology',
  AI: 'AI',
  Uncategorized: 'Uncategorized',
} as const;

const ENGLISH_TAG_LABELS = {
  SEO相關: 'SEO',
  SEO電子報: 'SEO Newsletter',
  工作心得: 'Career Reflections',
  Uncategorized: 'Uncategorized',
  SEO實驗: 'SEO Experiments',
  使用者體驗: 'User Experience',
  內容品質: 'Content Quality',
  內部連結: 'Internal Links',
  可及性: 'Accessibility',
  '圖片 SEO': 'Image SEO',
  學習: 'Learning',
  '技術 SEO': 'Technical SEO',
  搜尋引擎: 'Search Engines',
  搜尋摘要: 'Search Snippets',
  效能: 'Performance',
  機器學習: 'Machine Learning',
  檢索: 'Retrieval',
  渲染: 'Rendering',
  '生成式 AI': 'Generative AI',
  產品文案: 'Product Copy',
  索引: 'Indexing',
  網站品質: 'Site Quality',
  網站基礎: 'Web Fundamentals',
  翻譯工具: 'Translation Tools',
  職涯: 'Career',
  自動化: 'Automation',
  資安: 'Security',
  資訊檢索: 'Information Retrieval',
  轉址: 'Redirects',
  轉換率: 'Conversion Rate',
  重複內容: 'Duplicate Content',
  電商: 'E-commerce',
  '電商 SEO': 'E-commerce SEO',
} as const;

export const TAXONOMY_TRANSLATIONS = {
  en: {
    categories: ENGLISH_CATEGORY_LABELS,
    tags: ENGLISH_TAG_LABELS,
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
