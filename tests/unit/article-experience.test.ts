import { describe, expect, it } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import {
  estimateReadingMinutes,
  getArticleJourney,
  newsletterRange,
  prepareArticleHtml,
  transitionNameForPost,
} from '../../src/lib/article-experience';

function post(
  slug: string,
  options: {
    categories?: string[];
    publishedAt?: string;
    tags?: string[];
  } = {},
): CollectionEntry<'posts'> {
  const publishedAt = new Date(options.publishedAt ?? '2022-01-01');

  return {
    id: slug,
    collection: 'posts',
    data: {
      aliases: [],
      canonicalPath: `/${slug}.html`,
      categories: options.categories ?? ['SEO'],
      excerpt: '',
      featuredMedia: null,
      originalStatus: 'publish',
      publishedAt,
      slug,
      sourceChecksum: 'a'.repeat(64),
      tags: options.tags ?? ['搜尋'],
      title: slug,
      updatedAt: publishedAt,
      wasMembersOnly: false,
      wpId: 1,
    },
  };
}

describe('article experience', () => {
  it('adds stable unique ids while preserving historical anchors', () => {
    const result = prepareArticleHtml(`
      <h2 id="toc-1">既有段落</h2>
      <p>內容</p>
      <h2>新的段落</h2>
      <h3>新的段落</h3>
    `);

    expect(result.headings).toEqual([
      { depth: 2, id: 'toc-1', text: '既有段落' },
      { depth: 2, id: 'section-新的段落', text: '新的段落' },
      { depth: 3, id: 'section-新的段落-2', text: '新的段落' },
    ]);
    expect(result.html).toContain('<h2 id="toc-1">既有段落</h2>');
    expect(result.html).toContain('<h3 id="section-新的段落-2">');
  });

  it('estimates mixed Chinese and English reading time', () => {
    const chinese = '數'.repeat(700);
    const english = Array.from({ length: 200 }, () => 'word').join(' ');
    expect(estimateReadingMinutes(`<p>${chinese} ${english}</p>`)).toBe(3);
  });

  it('orders merged newsletter issues and excludes neighbours from related posts', () => {
    const issue1 = post('seo-newsletter-issue-1');
    const issue2 = post('seo-newsletter-issue-2');
    const issue3 = post('seo-newsletter-issue-3');
    const issue4 = post('seo-newsletter-issue-4');
    const issue5to6 = post('seo-newsletter-issue-5-6');
    const evergreen = post('evergreen-seo-guide', { tags: ['搜尋'] });
    const posts = [issue5to6, issue1, evergreen, issue3, issue2, issue4];
    const journey = getArticleJourney(issue3, posts);

    expect(newsletterRange(issue5to6)).toEqual({ start: 5, end: 6 });
    expect(journey.previous?.id).toBe(issue2.id);
    expect(journey.next?.id).toBe(issue4.id);
    expect(journey.related.map(({ id }) => id)).not.toContain(issue2.id);
    expect(journey.related.map(({ id }) => id)).not.toContain(issue4.id);
  });

  it('creates a CSS-safe transition name', () => {
    expect(transitionNameForPost('文章 title / 1')).toBe(
      'post-title-文章-title-1',
    );
  });
});
