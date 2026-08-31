import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { load } from 'cheerio';
import matter from 'gray-matter';

import {
  SUPPORTED_LOCALES,
  TAXONOMY_TRANSLATIONS,
} from '../../src/i18n/config';

interface TranslationData {
  categories?: unknown;
  featuredMediaAlt?: unknown;
  locale?: unknown;
  reviewedAt?: unknown;
  sourceHash?: unknown;
  sourceId?: unknown;
  status?: unknown;
  tags?: unknown;
  slug?: unknown;
  translationKey?: unknown;
}

const root = process.cwd();
const sourceDirectory = path.join(root, 'src', 'content', 'posts');
const translationDirectory = path.join(
  root,
  'src',
  'content',
  'post-translations',
);
const noteSourceDirectory = path.join(root, 'src', 'content', 'notes');
const noteTranslationDirectory = path.join(
  root,
  'src',
  'content',
  'note-translations',
);
const storySourceDirectory = path.join(root, 'src', 'content', 'stories');
const storyTranslationDirectory = path.join(
  root,
  'src',
  'content',
  'story-translations',
);
const failures: string[] = [];

function check(condition: unknown, message: string): condition is true {
  if (!condition) failures.push(message);
  return Boolean(condition);
}

async function walkMarkdownFiles(directory: string): Promise<string[]> {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(absolute)));
    } else if (entry.isFile() && /\.mdx?$/u.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
}

function normalizedSourceHash(raw: string): string {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const translatableSource = {
    canonicalPath: data.canonicalPath,
    categories: data.categories,
    excerpt: data.excerpt,
    featuredMedia: data.featuredMedia,
    publishedAt: data.publishedAt,
    tags: data.tags,
    title: data.title,
    updatedAt: data.updatedAt,
    body: parsed.content.replaceAll('\r\n', '\n').trim(),
  };

  return createHash('sha256')
    .update(JSON.stringify(translatableSource))
    .digest('hex');
}

function normalizedNoteSourceHash(raw: string): string {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const translatableSource = {
    canonicalPath: data.canonicalPath,
    categories: data.categories,
    excerpt: data.excerpt,
    publishedAt: data.publishedAt,
    tags: data.tags,
    title: data.title,
    updatedAt: data.updatedAt,
    body: parsed.content.replaceAll('\r\n', '\n').trim(),
  };

  return createHash('sha256')
    .update(JSON.stringify(translatableSource))
    .digest('hex');
}

function normalizedStorySourceHash(raw: string): string {
  return createHash('sha256')
    .update(JSON.stringify(JSON.parse(raw)))
    .digest('hex');
}

function attributeValues(
  html: string,
  selector: string,
  attribute: string,
): string[] {
  const $ = load(html, null, false);
  return $(selector)
    .map((_index, element) => $(element).attr(attribute) ?? '')
    .get();
}

