import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

import {
  interfaceAlternates,
  localeFromPathname,
  localizedPath,
  taxonomyAlternates,
} from '../../src/lib/i18n';
import { localizeTranslatedHtml } from '../../src/lib/localize-html';
import { withBase } from '../../src/lib/urls';

describe('locale paths', () => {
  it('keeps the default locale unprefixed and prefixes English', () => {
    expect(localizedPath('/articles.html', 'zh-hant')).toBe(
      withBase('/articles.html'),
    );
    expect(localizedPath('/articles.html?source=nav#top', 'en')).toBe(
      `${withBase('/en/articles.html')}?source=nav#top`,
    );
  });

  it('retargets an already localized path without duplicating prefixes', () => {
    expect(localizedPath('/en/about.html', 'zh-hant')).toBe(
      withBase('/about.html'),
    );
    expect(localizedPath('/en/about.html', 'en')).toBe(
      withBase('/en/about.html'),
    );
  });

  it('detects locales and creates alternates only for translated interfaces', () => {
    expect(localeFromPathname(withBase('/en/contact.html'))).toBe('en');
    expect(localeFromPathname(withBase('/contact.html'))).toBe('zh-hant');
    expect(interfaceAlternates('/en/contact.html')).toEqual({
      'zh-hant': '/contact.html',
      en: '/en/contact.html',
    });
    expect(interfaceAlternates('/untranslated-article.html')).toEqual({});
  });

  it('maps translated taxonomy labels to matching language routes', () => {
    expect(taxonomyAlternates('categories', 'SEO')).toEqual({
      'zh-hant': '/categories/seo相關.html',
      en: '/en/categories/seo.html',
    });
    expect(taxonomyAlternates('tags', '工作心得')).toEqual({
      'zh-hant': '/tags/工作心得.html',
      en: '/en/tags/career-reflections.html',
    });
    expect(taxonomyAlternates('tags', 'Not translated')).toEqual({});
  });
});

describe('translated article HTML localization', () => {
  it('resolves assets and sends internal links to an available English counterpart', () => {
    const html = localizeTranslatedHtml(
      `<picture>
        <source srcset="./wp-content/a.webp 1x, /wp-content/a@2x.webp 2x">
        <img src="./wp-content/a.jpg" alt="Diagram">
      </picture>
      <a href="./related.html?source=article#details">Related</a>`,
      {
        sourceCanonicalPath: '/source.html',
        counterparts: new Map([['/related.html', '/en/related.html']]),
      },
    );
    const $ = load(html, null, false);

    expect($('img').attr('src')).toBe(withBase('/wp-content/a.jpg'));
    expect($('source').attr('srcset')).toBe(
      `${withBase('/wp-content/a.webp')} 1x, ${withBase('/wp-content/a@2x.webp')} 2x`,
    );
    expect($('a').attr('href')).toBe(
      `${withBase('/en/related.html')}?source=article#details`,
    );
    expect($('a').attr('lang')).toBeUndefined();
  });

  it('preserves external and fragment links while marking untranslated internal HTML', () => {
    const html = localizeTranslatedHtml(
      `<a href="/chinese-only.html">Chinese</a>
      <a href="https://example.com/page">External</a>
      <a href="#section">Section</a>`,
      {
        sourceCanonicalPath: '/source.html',
        counterparts: new Map(),
      },
    );
    const $ = load(html, null, false);
    const anchors = $('a').toArray();

    expect($(anchors[0]).attr('href')).toBe(withBase('/chinese-only.html'));
    expect($(anchors[0]).attr('lang')).toBe('zh-Hant');
    expect($(anchors[1]).attr('href')).toBe('https://example.com/page');
    expect($(anchors[2]).attr('href')).toBe('#section');
  });
});
