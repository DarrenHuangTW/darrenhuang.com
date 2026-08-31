import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

function publishedOnly<T extends { data: { status: string } }>(entry: T) {
  return entry.data.status === 'published' || process.env.I18N_PREVIEW === '1';
}

export type LocalizedNote = {
  source: CollectionEntry<'notes'>;
  translation: CollectionEntry<'noteTranslations'>;
};

export type LocalizedStory = {
  source: CollectionEntry<'stories'>;
  translation: CollectionEntry<'storyTranslations'>;
};

export function englishNoteView(route: LocalizedNote) {
  const { source, translation } = route;
  return {
    ...source,
    data: {
      ...source.data,
      ...translation.data,
      canonicalPath: `/en/notes/${translation.data.slug}.html`,
      publishedAt: source.data.publishedAt,
      updatedAt: source.data.updatedAt,
      editorialStatus: source.data.editorialStatus,
    },
  };
}

export async function getEnglishNoteRoutes(): Promise<LocalizedNote[]> {
  const [sources, translations] = await Promise.all([
    getCollection('notes', ({ data }) => data.editorialStatus !== 'excluded'),
    getCollection('noteTranslations', publishedOnly),
  ]);
  const sourceBySlug = new Map(
    sources.map((entry) => [entry.data.slug, entry]),
  );
  const keys = new Set<string>();
  return translations.map((translation) => {
    const source = sourceBySlug.get(translation.data.sourceId);
    if (!source)
      throw new Error(
        `English note ${translation.id} references missing note ${translation.data.sourceId}.`,
      );
    if (translation.data.translationKey !== `note:${source.data.slug}`) {
      throw new Error(
        `English note ${translation.id} has an inconsistent translationKey.`,
      );
    }
    if (keys.has(translation.data.translationKey))
      throw new Error(
        `Duplicate English note translation key: ${translation.data.translationKey}.`,
      );
    keys.add(translation.data.translationKey);
    return { source, translation };
  });
}

export async function getEnglishStoryRoutes(): Promise<LocalizedStory[]> {
  const [sources, translations] = await Promise.all([
    getCollection('stories'),
    getCollection('storyTranslations', publishedOnly),
  ]);
  const sourceBySlug = new Map(
    sources.map((entry) => [entry.data.slug, entry]),
  );
  const keys = new Set<string>();
  return translations.map((translation) => {
    const source = sourceBySlug.get(translation.data.sourceId);
    if (!source)
      throw new Error(
        `English story ${translation.id} references missing story ${translation.data.sourceId}.`,
      );
    if (translation.data.translationKey !== `story:${source.data.slug}`) {
      throw new Error(
        `English story ${translation.id} has an inconsistent translationKey.`,
      );
    }
    if (keys.has(translation.data.translationKey))
      throw new Error(
        `Duplicate English story translation key: ${translation.data.translationKey}.`,
      );
    keys.add(translation.data.translationKey);
    return { source, translation };
  });
}