async function sourceFileFor(sourceId: string): Promise<string | undefined> {
  for (const extension of ['md', 'mdx']) {
    const candidate = path.join(sourceDirectory, `${sourceId}.${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function sourceFileForDirectory(
  directory: string,
  sourceId: string,
): Promise<string | undefined> {
  for (const extension of ['md', 'mdx']) {
    const candidate = path.join(directory, `${sourceId}.${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const files = await walkMarkdownFiles(translationDirectory);
const translationKeys = new Set<string>();
let publishedCount = 0;
let reviewCount = 0;

for (const file of files) {
  const relative = path
    .relative(translationDirectory, file)
    .replaceAll('\\', '/');
  const localeDirectory = relative.split('/')[0] ?? '';
  const raw = await readFile(file, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as TranslationData;
  const label = `post-translations/${relative}`;

  if (
    typeof data.locale !== 'string' ||
    !SUPPORTED_LOCALES.includes(
      data.locale as (typeof SUPPORTED_LOCALES)[number],
    ) ||
    data.locale === 'zh-hant'
  ) {
    failures.push(`${label}: locale must be a supported non-default locale.`);
  } else if (data.locale !== localeDirectory) {
    failures.push(
      `${label}: locale ${data.locale} must match directory ${localeDirectory}.`,
    );
  }

  if (typeof data.sourceId !== 'string' || data.sourceId.length === 0) {
    failures.push(`${label}: sourceId is required.`);
    continue;
  }

  const expectedKey = `post:${data.sourceId}`;
  if (data.translationKey !== expectedKey) {
    failures.push(`${label}: translationKey must be ${expectedKey}.`);
  } else if (translationKeys.has(expectedKey)) {
    failures.push(`${label}: duplicate translationKey ${expectedKey}.`);
  } else {
    translationKeys.add(expectedKey);
  }

  if (data.slug !== data.sourceId) {
    failures.push(`${label}: slug must remain identical to sourceId.`);
  }

  const sourceFile = await sourceFileFor(data.sourceId);
  if (!sourceFile) {
    failures.push(`${label}: source post ${data.sourceId} does not exist.`);
    continue;
  }

  const sourceRaw = await readFile(sourceFile, 'utf8');
  const sourceParsed = matter(sourceRaw);
  const sourceData = sourceParsed.data as Record<string, unknown>;

  if (data.locale === 'en') {
    for (const kind of ['categories', 'tags'] as const) {
      const sourceLabels = sourceData[kind];
      const translatedLabels = data[kind];
      const mapping = TAXONOMY_TRANSLATIONS.en[kind] as Record<string, string>;
      if (
        !Array.isArray(sourceLabels) ||
        !sourceLabels.every((label) => typeof label === 'string') ||
        !Array.isArray(translatedLabels) ||
        !translatedLabels.every((label) => typeof label === 'string')
      ) {
        failures.push(`${label}: ${kind} must be string arrays.`);
        continue;
      }
      const expectedLabels = sourceLabels.map(
        (sourceLabel) => mapping[sourceLabel],
      );
      if (expectedLabels.some((expectedLabel) => !expectedLabel)) {
        failures.push(
          `${label}: ${kind} contains a source label without an English taxonomy mapping.`,
        );
      } else if (
        JSON.stringify(translatedLabels) !== JSON.stringify(expectedLabels)
      ) {
        failures.push(
          `${label}: translated ${kind} must follow the shared English taxonomy mapping.`,
        );
      }
    }
  }

  const $ = load(parsed.content, null, false);
  $('img').each((_index, element) => {
    const alt = $(element).attr('alt');
    if (alt === undefined || alt.trim().length === 0) {
      failures.push(
        `${label}: every translated img must include meaningful English alt text.`,
      );
    } else if (/\p{Script=Han}/u.test(alt)) {
      failures.push(`${label}: translated img alt text must be English.`);
    }
  });

  if (
    sourceData.featuredMedia !== null &&
    (typeof data.featuredMediaAlt !== 'string' ||
      data.featuredMediaAlt.trim().length === 0)
  ) {
    failures.push(
      `${label}: a source featured image requires featuredMediaAlt in English.`,
    );
  }

  for (const [selector, attribute] of [
    ['img', 'src'],
    ['a', 'href'],
  ] as const) {
    const sourceValues = attributeValues(
      sourceParsed.content,
      selector,
      attribute,
    );
    const translatedValues = attributeValues(
      parsed.content,
      selector,
      attribute,
    );
    if (JSON.stringify(sourceValues) !== JSON.stringify(translatedValues)) {
      failures.push(
        `${label}: translated ${selector}[${attribute}] values must preserve source order and URLs.`,
      );
    }
  }

  if (data.status === 'published') {
    publishedCount += 1;
    const expectedHash = normalizedSourceHash(sourceRaw);
    if (data.sourceHash !== expectedHash) {
      failures.push(
        `${label}: published translation is stale; expected sourceHash ${expectedHash}.`,
      );
    }
    if (data.reviewedAt === undefined) {
      failures.push(`${label}: published translation requires reviewedAt.`);
    }
  } else if (data.status === 'review' || data.status === 'draft') {
    reviewCount += 1;
  } else {
    failures.push(`${label}: status must be draft, review, or published.`);
  }
}

async function verifyNoteTranslations(): Promise<{
  published: number;
  reviewed: number;
}> {
  const sourceFiles = await walkMarkdownFiles(noteSourceDirectory);
  const publishedSources = new Set<string>();
  for (const sourceFile of sourceFiles) {
    const sourceData = matter(await readFile(sourceFile, 'utf8'))
      .data as Record<string, unknown>;
    if (sourceData.editorialStatus === 'published') {
      const sourceId = sourceData.slug;
      if (typeof sourceId === 'string') publishedSources.add(sourceId);
    }
  }

  const translationFiles = await walkMarkdownFiles(noteTranslationDirectory);
  const translationKeys = new Set<string>();
  let published = 0;
  let reviewed = 0;

  for (const file of translationFiles) {
    const relative = path
      .relative(noteTranslationDirectory, file)
      .replaceAll('\\', '/');
    const label = `note-translations/${relative}`;
    const raw = await readFile(file, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const sourceId = data.sourceId;

    if (data.locale !== 'en') {
      failures.push(`${label}: locale must be en.`);
    }
    if (typeof sourceId !== 'string' || sourceId.length === 0) {
      failures.push(`${label}: sourceId is required.`);
      continue;
    }

    const expectedKey = `note:${sourceId}`;
    if (data.translationKey !== expectedKey) {
      failures.push(`${label}: translationKey must be ${expectedKey}.`);
    } else if (translationKeys.has(expectedKey)) {
      failures.push(`${label}: duplicate translationKey ${expectedKey}.`);
    } else {
      translationKeys.add(expectedKey);
    }

    if (data.slug !== sourceId) {
      failures.push(`${label}: slug must remain identical to sourceId.`);
    }

    const sourceFile = await sourceFileForDirectory(
      noteSourceDirectory,
      sourceId,
    );
    if (!sourceFile) {
      failures.push(`${label}: source note ${sourceId} does not exist.`);
      continue;
    }
    const sourceRaw = await readFile(sourceFile, 'utf8');
    const sourceParsed = matter(sourceRaw);
    const sourceData = sourceParsed.data as Record<string, unknown>;
    if (sourceData.editorialStatus !== 'published') {
      failures.push(
        `${label}: translations may only reference published notes.`,
      );
    }

    const status = data.status;
    if (status === 'published') {
      published += 1;
      if (data.sourceHash !== normalizedNoteSourceHash(sourceRaw)) {
        failures.push(`${label}: published translation is stale.`);
      }
      if (data.reviewedAt === undefined) {
        failures.push(`${label}: published translation requires reviewedAt.`);
      }
    } else if (status === 'review' || status === 'draft') {
      reviewed += 1;
    } else {
      failures.push(`${label}: status must be draft, review, or published.`);
    }

    if (
      typeof data.originalFacebookTagline !== 'string' ||
      data.originalFacebookTagline.trim().length === 0
    ) {
      failures.push(`${label}: originalFacebookTagline is required.`);
    }

    const $ = load(parsed.content, null, false);
    $('img').each((_index, element) => {
      const alt = $(element).attr('alt');
      if (!alt?.trim()) {
        failures.push(`${label}: every translated img needs English alt text.`);
      } else if (/\p{Script=Han}/u.test(alt)) {
        failures.push(`${label}: translated img alt text must be English.`);
      }
    });
    if (
      attributeValues(sourceParsed.content, 'img', 'src').length !==
      attributeValues(parsed.content, 'img', 'src').length
    ) {
      failures.push(
        `${label}: translated image count must match the source note.`,
      );
    }
  }

  check(
    published === publishedSources.size,
    `English notes must publish one translation for each of the ${publishedSources.size} published source notes.`,
  );
  return { published, reviewed };
}

async function verifyStoryTranslations(): Promise<{
  published: number;
  reviewed: number;
}> {
  const sourceFiles = (await readdir(storySourceDirectory)).filter((file) =>
    file.endsWith('.json'),
  );
  const publishedSources = new Set<string>();
  for (const file of sourceFiles) {
    const source = JSON.parse(
      await readFile(path.join(storySourceDirectory, file), 'utf8'),
    ) as Record<string, unknown>;
    if (typeof source.slug === 'string') publishedSources.add(source.slug);
  }

  const translationFiles = await walkMarkdownFiles(storyTranslationDirectory);
  const translationKeys = new Set<string>();
  let published = 0;
  let reviewed = 0;

  for (const file of translationFiles) {
    const relative = path
      .relative(storyTranslationDirectory, file)
      .replaceAll('\\', '/');
    const label = `story-translations/${relative}`;
    const raw = await readFile(file, 'utf8');
    const data = matter(raw).data as Record<string, unknown>;
    const sourceId = data.sourceId;

    if (data.locale !== 'en') failures.push(`${label}: locale must be en.`);
    if (typeof sourceId !== 'string' || sourceId.length === 0) {
      failures.push(`${label}: sourceId is required.`);
      continue;
    }
    const expectedKey = `story:${sourceId}`;
    if (data.translationKey !== expectedKey) {
      failures.push(`${label}: translationKey must be ${expectedKey}.`);
    } else if (translationKeys.has(expectedKey)) {
      failures.push(`${label}: duplicate translationKey ${expectedKey}.`);
    } else {
      translationKeys.add(expectedKey);
    }
    if (data.slug !== sourceId) {
      failures.push(`${label}: slug must remain identical to sourceId.`);
    }

    const sourceFile = path.join(storySourceDirectory, `${sourceId}.json`);
    if (!existsSync(sourceFile)) {
      failures.push(`${label}: source Web Story ${sourceId} does not exist.`);
      continue;
    }
    const sourceRaw = await readFile(sourceFile, 'utf8');
    const source = JSON.parse(sourceRaw) as Record<string, unknown>;
    if (data.sourceHash !== normalizedStorySourceHash(sourceRaw)) {
      failures.push(`${label}: published translation is stale.`);
    }

    const status = data.status;
    if (status === 'published') {
      published += 1;
      if (data.reviewedAt === undefined) {
        failures.push(`${label}: published translation requires reviewedAt.`);
      }
    } else if (status === 'review' || status === 'draft') {
      reviewed += 1;
    } else {
      failures.push(`${label}: status must be draft, review, or published.`);
    }

    for (const field of ['title', 'excerpt', 'posterAlt'] as const) {
      const value = data[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        failures.push(`${label}: ${field} is required.`);
      } else if (/\p{Script=Han}/u.test(value)) {
        failures.push(`${label}: ${field} must be English.`);
      }
    }

    const sourceTranscript = source.transcript;
    const translatedTranscript = data.transcript;
    if (
      !Array.isArray(sourceTranscript) ||
      !Array.isArray(translatedTranscript) ||
      sourceTranscript.length !== translatedTranscript.length
    ) {
      failures.push(
        `${label}: translated transcript page count must match the source.`,
      );
      continue;
    }
    for (let index = 0; index < sourceTranscript.length; index += 1) {
      const sourcePage = sourceTranscript[index];
      const translatedPage = translatedTranscript[index];
      if (
        !sourcePage ||
        !translatedPage ||
        typeof sourcePage !== 'object' ||
        typeof translatedPage !== 'object'
      )
        continue;
      const sourceRecord = sourcePage as Record<string, unknown>;
      const translatedRecord = translatedPage as Record<string, unknown>;
      if (
        sourceRecord.id !== translatedRecord.id ||
        sourceRecord.order !== translatedRecord.order
      ) {
        failures.push(
          `${label}: transcript page ${index + 1} must retain source id and order.`,
        );
      }
      if (Array.isArray(translatedRecord.lines)) {
        for (const line of translatedRecord.lines) {
          if (typeof line !== 'string' || /\p{Script=Han}/u.test(line)) {
            failures.push(`${label}: transcript text must be English.`);
          }
        }
      }
    }
  }

  check(
    published === publishedSources.size,
    `English Web Stories must publish one translation for each of the ${publishedSources.size} source stories.`,
  );
  return { published, reviewed };
}

const noteVerification = await verifyNoteTranslations();
const storyVerification = await verifyStoryTranslations();

if (failures.length > 0) {
  console.error('[verify:i18n] FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `[verify:i18n] PASS: ${publishedCount} published and ${reviewCount} review article translations, ${noteVerification.published} published and ${noteVerification.reviewed} review note translations, and ${storyVerification.published} published Web Story translations validated.`,
  );
}
