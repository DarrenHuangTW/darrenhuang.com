import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { decode } from 'html-entities';
import { parseMigrationOptions } from './args';
import {
  enrichLocalMediaHtml,
  internalLinkLookupKey,
  makeStoryAssetsBasePortable,
  normalizeMediaDependency,
  normalizePublishedDate,
  plainTextExcerpt,
  rewriteInternalContentLinks,
  safeDecodeSlug,
} from './html';
import { readLegacyAliases } from './legacy';
import { extractReferencedMedia, type PublishedMediaFile } from './media';
import {
  fingerprintSource,
  normalizedTextChecksum,
  removePreviousRootAliasPages,
  resetGeneratedDirectory,
  sha256,
  writeAliasPage,
  writeManifest,
  writePage,
  writePost,
  writeStory,
} from './output';
import { writeJsonReport, writePhaseFiveReport } from './reports';
import {
  applyRemoteStoryMirrors,
  mirrorRemoteStoryMedia,
} from './remote-media';
import {
  getPostMetaValues,
  readWordPressPostsGzipFile,
  readWxrFile,
  selectHistoricalPostStatuses,
  selectLegacyAmpStories,
  type WxrItem,
} from './source/index';
import {
  analyzeStoryHtml,
  transformWordPressContent,
  type StoryAnalysis,
  type TransformResult,
} from './transform/index';
import type {
  DraftManifestEntry,
  FeaturedMedia,
  MigrationManifest,
  PageManifestEntry,
  PostManifestEntry,
  StoryManifestEntry,
} from './types';

interface PostWork {
  item: WxrItem;
  manifest: PostManifestEntry;
  excerpt: string;
  transformed: TransformResult;
}

interface PageWork {
  item: WxrItem;
  manifest: PageManifestEntry;
  excerpt: string;
  featuredMedia: FeaturedMedia | null;
  transformed: TransformResult;
}

interface StoryWork {
  item: WxrItem;
  manifest: StoryManifestEntry;
  excerpt: string;
  poster: string | null;
  publishedAt: string;
  updatedAt: string;
  ampHtml: string;
  comparisonNotes: string[];
  omittedAssets: string[];
  modernAnalysis: StoryAnalysis;
  legacyAnalysis: StoryAnalysis;
}

const REQUIRED_MISSING_VERCEL_SLUGS = [
  'about-the-site',
  'how-to-show-images-in-google-search-results',
  'seo-reputation-managment',
];

const STORY_SPECS = {
  'boris-johnson-shady-seo-campaign': {
    legacyWpId: 765,
    modernWpId: 1867,
    expectedLegacyPages: 13,
    expectedModernPages: 13,
    decision: '新版與舊版皆為 13 頁，canonical 採用新版 Web Story。',
    notes: [
      '新版與舊版頁數相同。',
      '舊版外連線索保留在版本差異報告，不另建第二個 canonical。',
    ],
    omittedAssets: [],
  },
  'leo-burnett-backfire-seo-campaign': {
    legacyWpId: 614,
    modernWpId: 1498,
    expectedLegacyPages: 12,
    expectedModernPages: 10,
    decision:
      '新版 10 頁是舊版 12 頁的合併重寫，canonical 保留新版，不機械補回兩頁。',
    notes: [
      '舊版第 4、5 頁合併為新版第 4 頁。',
      '舊版第 7、8 頁的成功說明合併為新版第 6 頁。',
      '舊版第 9 頁的批評與第 11 頁的媒體傷害合併為新版第 8 頁。',
      '舊版第 2 頁的 V1 宣傳片移到新版第 7 頁。',
      '舊版第 5、7 頁本來是沒有文字的純視覺頁。',
    ],
    omittedAssets: ['V3-1-2.png', 'wiki-2-1.png', 'news-1.png', 'news-6-1.png'],
  },
} as const;

function assertCount(label: string, actual: number, expected: number): void {
  if (actual !== expected)
    throw new Error(`${label}: expected ${expected}, received ${actual}.`);
}

function normalizeSource(value: string): string {
  return value.replaceAll('\r\n', '\n').normalize('NFC');
}

function unique(values: Iterable<string>): string[] {
  return [
    ...new Set(
      [...values].map((value) => value.normalize('NFC').trim()).filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right, 'zh-Hant'));
}

