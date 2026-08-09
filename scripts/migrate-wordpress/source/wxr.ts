import { readFile } from 'node:fs/promises';

import { XMLParser } from 'fast-xml-parser';

import {
  SourceParseError,
  type WxrCategory,
  type WxrItem,
  type WxrPostMeta,
  type WxrSource,
} from './types.js';

type UnknownRecord = Record<string, unknown>;

const parser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  isArray: (_tagName, jPath) => {
    if (typeof jPath !== 'string') {
      return false;
    }

    return (
      jPath === 'rss.channel.item' ||
      jPath.endsWith('.item.category') ||
      jPath.endsWith('.item.wp:postmeta')
    );
  },
  jPath: true,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: true,
  trimValues: false,
});

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new SourceParseError(`Expected an object at ${path}.`);
  }

  return value;
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (isRecord(value)) {
    return stringValue(value['#text']);
  }

  return '';
}

function strictInteger(
  value: unknown,
  path: string,
  options?: { positive?: boolean },
): number {
  const text = stringValue(value).trim();

  if (!/^-?\d+$/.test(text)) {
    throw new SourceParseError(
      `Expected an integer at ${path}, received ${JSON.stringify(text)}.`,
    );
  }

  const parsed = Number(text);

  if (
    !Number.isSafeInteger(parsed) ||
    (options?.positive === true && parsed <= 0)
  ) {
    throw new SourceParseError(
      `Integer at ${path} is outside the supported range.`,
    );
  }

  return parsed;
}

function arrayValue(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeCategory(value: unknown, path: string): WxrCategory {
  const category = requiredRecord(value, path);

  return {
    domain: stringValue(category['@_domain']),
    nicename: stringValue(category['@_nicename']),
    name: stringValue(category['#text']),
  };
}

function normalizePostMeta(value: unknown, path: string): WxrPostMeta {
  const postMeta = requiredRecord(value, path);
  const key = stringValue(postMeta['wp:meta_key']);

  if (key.length === 0) {
    throw new SourceParseError(`Missing wp:meta_key at ${path}.`);
  }

  return {
    key,
    value: stringValue(postMeta['wp:meta_value']),
  };
}

function normalizeItem(value: unknown, index: number): WxrItem {
  const path = `rss.channel.item[${index}]`;
  const item = requiredRecord(value, path);
  const postType = stringValue(item['wp:post_type']);
  const status = stringValue(item['wp:status']);

  if (postType.length === 0) {
    throw new SourceParseError(`Missing wp:post_type at ${path}.`);
  }

  if (status.length === 0) {
    throw new SourceParseError(`Missing wp:status at ${path}.`);
  }

  return {
    wpId: strictInteger(item['wp:post_id'], `${path}.wp:post_id`, {
      positive: true,
    }),
    title: stringValue(item.title),
    link: stringValue(item.link),
    guid: stringValue(item.guid),
    content: stringValue(item['content:encoded']),
    excerpt: stringValue(item['excerpt:encoded']),
    slug: stringValue(item['wp:post_name']),
    status,
    postType,
    parentId: strictInteger(
      item['wp:post_parent'] ?? '0',
      `${path}.wp:post_parent`,
    ),
    menuOrder: strictInteger(
      item['wp:menu_order'] ?? '0',
      `${path}.wp:menu_order`,
    ),
    dates: {
      published: {
        local: stringValue(item['wp:post_date']),
        gmt: stringValue(item['wp:post_date_gmt']),
      },
      modified: {
        local: stringValue(item['wp:post_modified']),
        gmt: stringValue(item['wp:post_modified_gmt']),
      },
    },
    categories: arrayValue(item.category).map((category, categoryIndex) =>
      normalizeCategory(category, `${path}.category[${categoryIndex}]`),
    ),
    postMeta: arrayValue(item['wp:postmeta']).map((postMeta, postMetaIndex) =>
      normalizePostMeta(postMeta, `${path}.wp:postmeta[${postMetaIndex}]`),
    ),
    attachmentUrl:
      item['wp:attachment_url'] === undefined
        ? null
        : stringValue(item['wp:attachment_url']),
  };
}

export function parseWxr(xml: string | Uint8Array): WxrSource {
  const input =
    typeof xml === 'string' ? xml : Buffer.from(xml).toString('utf8');
  let parsed: unknown;

  try {
    parsed = parser.parse(input) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SourceParseError(`Unable to parse WXR XML: ${message}`);
  }

  const root = requiredRecord(parsed, 'document');
  const rss = requiredRecord(root.rss, 'rss');
  const channel = requiredRecord(rss.channel, 'rss.channel');
  const items = arrayValue(channel.item).map(normalizeItem);
  const seenIds = new Set<number>();

  for (const item of items) {
    if (seenIds.has(item.wpId)) {
      throw new SourceParseError(`Duplicate wp:post_id ${item.wpId} in WXR.`);
    }

    seenIds.add(item.wpId);
  }

  return {
    title: stringValue(channel.title),
    link: stringValue(channel.link),
    baseSiteUrl: stringValue(channel['wp:base_site_url']),
    baseBlogUrl: stringValue(channel['wp:base_blog_url']),
    items,
  };
}

export async function readWxrFile(path: string): Promise<WxrSource> {
  return parseWxr(await readFile(path));
}

export function getPostMetaValues(item: WxrItem, key: string): string[] {
  return item.postMeta
    .filter((entry) => entry.key === key)
    .map((entry) => entry.value);
}
