import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import matter from 'gray-matter';
import { PRODUCTION_SITE_URL } from '../../site.config';
import {
  isProductionTrackingTarget,
  PUBLIC_TRACKING_CONFIG,
} from '../../src/lib/tracking';

type UnknownRecord = Record<string, unknown>;
type EmbedProvider = 'spotify' | 'twitter' | 'youtube';

interface PostSample {
  body: string;
  canonicalPath: string;
  title: string;
  wasMembersOnly: boolean;
}

interface StorySample {
  canonicalPath: string;
  modernPageCount: number;
  title: string;
}

interface SiteFixture {
  embedSamples: Record<EmbedProvider, PostSample>;
  error?: string;
  memberPost: PostSample;
  representativePost: PostSample;
  stories: StorySample[];
}

const root = process.cwd();
const manifestPath = path.join(root, 'migration', 'manifest.json');
const contentPostsRoot = path.join(root, 'src', 'content', 'posts');
const contentStoriesRoot = path.join(root, 'src', 'content', 'stories');
const configuredBase = normalizeBase(process.env.BASE_PATH ?? '/');
const configuredSite = process.env.SITE_URL ?? PRODUCTION_SITE_URL;

function normalizeBase(value: string): string {
  const normalized = `/${value.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '' : normalized;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function allFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? allFiles(absolute) : [absolute];
  });
}

function loadPostSources(): Map<number, { body: string; data: UnknownRecord }> {
  const result = new Map<number, { body: string; data: UnknownRecord }>();

  for (const file of allFiles(contentPostsRoot).filter((candidate) =>
    /\.mdx?$/i.test(candidate),
  )) {
    const parsed = matter(readFileSync(file, 'utf8'));
    const data = parsed.data as UnknownRecord;
    if (typeof data.wpId === 'number') {
      result.set(data.wpId, { body: parsed.content, data });
    }
  }

  return result;
}

function loadStorySource(slug: string): UnknownRecord | undefined {
  for (const file of allFiles(contentStoriesRoot).filter((candidate) =>
    /\.(?:json|md)$/i.test(candidate),
  )) {
    const source = readFileSync(file, 'utf8');
    const data: unknown = file.toLowerCase().endsWith('.json')
      ? JSON.parse(source)
      : matter(source).data;
    if (isRecord(data) && data.slug === slug) {
      return data;
    }
  }

  return undefined;
}

function requireString(
  record: UnknownRecord,
  key: string,
  label: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`${label}.${key} 缺失。`);
  }

  return value;
}

function detectEmbedProviders(post: UnknownRecord): Set<EmbedProvider> {
  const source = JSON.stringify(post.embeds ?? []).toLowerCase();
  const result = new Set<EmbedProvider>();

  if (/youtube|youtu\.be/.test(source)) {
    result.add('youtube');
  }

  if (/twitterembed|twitter\.com|(?:^|[^a-z])x\.com/.test(source)) {
    result.add('twitter');
  }

  if (/spotify|open\.spotify\.com/.test(source)) {
    result.add('spotify');
  }

  return result;
}

function unavailableFixture(error: unknown): SiteFixture {
  const message = error instanceof Error ? error.message : String(error);
  const emptyPost: PostSample = {
    body: '',
    canonicalPath: '/',
    title: '',
    wasMembersOnly: false,
  };

  return {
    embedSamples: {
      spotify: emptyPost,
      twitter: emptyPost,
      youtube: emptyPost,
    },
    error: message,
    memberPost: emptyPost,
    representativePost: emptyPost,
    stories: [],
  };
}

function loadFixture(): SiteFixture {
  try {
    if (!existsSync(manifestPath)) {
      throw new Error('找不到 migration/manifest.json；請先執行 importer。');
    }

    const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (
      !isRecord(manifest) ||
      !Array.isArray(manifest.posts) ||
      !Array.isArray(manifest.stories)
    ) {
      throw new Error('migration/manifest.json 缺少 posts[] 或 stories[]。');
    }

    const postSources = loadPostSources();
    const postSamples: Array<{ manifest: UnknownRecord; sample: PostSample }> =
      [];

    for (const value of manifest.posts) {
      if (!isRecord(value) || typeof value.wpId !== 'number') {
        continue;
      }

      const source = postSources.get(value.wpId);
      if (!source) {
        throw new Error(`找不到 wpId ${value.wpId} 的文章來源。`);
      }

      postSamples.push({
        manifest: value,
        sample: {
          body: source.body,
          canonicalPath: requireString(
            value,
            'canonicalPath',
            `wpId ${value.wpId}`,
          ),
          title: requireString(source.data, 'title', `wpId ${value.wpId}`),
          wasMembersOnly: value.wasMembersOnly === true,
        },
      });
    }

    if (postSamples.length !== 86) {
      throw new Error(
        `E2E fixture 預期 86 篇文章，實際為 ${postSamples.length}。`,
      );
    }

    const representative =
      postSamples.find(
        ({ manifest, sample }) =>
          !sample.wasMembersOnly &&
          Array.isArray(manifest.mediaDependencies) &&
          manifest.mediaDependencies.length > 0,
      ) ?? postSamples.find(({ sample }) => !sample.wasMembersOnly);
    const member = postSamples.find(({ sample }) => sample.wasMembersOnly);

    if (!representative || !member) {
      throw new Error('找不到一般文章或原會員文章的 E2E 樣本。');
    }

    const embedSamples = new Map<EmbedProvider, PostSample>();
    for (const { manifest: post, sample } of postSamples) {
      for (const provider of detectEmbedProviders(post)) {
        if (!embedSamples.has(provider)) {
          embedSamples.set(provider, sample);
        }
      }
    }

    for (const provider of ['youtube', 'twitter', 'spotify'] as const) {
      if (!embedSamples.has(provider)) {
        throw new Error(`找不到 ${provider} embed 的 E2E 樣本。`);
      }
    }

    const stories = manifest.stories.filter(isRecord).map((story, index) => {
      const label = `story ${index + 1}`;
      const storySlug = requireString(story, 'slug', label);
      const storySource = loadStorySource(storySlug);
      const storyTitle =
        (storySource &&
          typeof storySource.title === 'string' &&
          storySource.title) ||
        requireString(story, 'title', label);
      const modernPageCount = story.modernPageCount;
      if (typeof modernPageCount !== 'number' || modernPageCount <= 0) {
        throw new Error(`${label}.modernPageCount 無效。`);
      }

      return {
        canonicalPath: requireString(story, 'canonicalPath', label),
        modernPageCount,
        title: storyTitle,
      };
    });

    if (stories.length !== 2) {
      throw new Error(
        `E2E fixture 預期 2 篇 Stories，實際為 ${stories.length}。`,
      );
    }

    return {
      embedSamples: {
        spotify: embedSamples.get('spotify') as PostSample,
        twitter: embedSamples.get('twitter') as PostSample,
        youtube: embedSamples.get('youtube') as PostSample,
      },
      memberPost: member.sample,
      representativePost: representative.sample,
      stories,
    };
  } catch (error: unknown) {
    return unavailableFixture(error);
  }
}

function runtimePath(canonicalPath: string): string {
  const normalized = `/${canonicalPath.replace(/^\/+/, '')}`;
  return configuredBase ? `${configuredBase}${normalized}` : normalized;
}

function escapedRegExp(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

const fixture = loadFixture();

test.describe('Phase 5 public-site acceptance', () => {
  test.beforeAll(() => {
    if (fixture.error) {
      throw new Error(`E2E fixture 尚未就緒：${fixture.error}`);
    }
  });

  test('desktop and mobile homepages expose the collection and keep agent links in the footer', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(runtimePath('/'));
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/數位引擎/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '讓寫過的內容，繼續被找到',
    );
    await expect(page.locator('.hero__panel strong')).toHaveText(
      '一些實作，一些觀察。',
    );
    await expect(page.locator('main')).not.toContainText(
      '給開發者與 Agent 的公開入口',
    );
    const footer = page.locator('footer');
    await expect(
      footer.getByRole('heading', {
        level: 2,
        name: '給開發者與 Agent 的公開入口',
      }),
    ).toBeVisible();
    await expect(
      footer.getByRole('link', { name: '開發者與 Agent 入口' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '文章紀錄' }),
    ).toBeVisible();
    await expect(page.locator('.hero')).not.toContainText('會員電子報');
    await expect(page.locator('.hero')).not.toContainText('WordPress');
    await expect(
      page.getByRole('link', { name: /查看全部 86 篇/ }),
    ).toBeVisible();
    await expect(page.locator('.post-card')).toHaveCount(5);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(
      horizontalOverflow,
      `${testInfo.project.name} 首頁不應水平溢位。`,
    ).toBeLessThanOrEqual(2);
  });

  test('published Facebook notes cross-reference the existing article archive', async ({
    page,
  }) => {
    const directoryResponse = await page.goto(runtimePath('/notes/'));
    expect(directoryResponse?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/notes\.html$/);
    expect(await page.locator('.note-card').count()).toBeGreaterThanOrEqual(24);
    await expect(
      page
        .getByRole('link', { name: /用 ChatGPT 產生 SEO Bookmarklet/ })
        .first(),
    ).toBeVisible();

    const noteResponse = await page.goto(
      runtimePath('/notes/facebook-chatgpt-seo-bookmarklets.html'),
    );
    expect(noteResponse?.ok()).toBe(true);
    expect(
      await page.locator('meta[name="robots"][content*="noindex"]').count(),
    ).toBe(0);
    await expect(
      page.locator(
        '.content-relations a[href*="seo-efficient-tool-bookmarklets.html"]',
      ),
    ).toBeVisible();

    const aiSourceUrl =
      'https://www.facebook.com/searchenginecommunity/posts/pfbid02bxf3N5HEqpyajkuvKhcrP6EK95R7YuVHjEtn3tkBfQxNGkVZ12GetcHHHjUULqK2l';
    const aiNoteResponse = await page.goto(
      runtimePath('/notes/facebook-ai-anxiety-and-learning.html'),
    );
    expect(aiNoteResponse?.ok()).toBe(true);
    await expect(
      page.locator(`.note-source-card a[href="${aiSourceUrl}"]`),
    ).toContainText(aiSourceUrl);
    await expect(
      page.locator('.prose img[src*="982399827335432.jpg"]'),
    ).toHaveCount(1);
    await expect(page.locator('.prose')).not.toContainText('網站草稿');

    const videoSourceUrl =
      'https://www.facebook.com/searchenginecommunity/videos/2212506532371678/';
    const videoNoteResponse = await page.goto(
      runtimePath('/notes/facebook-john-mueller-taiwan-greeting.html'),
    );
    expect(videoNoteResponse?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'John Mueller 向台灣打聲招呼',
      }),
    ).toBeVisible();
    await expect(
      page.locator(`.note-source-card a[href="${videoSourceUrl}"]`),
    ).toContainText(videoSourceUrl);
    await expect(
      page.locator('video source[src*="2212506532371678.mp4"]'),
    ).toHaveCount(1);

    const articleResponse = await page.goto(
      runtimePath('/seo-efficient-tool-bookmarklets.html'),
    );
    expect(articleResponse?.ok()).toBe(true);
    await expect(
      page.locator(
        '.content-relations a[href*="facebook-chatgpt-seo-bookmarklets.html"]',
      ),
    ).toBeVisible();
  });

  test('production tracking markup cannot pollute local or project-base previews', async ({
    page,
  }) => {
    const trackingRequests: string[] = [];
    await page.route('**/*', async (route) => {
      const hostname = new URL(route.request().url()).hostname.toLowerCase();
      if (
        hostname === 'googletagmanager.com' ||
        hostname.endsWith('.googletagmanager.com') ||
        hostname === 'google-analytics.com' ||
        hostname.endsWith('.google-analytics.com') ||
        hostname === 'doubleclick.net' ||
        hostname.endsWith('.doubleclick.net') ||
        hostname === 'clarity.ms' ||
        hostname.endsWith('.clarity.ms') ||
        hostname === 'clarity.microsoft.com' ||
        hostname.endsWith('.clarity.microsoft.com')
      ) {
        trackingRequests.push(route.request().url());
        await route.abort('blockedbyclient');
        return;
      }

      await route.continue();
    });

    const response = await page.goto(runtimePath('/'));
    expect(response?.ok()).toBe(true);
    await page.waitForLoadState('networkidle');

    const trackingMarkupExpected = isProductionTrackingTarget(
      new URL(configuredSite),
      true,
      configuredBase,
    );
    await expect(page.locator('script[data-site-tracking="gtm"]')).toHaveCount(
      trackingMarkupExpected ? 1 : 0,
    );
    await expect(
      page.locator('noscript iframe[src*="ns.html?id="]'),
    ).toHaveCount(0);

    if (trackingMarkupExpected) {
      const bootstrap = await page
        .locator('script[data-site-tracking="gtm"]')
        .textContent();
      expect(bootstrap).toContain(
        PUBLIC_TRACKING_CONFIG.googleTagManagerContainerId,
      );
      expect(bootstrap).toContain(
        `window.location.origin==="${PRODUCTION_SITE_URL}"`,
      );
    }

    await expect(
      page.locator(
        'script[src*="googletagmanager.com/gtag/js"], script[src*="clarity.ms/tag"]',
      ),
    ).toHaveCount(0);
    expect(trackingRequests).toEqual([]);
  });

  test('the About page presents the current biography, carousel, and Person schema', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(runtimePath('/about.html'));
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', { level: 1, name: '關於作者' }),
    ).toBeVisible();

    const summary =
      '一位轉換到 AI 賽道的 SEO 人。這裡收錄過去寫下的 SEO、網站分析、Python、UI／UX 與數位行銷筆記。';
    const visibleSummary = page.getByText(summary, { exact: true });
    await expect(visibleSummary).toHaveCount(1);
    await expect(visibleSummary).toBeVisible();

    const mainText = await page.locator('main#main-content').innerText();
    expect(mainText).toContain('曾在美國生活 8 年');
    expect(mainText).toContain('任職於澳洲公司，採全遠距工作');
    expect(mainText).toContain('職涯顧問需求');
    expect(mainText).not.toContain('KoMarketing');
    expect(mainText).not.toContain('Rakuten');
    expect(mainText).not.toContain('San Mateo');
    expect(mainText).not.toContain('網站效能優化');

    const slides = page.locator('[data-carousel-slide]');
    await expect(slides).toHaveCount(8);
    await expect(slides.first()).toContainText(
      '2018 年參與 Google Product Experts Summit。',
    );
    await expect(slides.last()).toContainText(
      '2024 年與 Gary Illyes、Terence、Cherry 合影。',
    );
    await expect(slides.first().locator('img')).toHaveAttribute(
      'src',
      runtimePath('/images/about/google-product-experts-summit-2018.webp'),
    );

    const mediaMetrics = await slides
      .nth(1)
      .locator('.photo-carousel__media')
      .evaluate((media) => {
        const image = media.querySelector('img');
        if (!(image instanceof HTMLImageElement)) {
          throw new Error('About carousel image is missing.');
        }

        const mediaBox = media.getBoundingClientRect();
        const imageBox = image.getBoundingClientRect();
        return {
          imageHeight: imageBox.height,
          imageWidth: imageBox.width,
          mediaHeight: mediaBox.height,
          mediaWidth: mediaBox.width,
          objectFit: getComputedStyle(image).objectFit,
        };
      });
    const expectedMediaRatio = testInfo.project.name.startsWith('mobile')
      ? 1
      : 4 / 3;
    expect(mediaMetrics.objectFit).toBe('scale-down');
    expect(mediaMetrics.mediaWidth / mediaMetrics.mediaHeight).toBeCloseTo(
      expectedMediaRatio,
      1,
    );
    expect(mediaMetrics.imageWidth).toBeCloseTo(mediaMetrics.mediaWidth, 0);
    expect(mediaMetrics.imageHeight).toBeCloseTo(mediaMetrics.mediaHeight, 0);

    const status = page.locator('[data-carousel-status]');
    await expect(status).toHaveText('第 1 張，共 8 張');
    await page.getByRole('button', { name: '下一張照片' }).click();
    await expect(status).toHaveText('第 2 張，共 8 張');
    await expect(page.locator('[data-carousel-dot]').nth(1)).toHaveAttribute(
      'aria-current',
      'true',
    );

    const structuredDataSource = await page
      .locator('head script[type="application/ld+json"]')
      .textContent();
    expect(structuredDataSource).toBeTruthy();
    const person = JSON.parse(structuredDataSource ?? '{}') as UnknownRecord;
    const expectedCanonical = new URL(
      runtimePath('/about.html'),
      `${configuredSite}/`,
    ).toString();
    const expectedPersonId = `${new URL(
      runtimePath('/'),
      `${configuredSite}/`,
    ).toString()}#person`;
    expect(person).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': expectedPersonId,
      mainEntityOfPage: expectedCanonical,
      email: 'darrenhhuang@gmail.com',
      homeLocation: {
        '@type': 'Place',
        name: 'Kaohsiung, Taiwan',
      },
    });
    expect(person.sameAs).toEqual([
      'https://www.linkedin.com/in/hunghsunhuang/',
      'https://www.instagram.com/hunghsun_huang/',
      'https://www.facebook.com/darrenhuangtw/',
    ]);
    expect(person.knowsAbout).toContain('Remote Working');
    expect(person.knowsAbout).not.toContain('Career Consulting');
    expect(person.brand).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Asian Nomad Diary' }),
        expect.objectContaining({ name: '數位引擎' }),
      ]),
    );

    const visibleSchema = await page.locator('.about-schema code').innerText();
    expect(visibleSchema).toContain('"@type": "Person"');
    expect(visibleSchema).toContain('"Remote Working"');
    expect(visibleSchema).not.toContain('"@id"');
    expect(visibleSchema).not.toContain('"mainEntityOfPage"');

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(
      horizontalOverflow,
      `${testInfo.project.name} About 頁不應水平溢位。`,
    ).toBeLessThanOrEqual(2);
  });

  test('a representative article has readable content and the preserved canonical URL', async ({
    page,
  }) => {
    const sample = fixture.representativePost;
    const response = await page.goto(runtimePath(sample.canonicalPath));
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', { level: 1, name: sample.title }),
    ).toBeVisible();
    await expect(page.locator('article .prose')).toBeVisible();
    expect(
      (await page.locator('article .prose').innerText()).trim().length,
    ).toBeGreaterThan(150);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toBeTruthy();
    const expectedCanonical = new URL(
      runtimePath(sample.canonicalPath),
      `${configuredSite}/`,
    ).toString();
    expect(new URL(canonical ?? '').toString()).toBe(expectedCanonical);
    const openGraphUrl = await page
      .locator('meta[property="og:url"]')
      .getAttribute('content');
    expect(openGraphUrl).toBeTruthy();
    expect(new URL(openGraphUrl ?? '').toString()).toBe(expectedCanonical);
  });

  test('the native article experience keeps reading, discovery, and images fast', async ({
    page,
  }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    const response = await page.goto(
      runtimePath('/seo-newsletter-issue-70-71.html'),
    );
    expect(response?.ok()).toBe(true);
    await expect(page.locator('.article__byline')).toContainText(
      /約 \d+ 分鐘/u,
    );

    const isMobile = testInfo.project.name.startsWith('mobile');
    const desktopHud = page.locator('.reading-hud__desktop');
    const mobileHud = page.locator('.reading-hud__mobile');
    if (isMobile) {
      await expect(desktopHud).toBeHidden();
      await expect(mobileHud).toBeVisible();
      await mobileHud.locator('summary').click();
    } else {
      await expect(desktopHud).toBeVisible();
      await expect(mobileHud).toBeHidden();
    }

    const tocLink = (isMobile ? mobileHud : desktopHud).locator('a').first();
    const targetHash = await tocLink.getAttribute('href');
    expect(targetHash).toMatch(/^#toc-\d+$/u);
    await tocLink.click();
    await expect
      .poll(() => page.evaluate(() => window.location.hash))
      .toBe(targetHash);
    await expect
      .poll(async () => {
        return page.evaluate((hash) => {
          const target = document.querySelector(hash);
          const header = document.querySelector('.site-header');
          if (!target || !header) return false;
          const targetTop = target.getBoundingClientRect().top;
          const headerBottom = header.getBoundingClientRect().bottom;
          return (
            targetTop >= headerBottom && targetTop < window.innerHeight * 0.6
          );
        }, targetHash ?? '#missing');
      })
      .toBe(true);

    if (!isMobile) {
      await expect
        .poll(() =>
          desktopHud.evaluate((hud) => {
            const top = hud.parentElement?.getBoundingClientRect().top ?? -1;
            return top >= 95 && top <= 105;
          }),
        )
        .toBe(true);
    }

    await expect(
      page.locator('.article-journey__series .journey-link--previous'),
    ).toHaveAttribute('href', runtimePath('/seo-newsletter-issue-69.html'));
    await expect(page.locator('.article-journey .related-card')).toHaveCount(3);

    const articleTitle = page.locator('.article__header h1');
    expect(
      await articleTitle.evaluate(
        (heading) => getComputedStyle(heading).viewTransitionName,
      ),
    ).toBe('post-title-seo-newsletter-issue-70-71');
    expect(
      await page.locator('a[data-astro-prefetch="hover"]').count(),
    ).toBeGreaterThan(0);
    await expect(
      page.locator('.prose a[href^="http"][data-astro-prefetch]'),
    ).toHaveCount(0);

    if (!isMobile) {
      const previousIssue = page.locator(
        '.article-journey__series .journey-link--previous',
      );
      await previousIssue.hover();
      await expect
        .poll(() =>
          page
            .locator(
              `head link[rel="prefetch"][href$="${runtimePath('/seo-newsletter-issue-69.html')}"]`,
            )
            .count(),
        )
        .toBe(1);
    }

    const responsivePicture = page
      .locator('.prose picture[data-responsive-image="true"]')
      .first();
    await expect(responsivePicture).toBeVisible();
    const responsiveSource = responsivePicture
      .locator('source[srcset]')
      .first();
    await expect(responsiveSource).toHaveAttribute(
      'srcset',
      new RegExp(escapedRegExp(runtimePath('/_optimized/'))),
    );
    const articleImage = responsivePicture.locator('img');
    await expect(articleImage).toHaveAttribute('sizes', /50rem/u);
    const fallbackSource = await articleImage.getAttribute('src');
    expect(fallbackSource).toContain('wp-content/uploads/');
    expect(fallbackSource).not.toContain('/_optimized/');
    await responsivePicture.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        articleImage.evaluate(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0,
        ),
      )
      .toBe(true);
    const selectedImage = await articleImage.evaluate(
      (image) => (image as HTMLImageElement).currentSrc,
    );
    expect(new URL(selectedImage).pathname).toContain(
      runtimePath('/_optimized/'),
    );

    await articleImage.click();
    const lightbox = page.locator('dialog[data-image-lightbox]');
    await expect(lightbox).toBeVisible();
    const previewSource = await lightbox
      .locator('[data-lightbox-image]')
      .getAttribute('src');
    expect(previewSource).toBeTruthy();
    expect(new URL(previewSource ?? '').pathname).toContain(
      runtimePath('/wp-content/uploads/'),
    );
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    await expect(lightbox.locator('[data-lightbox-image]')).not.toHaveAttribute(
      'src',
      /.+/u,
    );
    expect(runtimeErrors).toEqual([]);
  });

  test('the site follows the operating-system color scheme without JavaScript', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const response = await page.goto(runtimePath('/articles.html'));
    expect(response?.ok()).toBe(true);
    await expect(
      page.locator('meta[name="theme-color"][media*="dark"]'),
    ).toHaveAttribute('content', '#0e1514');

    const palette = () =>
      page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        return {
          background: rootStyle.getPropertyValue('--color-bg').trim(),
          colorScheme: rootStyle.colorScheme,
          ink: rootStyle.getPropertyValue('--color-ink').trim(),
        };
      });
    await expect.poll(palette).toEqual({
      background: '#0e1514',
      colorScheme: 'dark',
      ink: '#edf3ef',
    });

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(palette).toEqual({
      background: '#f4f1e9',
      colorScheme: 'light',
      ink: '#17201f',
    });
  });

  test('long article titles and legacy galleries stay within the viewport', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(
      runtimePath('/seo-newsletter-issue-18.html'),
    );
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'SEO電子報第十八期 – 2020.10.01~2020.10.15',
      }),
    ).toBeVisible();
    await expect(page.locator('.article__title-range-end')).toHaveCSS(
      'white-space',
      'nowrap',
    );

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(
      horizontalOverflow,
      `${testInfo.project.name} 長文不應水平溢位。`,
    ).toBeLessThanOrEqual(2);

    const gallery = page.locator('.blocks-gallery-grid').first();
    await expect(gallery).toBeVisible();
    expect(
      await gallery.evaluate(
        (element) => getComputedStyle(element).listStyleType,
      ),
    ).toBe('none');
  });

  test('a former members-only article is public and has no login gate', async ({
    page,
  }) => {
    const sample = fixture.memberPost;
    expect(sample.wasMembersOnly).toBe(true);
    const response = await page.goto(runtimePath(sample.canonicalPath));
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', { level: 1, name: sample.title }),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(
      page.locator('form[action*="login" i], a[href*="wp-login.php" i]'),
    ).toHaveCount(0);

    const robots = await page.evaluate(
      () =>
        document
          .querySelector('meta[name="robots"]')
          ?.getAttribute('content') ?? '',
    );
    expect(robots.toLowerCase()).not.toContain('noindex');
  });

  test('embed source links remain usable when third-party requests are blocked', async ({
    page,
  }) => {
    await page.route(
      /https?:\/\/(?:[^/]+\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be|twitter\.com|x\.com|spotify\.com)\//i,
      (route) => route.abort('blockedbyclient'),
    );

    const expectations: Array<{
      link: RegExp;
      provider: EmbedProvider;
      text: RegExp;
    }> = [
      {
        link: /youtube(?:-nocookie)?\.com|youtu\.be/i,
        provider: 'youtube',
        text: /在 YouTube 查看原始影片/,
      },
      {
        link: /twitter\.com|x\.com/i,
        provider: 'twitter',
        text: /在 Twitter／X 查看原始貼文/,
      },
      {
        link: /open\.spotify\.com/i,
        provider: 'spotify',
        text: /在 Spotify 查看原始內容/,
      },
    ];

    for (const expectation of expectations) {
      const sample = fixture.embedSamples[expectation.provider];
      const response = await page.goto(runtimePath(sample.canonicalPath));
      expect(response?.ok()).toBe(true);
      const fallback = page
        .getByRole('link', { name: expectation.text })
        .first();
      await expect(fallback).toBeVisible();
      expect(await fallback.getAttribute('href')).toMatch(expectation.link);
    }
  });

  test('both Stories expose exact visual pages, portable assets, and readable transcripts', async ({
    page,
  }) => {
    for (const sample of fixture.stories) {
      await test.step(sample.title, async () => {
        const response = await page.goto(runtimePath(sample.canonicalPath));
        expect(response?.ok()).toBe(true);
        expect(new URL(response?.url() ?? page.url()).pathname).toBe(
          runtimePath(sample.canonicalPath),
        );
        await expect(page).toHaveTitle(escapedRegExp(sample.title));

        const storyFrame = page.frameLocator('.story-player iframe');
        const visualPages = storyFrame.locator('amp-story-page');
        expect(await visualPages.count()).toBe(sample.modernPageCount);

        const firstPage = visualPages.first();
        await expect
          .poll(
            () =>
              firstPage.locator('amp-img').evaluateAll((elements) => {
                const images = elements.flatMap((element) => [
                  ...element.querySelectorAll('img'),
                  ...(element.shadowRoot?.querySelectorAll('img') ?? []),
                ]);
                return (
                  images.length > 0 &&
                  images.every(
                    (image) =>
                      image instanceof HTMLImageElement &&
                      image.complete &&
                      image.naturalWidth > 0,
                  )
                );
              }),
            {
              message: 'Story 第一頁的圖片應從目前的 BASE_PATH 成功載入。',
              timeout: 15_000,
            },
          )
          .toBe(true);

        const iframeSource = await page
          .locator('.story-player iframe')
          .getAttribute('src');
        const iframeSandbox = await page
          .locator('.story-player iframe')
          .getAttribute('sandbox');
        const publisherLogo = await storyFrame
          .locator('amp-story')
          .getAttribute('publisher-logo-src');
        expect(iframeSource).toBeTruthy();
        expect(iframeSandbox?.split(/\s+/).sort()).toEqual([
          'allow-popups',
          'allow-popups-to-escape-sandbox',
          'allow-scripts',
        ]);
        expect(publisherLogo).toBeTruthy();
        const storyDocumentUrl = new URL(iframeSource ?? '', page.url());
        const logoPath = new URL(publisherLogo ?? '', storyDocumentUrl)
          .pathname;
        expect(
          logoPath.startsWith(`${configuredBase}/wp-content/uploads/`),
        ).toBe(true);

        const transcript = page
          .locator(
            '[data-story-transcript], .story-transcript, [id*="transcript" i], main article',
          )
          .first();
        await expect(transcript).toBeVisible();
        expect((await transcript.innerText()).trim().length).toBeGreaterThan(
          100,
        );
      });
    }
  });

  test('agents can discover the site and fetch canonical Markdown alternates', async ({
    page,
    request,
  }) => {
    const llmsResponse = await request.get(runtimePath('/llms.txt'));
    expect(llmsResponse.ok()).toBe(true);
    expect(llmsResponse.headers()['content-type']).toContain('text/plain');
    const llms = await llmsResponse.text();
    expect(llms).toContain('# 數位引擎');
    expect(llms).toContain(
      new URL(
        runtimePath('/articles-llms.txt'),
        `${configuredSite}/`,
      ).toString(),
    );

    const articleIndexResponse = await request.get(
      runtimePath('/articles-llms.txt'),
    );
    expect(articleIndexResponse.ok()).toBe(true);
    const articleIndex = await articleIndexResponse.text();
    expect(articleIndex).toContain('共 86 篇繁體中文文章');

    const sample = fixture.representativePost;
    const htmlResponse = await page.goto(runtimePath(sample.canonicalPath));
    expect(htmlResponse?.ok()).toBe(true);
    const markdownPath = sample.canonicalPath.replace(/\.html$/u, '.md');
    const alternate = page.locator(
      'link[rel="alternate"][type="text/markdown"]',
    );
    await expect(alternate).toHaveAttribute(
      'href',
      new URL(runtimePath(markdownPath), `${configuredSite}/`).toString(),
    );

    const markdownResponse = await request.get(runtimePath(markdownPath));
    expect(markdownResponse.ok()).toBe(true);
    expect(markdownResponse.headers()['content-type']).toMatch(
      /text\/(?:markdown|plain)/,
    );
    const markdown = await markdownResponse.text();
    expect(markdown).toContain(`canonical: "${configuredSite}`);
    expect(markdown).toContain(`# ${sample.title}`);
    expect(markdown.length).toBeGreaterThan(500);

    const skillsResponse = await request.get(
      runtimePath('/.well-known/agent-skills/index.json'),
    );
    expect(skillsResponse.ok()).toBe(true);
    expect(skillsResponse.headers()['content-type']).toContain(
      'application/json',
    );
    const skills = (await skillsResponse.json()) as {
      $schema?: string;
      skills?: Array<{ digest?: string; name?: string; url?: string }>;
    };
    expect(skills.$schema).toBe(
      'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    );
    expect(skills.skills).toHaveLength(1);
    expect(skills.skills?.[0]).toMatchObject({
      name: 'research-digital-engine',
      url: 'research-digital-engine/SKILL.md',
    });
    expect(skills.skills?.[0]?.digest).toMatch(/^sha256:[a-f0-9]{64}$/u);

    const authResponse = await request.get(runtimePath('/auth.md'));
    expect(authResponse.ok()).toBe(true);
    expect(await authResponse.text()).toContain('不提供會員登入');

    const openApiResponse = await request.get(runtimePath('/openapi.json'));
    expect(openApiResponse.ok()).toBe(true);
    const openApi = (await openApiResponse.json()) as {
      openapi?: string;
      info?: { description?: string };
      paths?: Record<string, unknown>;
    };
    expect(openApi.openapi).toBe('3.1.0');
    expect(openApi.info?.description).toContain('API version policy');
    expect(openApi.paths).toEqual(
      expect.objectContaining({
        '/api/content.json': expect.anything(),
        '/api/articles/{slug}.json': expect.anything(),
        '/api/en/articles.json': expect.anything(),
        '/api/en/articles/{slug}.json': expect.anything(),
        '/api/en/notes.json': expect.anything(),
        '/api/en/notes/{slug}.json': expect.anything(),
        '/mcp': expect.anything(),
      }),
    );
    for (const alias of ['/api/openapi.json', '/api/swagger.json']) {
      const aliasResponse = await request.get(runtimePath(alias));
      expect(aliasResponse.ok()).toBe(true);
      const aliasOpenApi = (await aliasResponse.json()) as {
        openapi?: string;
      };
      expect(aliasOpenApi.openapi).toBe('3.1.0');
    }

    const contentResponse = await request.get(runtimePath('/api/content.json'));
    expect(contentResponse.ok()).toBe(true);
    const content = (await contentResponse.json()) as {
      count?: number;
      items?: Array<{ kind?: string; slug?: string }>;
    };
    expect(content.count).toBe(content.items?.length);
    expect(content.items?.some((item) => item.kind === 'article')).toBe(true);
    expect(content.items?.some((item) => item.kind === 'note')).toBe(true);

    const apiCatalogResponse = await request.get(
      runtimePath('/.well-known/api-catalog'),
    );
    expect(apiCatalogResponse.ok()).toBe(true);
    const apiCatalog = (await apiCatalogResponse.json()) as {
      linkset?: Array<{ item?: Array<{ href?: string }> }>;
    };
    expect(apiCatalog.linkset?.[0]?.item).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: new URL(
            runtimePath('/openapi.json'),
            `${configuredSite}/`,
          ).toString(),
        }),
        expect.objectContaining({
          href: new URL(runtimePath('/mcp'), `${configuredSite}/`).toString(),
        }),
      ]),
    );

    const ardCatalogResponse = await request.get(
      runtimePath('/.well-known/ai-catalog.json'),
    );
    expect(ardCatalogResponse.ok()).toBe(true);
    expect(ardCatalogResponse.headers()['content-type']).toMatch(
      /application\/(?:ai-catalog\+json|json)/,
    );
    const ardCatalog = (await ardCatalogResponse.json()) as {
      specVersion?: string;
      host?: { displayName?: string; identifier?: string };
      entries?: Array<{
        identifier?: string;
        type?: string;
        url?: string;
        representativeQueries?: string[];
      }>;
    };
    expect(ardCatalog).toMatchObject({
      specVersion: '1.0',
      host: {
        displayName: 'Digital Engine by Darren Huang / 數位引擎',
        identifier: 'https://www.darrenhuang.com',
      },
    });
    expect(ardCatalog.entries).toHaveLength(4);
    expect(
      ardCatalog.entries?.every(
        (entry) =>
          entry.identifier?.startsWith('urn:air:') &&
          typeof entry.type === 'string' &&
          typeof entry.url === 'string' &&
          (entry.representativeQueries?.length ?? 0) >= 2,
      ),
    ).toBe(true);

    const mcpCardResponse = await request.get(
      runtimePath('/.well-known/mcp/server-card.json'),
    );
    expect(mcpCardResponse.ok()).toBe(true);
    const mcpCard = (await mcpCardResponse.json()) as {
      name?: string;
      serverUrl?: string;
      transport?: { type?: string; endpoint?: string };
      tools?: Array<{ name?: string }>;
    };
    expect(mcpCard).toMatchObject({
      name: 'darrenhuang-public-content',
      serverUrl: new URL(runtimePath('/mcp'), `${configuredSite}/`).toString(),
    });
    expect(mcpCard.transport).toMatchObject({
      type: 'streamable-http',
      endpoint: configuredBase ? `${configuredBase}/mcp` : '/mcp',
    });
    expect(mcpCard.tools?.map((tool) => tool.name)).toEqual([
      'search_content',
      'read_content',
    ]);

    const homepageResponse = await page.goto(runtimePath('/'));
    expect(homepageResponse?.ok()).toBe(true);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    const homepageFooter = page.locator('footer');
    await expect(
      homepageFooter.locator('a[href$="/developers.html"]'),
    ).toBeVisible();
    await expect(
      homepageFooter.getByRole('heading', {
        name: '給開發者與 Agent 的公開入口',
      }),
    ).toBeVisible();
    await expect(page.locator('main')).not.toContainText(
      '給開發者與 Agent 的公開入口',
    );
    const homepageSchemaSource = await page
      .locator('head script[type="application/ld+json"]')
      .textContent();
    const homepageSchema = JSON.parse(
      homepageSchemaSource ?? '{}',
    ) as UnknownRecord;
    expect(homepageSchema).toMatchObject({
      '@type': 'Organization',
      email: 'darrenhhuang@gmail.com',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'general inquiries',
      },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Kaohsiung',
        addressCountry: 'TW',
      },
    });
    const homepageContent = await page.content();
    expect(homepageContent).toContain('document.modelContext');
    expect(homepageContent).toContain('digital_engine_search_content');
    expect(homepageContent).toContain('digital_engine_read_content');
    expect(homepageContent).toContain('new AbortController');
    expect(homepageContent).toContain('astro:before-swap');
    expect(homepageContent).toContain('registrationController.signal');

    const developerResponse = await page.goto(runtimePath('/developers.html'));
    expect(developerResponse?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', { level: 1, name: '開發者與 Agent 入口' }),
    ).toBeVisible();

    const membershipResponse = await page.goto(runtimePath('/membership.html'));
    expect(membershipResponse?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', { level: 1, name: '公開內容，不需要會員' }),
    ).toBeVisible();
  });

  test('the English site exposes matching pages, SEO alternates, and agent resources', async ({
    page,
    request,
  }) => {
    const homepageResponse = await page.goto(runtimePath('/en/'));
    expect(homepageResponse?.ok()).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Helping old ideas stay findable',
      }),
    ).toBeVisible();
    await expect(page.locator('link[hreflang="zh-Hant"]')).toHaveAttribute(
      'href',
      new URL(runtimePath('/'), `${configuredSite}/`).toString(),
    );
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
      'href',
      new URL(runtimePath('/en/'), `${configuredSite}/`).toString(),
    );
    await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
      'href',
      new URL(runtimePath('/en/'), `${configuredSite}/`).toString(),
    );

    const archiveResponse = await page.goto(runtimePath('/en/articles.html'));
    expect(archiveResponse?.ok()).toBe(true);
    await expect(page.locator('main article')).toHaveCount(10);

    const topicResponse = await page.goto(runtimePath('/en/tags/seo.html'));
    expect(topicResponse?.ok()).toBe(true);
    await expect(
      page.getByRole('link', { name: 'Switch to 繁體中文' }),
    ).toHaveAttribute('href', runtimePath('/tags/seo相關.html'));
    await expect(page.locator('link[hreflang="zh-Hant"]')).toHaveAttribute(
      'href',
      new URL(
        runtimePath('/tags/seo相關.html'),
        `${configuredSite}/`,
      ).toString(),
    );
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
      'href',
      new URL(
        runtimePath('/en/tags/seo.html'),
        `${configuredSite}/`,
      ).toString(),
    );

    const articlePath = '/en/how-search-engines-crawl.html';
    const articleResponse = await page.goto(runtimePath(articlePath));
    expect(articleResponse?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'How Search Engines Work: Crawling',
      }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'data-translation-key',
      'post:how-search-engines-crawl',
    );
    await expect(
      page.locator('meta[property="article:published_time"]'),
    ).toHaveAttribute('content', '2020-05-27T00:00:00.000Z');
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      'Diagram of the search engine process from crawling and rendering through indexing, algorithms, and ranking',
    );
    await expect(
      page.locator('meta[name="twitter:image:alt"]'),
    ).toHaveAttribute(
      'content',
      'Diagram of the search engine process from crawling and rendering through indexing, algorithms, and ranking',
    );
    await expect(page.locator('.article__historical-notice')).toContainText(
      'Originally published in Chinese on May 27, 2020',
    );
    expect(
      await page
        .locator('main img:not([data-lightbox-image])')
        .evaluateAll((images) =>
          images.every((image) => Boolean(image.getAttribute('alt')?.trim())),
        ),
    ).toBe(true);
    await expect(
      page.getByRole('link', { name: 'Switch to 繁體中文' }),
    ).toHaveAttribute('href', runtimePath('/how-search-engines-crawl.html'));

    const englishApiResponse = await request.get(
      runtimePath('/api/en/articles.json'),
    );
    expect(englishApiResponse.ok()).toBe(true);
    const englishApi = (await englishApiResponse.json()) as {
      count?: number;
      items?: Array<{
        language?: string;
        locale?: string;
        translationKey?: string;
      }>;
    };
    expect(englishApi.count).toBe(10);
    expect(englishApi.items).toHaveLength(10);
    expect(
      englishApi.items?.every(
        (item) =>
          item.locale === 'en' &&
          item.language === 'en' &&
          item.translationKey?.startsWith('post:'),
      ),
    ).toBe(true);

    const englishRssResponse = await request.get(runtimePath('/en/rss.xml'));
    expect(englishRssResponse.ok()).toBe(true);
    const englishRss = await englishRssResponse.text();
    expect(englishRss).toContain('<language>en-US</language>');
    expect(englishRss).toContain(
      new URL(runtimePath(articlePath), `${configuredSite}/`).toString(),
    );

    const englishLlmsResponse = await request.get(runtimePath('/en/llms.txt'));
    expect(englishLlmsResponse.ok()).toBe(true);
    expect(await englishLlmsResponse.text()).toContain(
      '10 English article translations',
    );
  });

  test('an unknown URL returns the custom 404 page', async ({ page }) => {
    const response = await page.goto(
      runtimePath('/__phase-5-missing-page__.html'),
    );
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: /這一頁不在引擎裡/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /回到首頁/ })).toBeVisible();
  });
});