function localMediaPaths(transformed: TransformResult): string[] {
  return unique(
    transformed.report.mediaDependencies
      .filter((dependency) => !dependency.external)
      .map((dependency) => normalizeMediaDependency(dependency.rewrittenUrl))
      .filter((dependency): dependency is string => dependency !== null),
  );
}

function externalMediaUrls(transformed: TransformResult): string[] {
  return unique(
    transformed.report.mediaDependencies
      .filter((dependency) => dependency.external)
      .map((dependency) => dependency.originalUrl),
  );
}

function attachmentPath(item: WxrItem): string | null {
  const attachedFile = getPostMetaValues(item, '_wp_attached_file')[0];
  if (!attachedFile) return null;
  const normalized = normalizeMediaDependency(
    `/wp-content/uploads/${attachedFile}`,
  );
  if (!normalized)
    throw new Error(
      `Attachment ${item.wpId} has an unsafe _wp_attached_file value.`,
    );
  return normalized;
}

function featuredMediaFor(
  item: WxrItem,
  attachmentsById: Map<number, WxrItem>,
): FeaturedMedia | null {
  const rawId = getPostMetaValues(item, '_thumbnail_id')[0];
  if (!rawId) return null;
  const attachment = attachmentsById.get(Number(rawId));
  if (!attachment)
    throw new Error(
      `Post ${item.wpId} references missing featured attachment ${rawId}.`,
    );
  const src = attachmentPath(attachment);
  if (!src) throw new Error(`Featured attachment ${rawId} has no source file.`);

  return {
    src,
    alt:
      getPostMetaValues(attachment, '_wp_attachment_image_alt')[0]?.trim() ??
      '',
  };
}

function oldSlugAliases(item: WxrItem): string[] {
  return getPostMetaValues(item, '_wp_old_slug').map(
    (slug) => `/${safeDecodeSlug(slug, `post-${item.wpId}`)}.html`,
  );
}

function excerptFor(
  item: WxrItem,
  transformedHtml: string,
  legacySummary?: string,
): string {
  if (item.excerpt.trim()) return plainTextExcerpt(item.excerpt);
  if (legacySummary?.trim()) return plainTextExcerpt(legacySummary);
  return plainTextExcerpt(transformedHtml);
}

function mediaForManifest(
  mirror: Awaited<ReturnType<typeof mirrorRemoteStoryMedia>>[number],
): PublishedMediaFile {
  return {
    path: mirror.localPath,
    bytes: mirror.bytes,
    sha256: mirror.sha256,
    mime: mirror.localPath.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg',
  };
}

function storyMirrorPath(
  value: string,
  mirrors: Awaited<ReturnType<typeof mirrorRemoteStoryMedia>>,
): string {
  const decoded = decode(value);
  return (
    mirrors.find((mirror) => decoded.startsWith(mirror.sourceKey))?.localPath ??
    value
  );
}

function findStoryPoster(
  analysis: StoryAnalysis,
  mirrors: Awaited<ReturnType<typeof mirrorRemoteStoryMedia>>,
): string | null {
  const poster = analysis.assets.find((asset) => asset.kind === 'poster');
  if (!poster) return null;
  const mirrored = storyMirrorPath(poster.rewrittenUrl, mirrors);
  return (
    normalizeMediaDependency(mirrored) ??
    (mirrored.startsWith('/') ? mirrored : null)
  );
}

function generatedAtFrom(items: WxrItem[]): string {
  const latest = items
    .map((item) => item.dates.modified.gmt)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!latest)
    throw new Error('WXR does not contain a usable modified GMT timestamp.');
  return `${latest.replace(' ', 'T')}Z`;
}

function scanTextFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return scanTextFiles(absolute);
    return /\.(?:css|html|json|md|mjs|ts|txt|xml)$/i.test(entry.name)
      ? [absolute]
      : [];
  });
}

