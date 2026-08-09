import { describe, expect, it } from 'vitest';

import { slugifyTaxonomy, withBase } from '../../src/lib/urls';

const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

function expectedWithBase(value: string): string {
  const normalized = `/${value.replace(/^\/+/, '')}`;
  return `${base}${normalized}` || '/';
}

describe('withBase', () => {
  it('adds the configured Astro base to root-relative paths', () => {
    expect(withBase('/articles.html')).toBe(expectedWithBase('/articles.html'));
    expect(withBase('tags/seo.html')).toBe(expectedWithBase('/tags/seo.html'));
  });

  it('normalizes extra leading slashes and preserves the site root', () => {
    expect(withBase('///wp-content/uploads/photo.png')).toBe(
      expectedWithBase('/wp-content/uploads/photo.png'),
    );
    expect(withBase('/')).toBe(expectedWithBase('/'));
    expect(withBase('')).toBe(expectedWithBase('/'));
  });

  it('does not rewrite absolute protocols or fragment links', () => {
    expect(withBase('https://example.com/video')).toBe(
      'https://example.com/video',
    );
    expect(withBase('mailto:hello@example.com')).toBe(
      'mailto:hello@example.com',
    );
    expect(withBase('tel:+886123456789')).toBe('tel:+886123456789');
    expect(withBase('#main-content')).toBe('#main-content');
  });
});

describe('slugifyTaxonomy', () => {
  it('preserves Chinese letters while normalizing spacing', () => {
    expect(slugifyTaxonomy(' SEO 技術 ')).toBe('seo-技術');
    expect(slugifyTaxonomy('內容　行銷')).toBe('內容-行銷');
  });

  it('normalizes full-width Latin text and underscores', () => {
    expect(slugifyTaxonomy('ＳＥＯ_Research')).toBe('seo-research');
  });

  it('removes punctuation, emoji, and duplicate hyphens', () => {
    expect(slugifyTaxonomy('Google！SEO 🚀 -- 實驗')).toBe('googleseo-實驗');
  });

  it('returns an empty slug when the input contains no letters or numbers', () => {
    expect(slugifyTaxonomy(' 🚀 ！ ')).toBe('');
  });
});
