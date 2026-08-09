import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface LegacyAliasInventory {
  bodyBySlug: Map<string, string>;
  bySlug: Map<string, string[]>;
  summaryBySlug: Map<string, string>;
  tagsBySlug: Map<string, string[]>;
  unmatchedFiles: string[];
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

export function readLegacyAliases(
  legacyRepoPath: string | undefined,
): LegacyAliasInventory {
  const bySlug = new Map<string, string[]>();
  const bodyBySlug = new Map<string, string>();
  const summaryBySlug = new Map<string, string>();
  const tagsBySlug = new Map<string, string[]>();
  if (!legacyRepoPath) {
    return {
      bodyBySlug,
      bySlug,
      summaryBySlug,
      tagsBySlug,
      unmatchedFiles: [],
    };
  }

  const blogRoot = path.join(legacyRepoPath, 'data', 'blog');
  const files = walk(blogRoot).filter((file) => file.endsWith('.mdx'));
  const unmatchedFiles: string[] = [];

  for (const file of files) {
    const relative = path.relative(blogRoot, file).replaceAll('\\', '/');
    const [section] = relative.split('/');
    if (section !== 'newsletter' && section !== 'seo') continue;

    const source = readFileSync(file, 'utf8');
    const parsed = matter(source);
    const inferredSlug = path.basename(relative, '.mdx');
    const configuredSlug =
      typeof parsed.data.slug === 'string' && parsed.data.slug.trim()
        ? parsed.data.slug
            .trim()
            .replace(/^\/+|\/+$/g, '')
            .split('/')
            .at(-1)!
        : inferredSlug;
    const alias = `/blog/${relative.slice(0, -'.mdx'.length)}`;
    const aliases = bySlug.get(configuredSlug) ?? [];
    aliases.push(alias);
    bySlug.set(configuredSlug, aliases);
    bodyBySlug.set(configuredSlug, parsed.content);

    if (typeof parsed.data.summary === 'string' && parsed.data.summary.trim()) {
      summaryBySlug.set(configuredSlug, parsed.data.summary.trim());
    }
    if (Array.isArray(parsed.data.tags)) {
      tagsBySlug.set(
        configuredSlug,
        parsed.data.tags.filter(
          (tag): tag is string =>
            typeof tag === 'string' && tag.trim().length > 0,
        ),
      );
    }

    if (!configuredSlug) unmatchedFiles.push(relative);
  }

  for (const aliases of bySlug.values()) aliases.sort();
  return { bodyBySlug, bySlug, summaryBySlug, tagsBySlug, unmatchedFiles };
}