function assertNoOriginLeak(
  repoRoot: string,
  configuredInternalHosts: string[],
): void {
  const generatedRoots = [
    path.join(repoRoot, 'src', 'content'),
    path.join(repoRoot, 'migration'),
    path.join(repoRoot, 'migration-report'),
    path.join(repoRoot, 'public', 'blog'),
    path.join(repoRoot, 'public', 'web-stories'),
  ];
  const forbidden = [
    /127\.0\.0\.1/,
    /member\.darrenhuang\.com/i,
    /www\.darrenhuang\.com\/wp-content/i,
    /storage\.coverr\.co/i,
    ...configuredInternalHosts.map(
      (host) => new RegExp(host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    ),
  ];
  const leaks: string[] = [];

  for (const file of generatedRoots.flatMap(scanTextFiles)) {
    const source = readFileSync(file, 'utf8');
    if (forbidden.some((pattern) => pattern.test(source)))
      leaks.push(path.relative(repoRoot, file));
  }
  if (leaks.length > 0)
    throw new Error(
      `Generated output still contains retired origins: ${leaks.join(', ')}`,
    );
}

async function run(): Promise<void> {
  const options = parseMigrationOptions();
  const [wxr, latestSql, memberSql, sourceFingerprints] = await Promise.all([
    readWxrFile(options.wxrPath),
    readWordPressPostsGzipFile(options.latestDatabasePath),
    readWordPressPostsGzipFile(options.memberDatabasePath),
    Promise.all([
      fingerprintSource(options.wxrPath),
      fingerprintSource(options.latestDatabasePath),
      fingerprintSource(options.memberDatabasePath),
      fingerprintSource(options.uploadsArchivePath),
    ]),
  ]);
  const [
    wxrFingerprint,
    latestFingerprint,
    memberFingerprint,
    uploadsFingerprint,
  ] = sourceFingerprints;

  const wxrPosts = wxr.items.filter((item) => item.postType === 'post');
  const publishedItems = wxrPosts.filter((item) => item.status === 'publish');
  const draftItems = wxrPosts.filter((item) => item.status === 'draft');
  const pageItems = wxr.items.filter((item) => item.postType === 'page');
  const attachmentItems = wxr.items.filter(
    (item) => item.postType === 'attachment',
  );
  const modernStoryItems = wxr.items.filter(
    (item) => item.postType === 'web-story',
  );
  assertCount('Published posts', publishedItems.length, 86);
  assertCount('Draft posts', draftItems.length, 19);
  assertCount('WordPress pages', pageItems.length, 6);
  assertCount('Attachments', attachmentItems.length, 976);
  assertCount('Modern Web Stories', modernStoryItems.length, 2);

  const latestArticles = latestSql.posts.filter(
    (post) => post.postType === 'post',
  );
  const latestById = new Map(latestArticles.map((post) => [post.id, post]));
  assertCount('Latest SQL article rows', latestArticles.length, 105);
  for (const item of wxrPosts) {
    const sqlPost = latestById.get(item.wpId);
    if (!sqlPost)
      throw new Error(`Latest SQL is missing WXR article ${item.wpId}.`);
    if (normalizeSource(sqlPost.content) !== normalizeSource(item.content)) {
      throw new Error(
        `Latest SQL and WXR body differ for article ${item.wpId}.`,
      );
    }
  }

  const historicalStatuses = selectHistoricalPostStatuses(memberSql);
  const historicalById = new Map(
    historicalStatuses.map((entry) => [entry.wpId, entry.originalStatus]),
  );
  assertCount(
    'Historical member DB article rows',
    historicalStatuses.length,
    105,
  );
  for (const item of wxrPosts) {
    if (!historicalById.has(item.wpId))
      throw new Error(`Member DB is missing article ${item.wpId}.`);
  }
  assertCount(
    'Former member-only posts',
    historicalStatuses.filter((entry) => entry.originalStatus === 'private')
      .length,
    41,
  );

  const attachmentsById = new Map(
    attachmentItems.map((item) => [item.wpId, item]),
  );
  for (const attachment of attachmentItems) {
    if (!attachmentPath(attachment))
      throw new Error(
        `Attachment ${attachment.wpId} has no _wp_attached_file.`,
      );
  }

  const legacyStories = selectLegacyAmpStories(latestSql);
  assertCount('Legacy AMP Stories', legacyStories.length, 2);
  const legacyStoriesById = new Map(
    legacyStories.map((story) => [story.id, story]),
  );
  const legacy = readLegacyAliases(options.legacyRepoPath);
  const allCanonicalPaths = new Set(
    publishedItems.map(
      (item) => `/${safeDecodeSlug(item.slug, `post-${item.wpId}`)}.html`,
    ),
  );
  allCanonicalPaths.add('/about.html');
  const internalRedirects = new Map<string, string>();
  for (const item of publishedItems) {
    const slug = safeDecodeSlug(item.slug, `post-${item.wpId}`);
    const canonicalPath = `/${slug}.html`;
    internalRedirects.set(internalLinkLookupKey(slug), canonicalPath);
    internalRedirects.set(internalLinkLookupKey(`${slug}.html`), canonicalPath);
    for (const oldSlug of getPostMetaValues(item, '_wp_old_slug')) {
      internalRedirects.set(
        internalLinkLookupKey(safeDecodeSlug(oldSlug, slug)),
        canonicalPath,
      );
    }
    for (const permalink of getPostMetaValues(item, 'blogger_permalink')) {
      internalRedirects.set(internalLinkLookupKey(permalink), canonicalPath);
    }
  }
  internalRedirects.set('about-darren-huang', '/about.html');
  internalRedirects.set('about-darren-huang.html', '/about.html');
  const excludedSlugs = new Set(
    draftItems.flatMap((item) => [
      internalLinkLookupKey(safeDecodeSlug(item.slug, `draft-${item.wpId}`)),
      ...getPostMetaValues(item, '_wp_old_slug').map((slug) =>
        internalLinkLookupKey(safeDecodeSlug(slug, `draft-${item.wpId}`)),
      ),
    ]),
  );

  const archiveDependencies = new Set<string>();
  const externalReferences = new Set<string>();
  const unknownBlocks: Array<{
    wpId: number;
    slug: string;
    entries: TransformResult['report']['unknownBlocks'];
  }> = [];
  const embedReport: Array<{
    wpId: number;
    slug: string;
    entries: TransformResult['report']['embeds'];
  }> = [];
  const unresolvedLinkReport: Array<{
    wpId: number;
    slug: string;
    links: string[];
  }> = [];
  const postWork: PostWork[] = [];

  for (const item of publishedItems) {
    const slug = safeDecodeSlug(item.slug, `post-${item.wpId}`);
    const historicalStatus = historicalById.get(item.wpId);
    if (historicalStatus !== 'publish' && historicalStatus !== 'private') {
      throw new Error(
        `Published WXR article ${item.wpId} had unexpected historical status ${historicalStatus}.`,
      );
    }
    const transformed = transformWordPressContent(item.content, {
      internalHosts: options.internalHosts,
    });
    const rewrittenLinks = rewriteInternalContentLinks({
      html: transformed.html,
      redirects: internalRedirects,
      excludedSlugs,
      internalHosts: options.internalHosts,
    });
    transformed.html = rewrittenLinks.html;
    const featuredMedia = featuredMediaFor(item, attachmentsById);
    const dependencies = new Set(localMediaPaths(transformed));
    if (featuredMedia) dependencies.add(featuredMedia.src);
    for (const dependency of dependencies) archiveDependencies.add(dependency);
    for (const external of externalMediaUrls(transformed))
      externalReferences.add(external);

    const canonicalPath = `/${slug}.html`;
    const aliases = unique([
      ...(legacy.bySlug.get(slug) ?? []),
      ...oldSlugAliases(item),
    ]).filter(
      (alias) => alias !== canonicalPath && !allCanonicalPaths.has(alias),
    );
    const sourceChecksum = sha256(normalizeSource(item.content));
    const manifest: PostManifestEntry = {
      wpId: item.wpId,
      slug,
      title: item.title.trim().normalize('NFC'),
      canonicalPath,
      aliases,
      publishedAt: normalizePublishedDate(item.dates.published.local),
      updatedAt: normalizePublishedDate(item.dates.modified.local),
      originalStatus: historicalStatus,
      wasMembersOnly: historicalStatus === 'private',
      sourceChecksum,
      normalizedTextChecksum: normalizedTextChecksum(transformed.html),
      categories: unique(
        item.categories
          .filter((category) => category.domain === 'category')
          .map((category) => category.name),
      ),
      tags: unique(legacy.tagsBySlug.get(slug) ?? []),
      featuredMedia,
      mediaDependencies: [...dependencies].sort(),
      embeds: transformed.report.embeds.map((embed) => ({
        provider: embed.provider,
        url: embed.sourceUrl,
      })),
    };
    postWork.push({
      item,
      manifest,
      excerpt: excerptFor(
        item,
        transformed.html,
        legacy.summaryBySlug.get(slug),
      ),
      transformed,
    });
    if (transformed.report.unknownBlocks.length > 0) {
      unknownBlocks.push({
        wpId: item.wpId,
        slug,
        entries: transformed.report.unknownBlocks,
      });
    }
    if (transformed.report.embeds.length > 0) {
      embedReport.push({
        wpId: item.wpId,
        slug,
        entries: transformed.report.embeds,
      });
    }
    if (rewrittenLinks.unresolved.length > 0) {
      unresolvedLinkReport.push({
        wpId: item.wpId,
        slug,
        links: rewrittenLinks.unresolved,
      });
    }
  }

  for (const requiredSlug of REQUIRED_MISSING_VERCEL_SLUGS) {
    if (!postWork.some((post) => post.manifest.slug === requiredSlug)) {
      throw new Error(
        `Required historical article is missing: ${requiredSlug}`,
      );
    }
  }

  const drafts: DraftManifestEntry[] = draftItems
    .map((item) => ({
      wpId: item.wpId,
      slug: safeDecodeSlug(item.slug, `draft-${item.wpId}`),
      title: item.title.trim().normalize('NFC'),
      status: 'draft' as const,
      sourceChecksum: sha256(normalizeSource(item.content)),
    }))
    .sort((left, right) => left.wpId - right.wpId);

  const pages: PageManifestEntry[] = pageItems
    .map((item) => {
      const sourceSlug = safeDecodeSlug(item.slug, `page-${item.wpId}`);
      if (item.wpId === 90) {
        return {
          wpId: item.wpId,
          sourceSlug,
          slug: 'about',
          title: item.title.trim().normalize('NFC'),
          canonicalPath: '/about.html',
          aliases: ['/about-darren-huang.html'],
          decision: 'publish' as const,
          reason: '依規格搬遷「關於作者」為正式內容頁。',
          sourceChecksum: sha256(normalizeSource(item.content)),
          mediaDependencies: [],
        };
      }

      const systemPage = item.wpId === 2504 || item.wpId === 2512;
      return {
        wpId: item.wpId,
        sourceSlug,
        slug: sourceSlug,
        title: item.title.trim().normalize('NFC'),
        canonicalPath: `/${sourceSlug}.html`,
        aliases: [],
        decision: systemPage
          ? ('exclude-system-page' as const)
          : ('review' as const),
        reason: systemPage
          ? '會員登入或舊 404 系統頁不搬成可操作功能。'
          : '會員說明或 draft page 保留在人工審核清單，不預設發布。',
        sourceChecksum: sha256(normalizeSource(item.content)),
        mediaDependencies: [],
      };
    })
    .sort((left, right) => left.wpId - right.wpId);

  const aboutItem = pageItems.find((item) => item.wpId === 90);
  if (!aboutItem) throw new Error('About page ID 90 is missing.');
  const aboutTransformed = transformWordPressContent(aboutItem.content, {
    internalHosts: options.internalHosts,
  });
  const aboutRewrittenLinks = rewriteInternalContentLinks({
    html: aboutTransformed.html,
    redirects: internalRedirects,
    excludedSlugs,
    internalHosts: options.internalHosts,
  });
  aboutTransformed.html = aboutRewrittenLinks.html;
  const aboutFeatured = featuredMediaFor(aboutItem, attachmentsById);
  const aboutDependencies = new Set(localMediaPaths(aboutTransformed));
  if (aboutFeatured) aboutDependencies.add(aboutFeatured.src);
  for (const dependency of aboutDependencies)
    archiveDependencies.add(dependency);
  for (const external of externalMediaUrls(aboutTransformed))
    externalReferences.add(external);
  const aboutManifest = pages.find((page) => page.wpId === 90)!;
  aboutManifest.mediaDependencies = [...aboutDependencies].sort();
  const pageWork: PageWork[] = [
    {
      item: aboutItem,
      manifest: aboutManifest,
      excerpt: excerptFor(aboutItem, aboutTransformed.html),
      featuredMedia: aboutFeatured,
      transformed: aboutTransformed,
    },
  ];
  if (aboutRewrittenLinks.unresolved.length > 0) {
    unresolvedLinkReport.push({
      wpId: aboutItem.wpId,
      slug: 'about',
      links: aboutRewrittenLinks.unresolved,
    });
  }

  const storyWork: StoryWork[] = [];
  const remoteMediaFiles: PublishedMediaFile[] = [];
  const storyComparisonReport: unknown[] = [];
  for (const [slug, spec] of Object.entries(STORY_SPECS)) {
    const modernItem = modernStoryItems.find(
      (item) => item.wpId === spec.modernWpId,
    );
    const legacyItem = legacyStoriesById.get(spec.legacyWpId);
    if (!modernItem || !legacyItem)
      throw new Error(`Story source pair is incomplete for ${slug}.`);
    if (safeDecodeSlug(modernItem.slug, `story-${modernItem.wpId}`) !== slug) {
      throw new Error(
        `Modern Story ${modernItem.wpId} has an unexpected slug.`,
      );
    }

    const canonicalUrl = `https://darrenhuang.com/web-stories/${slug}/`;
    const storyOptions = {
      canonicalUrl,
      internalHosts: options.internalHosts,
      language: 'zh-Hant',
      publisherLogoUrl:
        '/wp-content/uploads/2020/10/%E6%95%B8%E4%BD%8D%E5%BC%95%E6%93%8E-logo.png',
      siteUrl: 'https://darrenhuang.com/',
      slug,
      title: modernItem.title,
    };
    const modernAnalysis = analyzeStoryHtml(modernItem.content, storyOptions);
    const legacyAnalysis = analyzeStoryHtml(legacyItem.content, storyOptions);
    assertCount(
      `${slug} modern pages`,
      modernAnalysis.pageCount,
      spec.expectedModernPages,
    );
    assertCount(
      `${slug} legacy pages`,
      legacyAnalysis.pageCount,
      spec.expectedLegacyPages,
    );

    const remoteUrls = unique(
      modernAnalysis.assets
        .filter((asset) => asset.external)
        .map((asset) => asset.sourceUrl),
    );
    const mirrors = await mirrorRemoteStoryMedia({
      repoRoot: options.repoRoot,
      storySlug: slug,
      urls: remoteUrls,
    });
    remoteMediaFiles.push(...mirrors.map(mediaForManifest));
    const ampHtml = makeStoryAssetsBasePortable(
      applyRemoteStoryMirrors(modernAnalysis.normalizedHtml, mirrors),
    );
    const storyDependencies = new Set<string>();
    for (const asset of modernAnalysis.assets) {
      if (asset.external) {
        const mirrored = storyMirrorPath(asset.rewrittenUrl, mirrors);
        if (mirrored.startsWith('/')) storyDependencies.add(mirrored);
        else externalReferences.add(asset.sourceUrl);
      } else {
        const dependency = normalizeMediaDependency(asset.rewrittenUrl);
        if (dependency) {
          storyDependencies.add(dependency);
          archiveDependencies.add(dependency);
        }
      }
    }

    const manifest: StoryManifestEntry = {
      slug,
      title: modernItem.title.trim().normalize('NFC'),
      canonicalPath: `/web-stories/${slug}/`,
      aliases: [`/${slug}.html`],
      modernWpId: spec.modernWpId,
      legacyWpId: spec.legacyWpId,
      modernPageCount: modernAnalysis.pageCount,
      legacyPageCount: legacyAnalysis.pageCount,
      sourceChecksum: sha256(normalizeSource(modernItem.content)),
      artifactChecksum: sha256(ampHtml.replaceAll('\r\n', '\n')),
      mediaDependencies: [...storyDependencies].sort(),
      remoteMedia: mirrors.map((mirror) => mirror.localPath),
      transcript: modernAnalysis.pages.map((page) => ({
        id: page.id || `page-${page.index}`,
        order: page.index,
        lines: page.transcript,
      })),
      comparisonDecision: spec.decision,
    };
    storyWork.push({
      item: modernItem,
      manifest,
      excerpt: plainTextExcerpt(modernAnalysis.transcript.join(' ')),
      poster: findStoryPoster(modernAnalysis, mirrors),
      publishedAt: normalizePublishedDate(modernItem.dates.published.local),
      updatedAt: normalizePublishedDate(modernItem.dates.modified.local),
      ampHtml,
      comparisonNotes: [...spec.notes],
      omittedAssets: [...spec.omittedAssets],
      modernAnalysis,
      legacyAnalysis,
    });
    storyComparisonReport.push({
      slug,
      decision: spec.decision,
      notes: spec.notes,
      omittedAssets: spec.omittedAssets,
      modern: {
        wpId: spec.modernWpId,
        pageCount: modernAnalysis.pageCount,
        pages: modernAnalysis.pages.map((page) => ({
          id: page.id,
          order: page.index,
          transcript: page.transcript,
        })),
      },
      legacy: {
        wpId: spec.legacyWpId,
        pageCount: legacyAnalysis.pageCount,
        pages: legacyAnalysis.pages.map((page) => ({
          id: page.id,
          order: page.index,
          transcript: page.transcript,
        })),
      },
    });
  }

  const extractedMedia = await extractReferencedMedia({
    archivePath: options.uploadsArchivePath,
    dependencies: archiveDependencies,
    repoRoot: options.repoRoot,
  });
  const allMediaFiles = [...extractedMedia.files, ...remoteMediaFiles].sort(
    (left, right) => left.path.localeCompare(right.path, 'zh-Hant'),
  );
  const mediaByPath = new Map(allMediaFiles.map((file) => [file.path, file]));
  for (const work of postWork) {
    const featured = work.manifest.featuredMedia;
    const media = featured ? mediaByPath.get(featured.src) : undefined;
    if (featured && media) {
      featured.width = media.width;
      featured.height = media.height;
    }
  }
  for (const work of pageWork) {
    const media = work.featuredMedia
      ? mediaByPath.get(work.featuredMedia.src)
      : undefined;
    if (work.featuredMedia && media) {
      work.featuredMedia.width = media.width;
      work.featuredMedia.height = media.height;
    }
  }

  removePreviousRootAliasPages(options.repoRoot);
  for (const directory of [
    path.join(options.repoRoot, 'src', 'content', 'posts'),
    path.join(options.repoRoot, 'src', 'content', 'pages'),
    path.join(options.repoRoot, 'src', 'content', 'stories'),
    path.join(options.repoRoot, 'public', 'blog'),
    path.join(options.repoRoot, 'public', 'web-stories'),
  ]) {
    resetGeneratedDirectory(options.repoRoot, directory);
  }

  for (const work of postWork) {
    const publishedHtml = enrichLocalMediaHtml(
      work.transformed.html,
      allMediaFiles,
    );
    work.manifest.normalizedTextChecksum =
      normalizedTextChecksum(publishedHtml);
    writePost({
      repoRoot: options.repoRoot,
      manifest: work.manifest,
      excerpt: work.excerpt,
      html: publishedHtml,
    });
    for (const alias of work.manifest.aliases) {
      writeAliasPage({
        repoRoot: options.repoRoot,
        alias,
        canonicalPath: work.manifest.canonicalPath,
        title: work.manifest.title,
      });
    }
  }
  for (const work of pageWork) {
    writePage({
      repoRoot: options.repoRoot,
      manifest: work.manifest,
      excerpt: work.excerpt,
      featuredMedia: work.featuredMedia,
      html: enrichLocalMediaHtml(work.transformed.html, allMediaFiles),
      updatedAt: normalizePublishedDate(work.item.dates.modified.local),
    });
    for (const alias of work.manifest.aliases) {
      writeAliasPage({
        repoRoot: options.repoRoot,
        alias,
        canonicalPath: work.manifest.canonicalPath,
        title: work.manifest.title,
      });
    }
  }
  for (const work of storyWork) {
    writeStory({
      repoRoot: options.repoRoot,
      story: work.manifest,
      excerpt: work.excerpt,
      poster: work.poster,
      publishedAt: work.publishedAt,
      updatedAt: work.updatedAt,
      ampHtml: work.ampHtml,
      comparisonNotes: work.comparisonNotes,
      omittedAssets: work.omittedAssets,
    });
    for (const alias of work.manifest.aliases) {
      writeAliasPage({
        repoRoot: options.repoRoot,
        alias,
        canonicalPath: work.manifest.canonicalPath,
        title: work.manifest.title,
      });
    }
  }

  const contentDiff = postWork.map((work) => {
    const legacyBody = legacy.bodyBySlug.get(work.manifest.slug);
    const legacyChecksum = legacyBody
      ? normalizedTextChecksum(legacyBody)
      : null;
    return {
      wpId: work.manifest.wpId,
      slug: work.manifest.slug,
      sourceChecksum: work.manifest.sourceChecksum,
      normalizedTextChecksum: work.manifest.normalizedTextChecksum,
      legacyNormalizedTextChecksum: legacyChecksum,
      comparison:
        legacyChecksum === null
          ? 'not-in-legacy-repo'
          : legacyChecksum === work.manifest.normalizedTextChecksum
            ? 'match'
            : 'changed',
    };
  });
  const totalMediaBytes = allMediaFiles.reduce(
    (total, file) => total + file.bytes,
    0,
  );
  const manifest: MigrationManifest = {
    schemaVersion: 1,
    generatedAt: generatedAtFrom(wxr.items),
    sources: {
      wxr: wxrFingerprint,
      latestDatabase: latestFingerprint,
      memberDatabase: memberFingerprint,
      uploadsArchive: uploadsFingerprint,
    },
    summary: {
      posts: postWork.length,
      formerMemberPosts: postWork.filter((post) => post.manifest.wasMembersOnly)
        .length,
      draftsExcluded: drafts.length,
      pagesPublished: pageWork.length,
      stories: storyWork.length,
      mediaFiles: allMediaFiles.length,
      mediaBytes: totalMediaBytes,
    },
    posts: postWork
      .map((work) => work.manifest)
      .sort((left, right) => left.wpId - right.wpId),
    drafts,
    pages,
    stories: storyWork
      .map((work) => work.manifest)
      .sort((left, right) => left.slug.localeCompare(right.slug)),
    media: {
      files: allMediaFiles,
      duplicateContent: extractedMedia.duplicateContent,
      totalBytes: totalMediaBytes,
      externalReferences: [...externalReferences].sort(),
    },
  };
  assertCount('Generated posts', manifest.summary.posts, 86);
  assertCount(
    'Generated former member posts',
    manifest.summary.formerMemberPosts,
    41,
  );
  assertCount('Excluded drafts', manifest.summary.draftsExcluded, 19);
  assertCount('Generated Stories', manifest.summary.stories, 2);
  writeManifest(options.repoRoot, manifest);
  writeJsonReport(options.repoRoot, 'drafts.json', drafts);
  writeJsonReport(options.repoRoot, 'pages-review.json', pages);
  writeJsonReport(options.repoRoot, 'unknown-blocks.json', unknownBlocks);
  writeJsonReport(options.repoRoot, 'embeds.json', embedReport);
  writeJsonReport(
    options.repoRoot,
    'rewritten-or-removed-links.json',
    unresolvedLinkReport,
  );
  writeJsonReport(options.repoRoot, 'content-differences.json', contentDiff);
  writeJsonReport(
    options.repoRoot,
    'story-comparison.json',
    storyComparisonReport,
  );
  writeJsonReport(
    options.repoRoot,
    'media-dependency-graph.json',
    Object.fromEntries([
      ...postWork.map((work) => [
        work.manifest.canonicalPath,
        work.manifest.mediaDependencies,
      ]),
      ...pageWork.map((work) => [
        work.manifest.canonicalPath,
        work.manifest.mediaDependencies,
      ]),
      ...storyWork.map((work) => [
        work.manifest.canonicalPath,
        work.manifest.mediaDependencies,
      ]),
    ]),
  );
  writePhaseFiveReport({
    repoRoot: options.repoRoot,
    manifest,
    unknownBlockCount: unknownBlocks.reduce(
      (total, report) => total + report.entries.length,
      0,
    ),
    externalReferenceCount: externalReferences.size,
    legacyComparisonChanged: contentDiff.filter(
      (entry) => entry.comparison === 'changed',
    ).length,
  });
  assertNoOriginLeak(options.repoRoot, options.internalHosts);

  const publishedBytes =
    statSync(path.join(options.repoRoot, 'migration', 'manifest.json')).size +
    totalMediaBytes;
  console.log(
    JSON.stringify(
      {
        posts: manifest.summary.posts,
        formerMemberPosts: manifest.summary.formerMemberPosts,
        draftsExcluded: manifest.summary.draftsExcluded,
        stories: manifest.summary.stories,
        mediaFiles: manifest.summary.mediaFiles,
        mediaMiB: Number((publishedBytes / 1024 / 1024).toFixed(2)),
      },
      null,
      2,
    ),
  );
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exitCode = 1;
});
