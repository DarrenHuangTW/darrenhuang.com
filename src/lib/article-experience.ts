import { load } from 'cheerio';

export interface ArticleHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface PreparedArticle {
  headings: ArticleHeading[];
  html: string;
  readingMinutes: number;
}

export interface ArticleJourney {
  next: ArticlePost | null;
  previous: ArticlePost | null;
  related: ArticlePost[];
  seriesLabel: string | null;
}

export interface ArticlePost {
  id: string;
  data: {
    canonicalPath: string;
    categories: string[];
    excerpt: string;
    publishedAt: Date;
    slug: string;
    tags: string[];
    title: string;
  };
}

interface NewsletterRange {
  end: number;
  start: number;
}

const HAN_CHARACTER = /\p{Script=Han}/gu;
const WORD = /[\p{Letter}\p{Number}]+(?:['’.-][\p{Letter}\p{Number}]+)*/gu;

function normalizedText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function headingSlug(text: string, index: number): string {
  const normalized = text
    .normalize('NFKC')
    .toLocaleLowerCase('zh-Hant')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 72);

  return normalized ? `section-${normalized}` : `section-${index + 1}`;
}

function uniqueHeadingId(requested: string, usedIds: Set<string>): string {
  let candidate = requested;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${requested}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

export function estimateReadingMinutes(html: string): number {
  const $ = load(html, null, false);
  $('script, style, template, noscript').remove();
  const text = normalizedText($.root().text());
  const hanCount = text.match(HAN_CHARACTER)?.length ?? 0;
  const nonHanText = text.replace(HAN_CHARACTER, ' ');
  const wordCount = nonHanText.match(WORD)?.length ?? 0;
  const minutes = hanCount / 350 + wordCount / 200;

  return Math.max(1, Math.ceil(minutes));
}

export function prepareArticleHtml(html: string): PreparedArticle {
  const $ = load(html, null, false);
  const headings: ArticleHeading[] = [];
  const usedIds = new Set<string>();

  $('[id]')
    .not('h2, h3')
    .each((_index, element) => {
      const id = $(element).attr('id')?.trim();
      if (id) usedIds.add(id);
    });

  $('h2, h3').each((index, element) => {
    const heading = $(element);
    const text = normalizedText(heading.text());
    if (!text) return;

    const currentId = heading.attr('id')?.trim();
    const id = uniqueHeadingId(currentId || headingSlug(text, index), usedIds);
    heading.attr('id', id);
    headings.push({
      depth: element.tagName.toLocaleLowerCase('en-US') === 'h3' ? 3 : 2,
      id,
      text,
    });
  });

  const renderedHtml = $.html().trim();

  return {
    headings,
    html: renderedHtml,
    readingMinutes: estimateReadingMinutes(renderedHtml),
  };
}

export function newsletterRange(post: ArticlePost): NewsletterRange | null {
  const match = /^seo-newsletter-issue-(\d+)(?:-(\d+))?$/u.exec(post.data.slug);
  if (!match?.[1]) return null;

  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;

  return { end: Math.max(start, end), start: Math.min(start, end) };
}

function sharedTerms(left: string[], right: string[]): number {
  const normalizedRight = new Set(
    right.map((value) => value.trim().toLocaleLowerCase('zh-Hant')),
  );

  return left.filter((value) =>
    normalizedRight.has(value.trim().toLocaleLowerCase('zh-Hant')),
  ).length;
}

function relatedScore(current: ArticlePost, candidate: ArticlePost): number {
  const categoryScore =
    sharedTerms(current.data.categories, candidate.data.categories) * 8;
  const tagScore = sharedTerms(current.data.tags, candidate.data.tags) * 5;
  const sameSeries = newsletterRange(current) && newsletterRange(candidate);
  const distanceInYears =
    Math.abs(
      current.data.publishedAt.getTime() - candidate.data.publishedAt.getTime(),
    ) /
    (365.25 * 24 * 60 * 60 * 1000);
  const proximityScore = Math.max(0, 3 - Math.floor(distanceInYears));

  return categoryScore + tagScore + (sameSeries ? 10 : 0) + proximityScore;
}

export function getArticleJourney(
  current: ArticlePost,
  posts: ArticlePost[],
): ArticleJourney {
  const currentRange = newsletterRange(current);
  const newsletterPosts = posts
    .map((post) => ({ post, range: newsletterRange(post) }))
    .filter(
      (
        candidate,
      ): candidate is {
        post: ArticlePost;
        range: NewsletterRange;
      } => candidate.range !== null,
    )
    .toSorted((left, right) => left.range.start - right.range.start);

  let previous: ArticlePost | null = null;
  let next: ArticlePost | null = null;

  if (currentRange) {
    previous =
      newsletterPosts
        .filter(({ range }) => range.end < currentRange.start)
        .at(-1)?.post ?? null;
    next =
      newsletterPosts.find(({ range }) => range.start > currentRange.end)
        ?.post ?? null;
  }

  const excludedIds = new Set(
    [current, previous, next]
      .filter((post): post is ArticlePost => post !== null)
      .map((post) => post.id),
  );
  const scored = posts
    .filter((post) => !excludedIds.has(post.id))
    .map((post) => ({
      post,
      score: relatedScore(current, post),
      timeDistance: Math.abs(
        current.data.publishedAt.getTime() - post.data.publishedAt.getTime(),
      ),
    }))
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        left.timeDistance - right.timeDistance ||
        right.post.data.publishedAt.getTime() -
          left.post.data.publishedAt.getTime() ||
        left.post.data.slug.localeCompare(right.post.data.slug, 'zh-Hant'),
    );

  return {
    next,
    previous,
    related: scored.slice(0, 3).map(({ post }) => post),
    seriesLabel: currentRange ? 'SEO Newsletter' : null,
  };
}

export function transitionNameForPost(slug: string): string {
  const safeSlug = slug
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return `post-title-${safeSlug || 'article'}`;
}
