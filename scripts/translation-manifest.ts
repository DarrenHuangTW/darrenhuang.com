import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import matter from 'gray-matter';

type Article = {
  sourceId: string;
  sourcePath: string;
  sourceHash: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  categories: string[];
  tags: string[];
  suggestedSlug: string;
  translationPath: string;
  status: 'existing' | 'pending';
};

const root = resolve(import.meta.dirname, '..');
const sourceDir = join(root, 'src', 'content', 'posts');
const translationDir = join(root, 'src', 'content', 'post-translations', 'en');
const reportDir = join(root, 'migration-report', 'translations');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHash(raw: string): string {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  return sha256(
    JSON.stringify({
      canonicalPath: data.canonicalPath,
      categories: data.categories,
      excerpt: data.excerpt,
      featuredMedia: data.featuredMedia,
      publishedAt: data.publishedAt,
      tags: data.tags,
      title: data.title,
      updatedAt: data.updatedAt,
      body: parsed.content.replaceAll('\r\n', '\n').trim(),
    }),
  );
}

function scalar(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

const files = (await readdir(sourceDir))
  .filter((file) => /\.(md|mdx)$/u.test(file))
  .sort();
const existing = new Set(
  (await readdir(translationDir))
    .filter((file) => /\.(md|mdx)$/u.test(file))
    .map((file) => basename(file).replace(/\.(md|mdx)$/u, '')),
);
const articles: Article[] = [];

for (const file of files) {
  const raw = await readFile(join(sourceDir, file), 'utf8');
  const parsed = matter(raw);
  const sourceId = basename(file).replace(/\.(md|mdx)$/u, '');
  const data = parsed.data as Record<string, unknown>;
  articles.push({
    sourceId,
    sourcePath: relative(root, join(sourceDir, file)).replaceAll('\\', '/'),
    sourceHash: sourceHash(raw),
    title: scalar(data.title),
    excerpt: scalar(data.excerpt),
    publishedAt: scalar(data.publishedAt),
    updatedAt: scalar(data.updatedAt),
    categories: list(data.categories),
    tags: list(data.tags),
    suggestedSlug: sourceId,
    translationPath: `src/content/post-translations/en/${sourceId}.md`,
    status: existing.has(sourceId) ? 'existing' : 'pending',
  });
}

const pending = articles.filter((article) => article.status === 'pending');
await mkdir(reportDir, { recursive: true });
await writeFile(
  join(reportDir, 'english-posts-manifest.json'),
  JSON.stringify(
    {
      sourceCollection: 'posts',
      translationCollection: 'postTranslations',
      locale: 'en',
      total: articles.length,
      existing: articles.length - pending.length,
      pending: pending.length,
      articles,
    },
    null,
    2,
  ) + '\n',
);

const lines = [
  '# English post translation queue',
  '',
  `Pending: ${pending.length} of ${articles.length} source posts.`,
  '',
  'Each item must be translated into its `translationPath`, retain `sourceId`, set `translationKey: post:<sourceId>`, copy sourceHash, and use `draft` or `review` while editing before publishing with `reviewedAt`.',
  '',
  ...pending.map(
    (article) =>
      `- [ ] \`${article.sourceId}\` — ${article.title} (sourceHash \`${article.sourceHash}\`)`,
  ),
  '',
];
await writeFile(join(reportDir, 'english-posts-pending.md'), lines.join('\n'));
console.log(
  `Wrote ${pending.length} pending and ${articles.length - pending.length} existing entries to ${relative(root, reportDir)}.`,
);
