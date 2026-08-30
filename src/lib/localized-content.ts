import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

export type ContentLocale = 'zh-hant' | 'en';

export interface LocalizedPostData {
  slug: string;
  canonicalPath: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
  updatedAt: Date;
  categories: string[];
  tags: string[];
  featuredMedia: CollectionEntry<'posts'>['data']['featuredMedia'];
  translationKey: string;
  translationStatus: 'source' | 'draft' | 'review' | 'published';
}

export interface LocalizedPost {
  id: string;
  data: LocalizedPostData;
  source: CollectionEntry<'posts'>;
  translation?: CollectionEntry<'postTranslations'>;
}

export interface EnglishPostRoute {
  post: LocalizedPost;
  source: CollectionEntry<'posts'>;
  translation: CollectionEntry<'postTranslations'>;
}

const ENGLISH_INTERFACE_PATHS = [
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
] as const;

function previewTranslationsEnabled(): boolean {
  return process.env.I18N_PREVIEW === '1';
}

function includeTranslation(
  translation: CollectionEntry<'postTranslations'>,
): boolean {
  return (
    translation.data.status === 'published' || previewTranslationsEnabled()
  );
}

function sourcePostView(source: CollectionEntry<'posts'>): LocalizedPost {
  return {
    id: source.id,
    source,
    data: {
      slug: source.data.slug,
      canonicalPath: source.data.canonicalPath,
      title: source.data.title,
      excerpt: source.data.excerpt,
      publishedAt: source.data.publishedAt,
      updatedAt: source.data.updatedAt,
      categories: source.data.categories,
      tags: source.data.tags,
      featuredMedia: source.data.featuredMedia,
      translationKey: `post:${source.data.slug}`,
      translationStatus: 'source',
    },
  };
}

function translatedPostView(
  source: CollectionEntry<'posts'>,
  translation: CollectionEntry<'postTranslations'>,
): LocalizedPost {
  const featuredMedia = source.data.featuredMedia
    ? {
        ...source.data.featuredMedia,
        alt: translation.data.featuredMediaAlt ?? '',
      }
    : null;

  return {
    id: translation.id,
    source,
    translation,
    data: {
      slug: translation.data.slug,
      canonicalPath: `/en/${translation.data.slug}.html`,
      title: translation.data.title,
      excerpt: translation.data.excerpt,
      publishedAt: source.data.publishedAt,
      updatedAt: source.data.updatedAt,
      categories: translation.data.categories,
      tags: translation.data.tags,
      featuredMedia,
      translationKey: translation.data.translationKey,
      translationStatus: translation.data.status,
    },
  };
}

export async function getEnglishPostRoutes(): Promise<EnglishPostRoute[]> {
  const [sources, translations] = await Promise.all([
    getCollection('posts'),
    getCollection('postTranslations', includeTranslation),
  ]);
  const sourceBySlug = new Map(sources.map((post) => [post.data.slug, post]));
  const seenKeys = new Set<string>();

  return translations.map((translation) => {
    const { sourceId, translationKey } = translation.data;
    const source = sourceBySlug.get(sourceId);
    if (!source) {
      throw new Error(
        `English translation ${translation.id} references missing post ${sourceId}.`,
      );
    }
    if (translationKey !== `post:${sourceId}`) {
      throw new Error(
        `English translation ${translation.id} has inconsistent translationKey ${translationKey}.`,
      );
    }
    if (seenKeys.has(translationKey)) {
      throw new Error(`Duplicate English translation key: ${translationKey}.`);
    }
    seenKeys.add(translationKey);

    return {
      post: translatedPostView(source, translation),
      source,
      translation,
    };
  });
}

export async function getLocalizedPostsNewestFirst(
  locale: ContentLocale,
): Promise<LocalizedPost[]> {
  const posts =
    locale === 'en'
      ? (await getEnglishPostRoutes()).map(({ post }) => post)
      : (await getCollection('posts')).map(sourcePostView);

  return posts.toSorted(
    (left, right) =>
      right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export async function getEnglishCounterparts(): Promise<Map<string, string>> {
  const counterparts = new Map<string, string>();
  for (const sourcePath of ENGLISH_INTERFACE_PATHS) {
    counterparts.set(
      sourcePath,
      sourcePath === '/' ? '/en/' : `/en${sourcePath}`,
    );
  }
  for (const { post, source } of await getEnglishPostRoutes()) {
    counterparts.set(source.data.canonicalPath, post.data.canonicalPath);
  }
  return counterparts;
}

export function isTranslationReview(post: LocalizedPost): boolean {
  return ['draft', 'review'].includes(post.data.translationStatus);
}
