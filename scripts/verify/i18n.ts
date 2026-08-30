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
const failures: string[] = [];

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

if (failures.length > 0) {
  console.error('[verify:i18n] FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `[verify:i18n] PASS: ${publishedCount} published and ${reviewCount} review translations validated.`,
  );
}
