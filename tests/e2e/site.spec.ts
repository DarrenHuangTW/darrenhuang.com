import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import matter from 'gray-matter';

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

function canonicalPathname(href: string): string {
  const pathname = new URL(href, 'http://127.0.0.1:4321').pathname;
  if (configuredBase && pathname.startsWith(`${configuredBase}/`)) {
    return pathname.slice(configuredBase.length);
  }

  return pathname;
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

  test('desktop and mobile homepages expose the migrated collection', async ({
    page,
  }, testInfo) => {
    const response = await page.goto(runtimePath('/'));
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/數位引擎/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
    expect(canonicalPathname(canonical ?? '')).toBe(sample.canonicalPath);
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
