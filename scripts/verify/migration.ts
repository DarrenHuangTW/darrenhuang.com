import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import { PRODUCTION_SITE_URL } from '../../site.config';

import { normalizedTextChecksum, sha256 } from '../migrate-wordpress/output';
import { analyzeStoryHtml } from '../migrate-wordpress/transform/story';

type UnknownRecord = Record<string, unknown>;

interface ContentEntry {
  body: string;
  data: UnknownRecord;
  file: string;
}

const root = process.cwd();
const manifestPath = path.join(root, 'migration', 'manifest.json');
const postsRoot = path.join(root, 'src', 'content', 'posts');
const storiesRoot = path.join(root, 'src', 'content', 'stories');
const publicRoot = path.join(root, 'public');
const failures: string[] = [];
const warnings: string[] = [];
const sha256Pattern = /^[a-f0-9]{64}$/;
const publishedTextExtension =
  /\.(?:css|csv|html?|js|json|mdx?|svg|txt|webmanifest|ya?ml|xml)$/i;
const sensitiveExtension =
  /\.(?:sql(?:\.gz)?|xml\.gz|dump|sqlite3?|db|tar(?:\.gz)?|tgz|zip|7z|rar|wpress|pem|key|ppk|p12|pfx|jks|bak|backup)$/i;
const sensitiveName =
  /(?:^|[\\/])(?:id_rsa|credentials|secrets?|backup_[^\\/]*)$/i;
const credentialJsonName =
  /^(?:[^.]+[-_.])?(?:(?:credentials?|secrets?)(?:[-_.][^.]+)?|service[-_.]?account(?:[-_.](?:credentials?|key))?)\.json$/i;
const localAccessMaterialName =
  /^(?:\.htpasswd|\.netrc|\.npmrc|(?:browser[-_.]?)?cookies?(?:[-_.][^.]+)?\.json|(?:auth|storage)[-_.]?state(?:[-_.][^.]+)?\.json)$/i;
const sensitivePath =
  /(?:^|[\\/])(?:\.access|\.auth|\.aws|\.ssh)(?:[\\/]|$)|(?:^|[\\/])(?:[^\\/]*-db\.gz|[^\\/]*lightsail[^\\/]*\.xml|[^\\/]*wxr[^\\/]*\.xml)$/i;
const forbiddenPublishedTextPatterns: Array<[RegExp, string]> = [
  [/https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/gi, 'IPv4 origin URL'],
  [/66\.235\.200\.146/g, '舊 Bluehost origin IP'],
  [/(?:https?:)?\/\/127\.0\.0\.1(?::\d+)?/gi, 'WordPress loopback URL'],
  [
    /https?:\/\/member\.darrenhuang\.com\/(?:wp-admin|wp-login\.php|login|lostpassword|resetpass|password-reset)/gi,
    '失效會員登入 URL',
  ],
  [/http:\/\/(?:www\.)?darrenhuang\.com/gi, '非 HTTPS 正式站 URL'],
  [/AKIA[0-9A-Z]{16}/g, 'AWS access key 格式'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, '私鑰內容'],
  [
    /\bapi[_-]?key["']?\s*(?:=|:)\s*["']?(?!REDACTED\b)[A-Za-z\d_./+=-]{20,}/gi,
    '未遮蔽的高熵 API key value',
  ],
  [
    /\b(?:access[_-]?token|auth[_-]?token|awsaccesskeyid|bearer[_-]?token|client[_-]?secret|key-pair-id|policy|refresh[_-]?token|secret|signature|token|x-amz-credential|x-amz-security-token|x-amz-signature)["']?\s*(?:=|:)\s*["']?(?!REDACTED\b)[A-Za-z\d_./+=-]{12,}/gi,
    'credential value',
  ],
  [
    /\b(?:access[_-]?key|capability(?:[_-]?(?:key|token))?|download[_-]?(?:key|token)|invitation[_-]?token|invite[_-]?token|magic[_-]?link[_-]?token|note[_-]?key|share[_-]?(?:key|token)|signed[_-]?token)["']?\s*(?:=|:)\s*["']?(?!REDACTED\b)[A-Za-z\d_./+=%-]{12,}/gi,
    '未移除的 capability credential value',
  ],
  [/[A-Za-z]:\\Users\\[^\\\s]+\\/g, '本機絕對路徑'],
];

export interface ChecksumMismatch {
  actual: string;
  expected: string;
}

export function checksumMismatch(
  body: string,
  expected: string,
): ChecksumMismatch | undefined {
  const actual = normalizedTextChecksum(body);
  return actual === expected ? undefined : { actual, expected };
}

export function artifactChecksumMismatch(
  body: string,
  expected: string,
): ChecksumMismatch | undefined {
  const actual = sha256(body.replaceAll('\r\n', '\n'));
  return actual === expected ? undefined : { actual, expected };
}

export function shouldScanPublishedText(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!publishedTextExtension.test(normalized)) {
    return false;
  }

  return (
    !normalized.includes('/') ||
    /^(?:\.github|migration-report|migration|public|src\/content)\//i.test(
      normalized,
    )
  );
}

export function findForbiddenPublishedText(source: string): string[] {
  const findings = new Set<string>();

  for (const [pattern, label] of forbiddenPublishedTextPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) {
      findings.add(label);
    }
  }

  return [...findings];
}

export function isSensitiveRepositoryFile(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
  const basename = path.posix.basename(normalized);
  const isAllowedExample = normalized === '.env.example';

  if (
    !isAllowedExample &&
    (basename === '.env' || basename.startsWith('.env.'))
  ) {
    return true;
  }

  return (
    sensitiveExtension.test(basename) ||
    sensitiveName.test(normalized) ||
    credentialJsonName.test(basename) ||
    localAccessMaterialName.test(basename) ||
    sensitivePath.test(normalized)
  );
}

export function storyRecordMismatches(
  manifest: UnknownRecord,
  content: UnknownRecord,
): string[] {
  const mismatches: string[] = [];
  const directFields = [
    'aliases',
    'artifactChecksum',
    'canonicalPath',
    'legacyPageCount',
    'legacyWpId',
    'modernPageCount',
    'modernWpId',
    'slug',
    'sourceChecksum',
    'title',
    'transcript',
  ];

  for (const field of directFields) {
    if (
      manifest[field] !== undefined &&
      JSON.stringify(content[field]) !== JSON.stringify(manifest[field])
    ) {
      mismatches.push(field);
    }
  }

  const slug = stringValue(manifest, 'slug');
  if (
    slug &&
    stringValue(content, 'ampSourcePath') !== `/web-stories/${slug}/story.html`
  ) {
    mismatches.push('ampSourcePath');
  }

  const legacyComparison = content.legacyComparison;
  if (
    isRecord(legacyComparison) &&
    legacyComparison.decision !== manifest.comparisonDecision
  ) {
    mismatches.push('legacyComparison.decision');
  }

  return mismatches;
}

function check(condition: unknown, message: string): condition is true {
  if (!condition) {
    failures.push(message);
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function numberValue(record: UnknownRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function requireRecords(record: UnknownRecord, key: string): UnknownRecord[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    failures.push(`manifest.${key} 必須是陣列。`);
    return [];
  }

  const entries: unknown[] = value;
  const invalidCount = entries.filter((entry) => !isRecord(entry)).length;
  check(
    invalidCount === 0,
    `manifest.${key} 含有 ${invalidCount} 筆非物件資料。`,
  );
  return entries.filter(isRecord);
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(
  directory: string,
  ignoredDirectories = new Set<string>(),
): Promise<string[]> {
  if (!(await exists(directory))) {
    return [];
  }

  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute, ignoredDirectories)));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

function repositoryCandidateFiles(): string[] {
  const source = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  return source
    .split('\0')
    .filter(Boolean)
    .map((relative) => path.resolve(root, ...relative.split('/')));
}

async function readMarkdownEntries(directory: string): Promise<ContentEntry[]> {
  const files = (await walkFiles(directory)).filter((file) =>
    /\.mdx?$/i.test(file),
  );

  return Promise.all(
    files.map(async (file) => {
      const parsed = matter(await readFile(file, 'utf8'));
      return { body: parsed.content, data: parsed.data as UnknownRecord, file };
    }),
  );
}

async function readStoryEntries(directory: string): Promise<ContentEntry[]> {
  const files = (await walkFiles(directory)).filter((file) =>
    /\.(?:json|md)$/i.test(file),
  );

  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, 'utf8');
      if (file.toLowerCase().endsWith('.json')) {
        const parsed: unknown = JSON.parse(source);
        return {
          body: source,
          data: isRecord(parsed) ? parsed : {},
          file,
        };
      }

      const parsed = matter(source);
      return { body: parsed.content, data: parsed.data as UnknownRecord, file };
    }),
  );
}

function validatePostManifest(posts: UnknownRecord[]): void {
  const wpIds = new Set<number>();
  const slugs = new Set<string>();
  const canonicalPaths = new Set<string>();

  posts.forEach((post, index) => {
    const label = `manifest.posts[${index}]`;
    const wpId = numberValue(post, 'wpId');
    const slug = stringValue(post, 'slug');
    const canonicalPath = stringValue(post, 'canonicalPath');
    const sourceChecksum = stringValue(post, 'sourceChecksum');
    const normalizedTextChecksum = stringValue(post, 'normalizedTextChecksum');

    check(
      Number.isInteger(wpId) && (wpId ?? 0) > 0,
      `${label}.wpId 必須是正整數。`,
    );
    check(Boolean(slug), `${label}.slug 不可為空。`);
    check(
      Boolean(slug && canonicalPath === `/${slug}.html`),
      `${label}.canonicalPath 必須精確對應 /<slug>.html。`,
    );
    check(Array.isArray(post.aliases), `${label}.aliases 必須是陣列。`);
    check(
      sha256Pattern.test(sourceChecksum ?? ''),
      `${label}.sourceChecksum 必須是小寫 SHA-256。`,
    );
    check(
      sha256Pattern.test(normalizedTextChecksum ?? ''),
      `${label}.normalizedTextChecksum 必須是小寫 SHA-256。`,
    );
    check(
      post.originalStatus === 'publish' || post.originalStatus === 'private',
      `${label}.originalStatus 必須是 publish 或 private。`,
    );
    check(
      typeof post.wasMembersOnly === 'boolean',
      `${label}.wasMembersOnly 必須是 boolean。`,
    );
    check(
      Array.isArray(post.mediaDependencies),
      `${label}.mediaDependencies 必須是陣列。`,
    );
    check(Array.isArray(post.embeds), `${label}.embeds 必須是陣列。`);

    if (wpId !== undefined) {
      check(!wpIds.has(wpId), `${label}.wpId ${wpId} 重複。`);
      wpIds.add(wpId);
    }

    if (slug) {
      check(!slugs.has(slug), `${label}.slug ${slug} 重複。`);
      slugs.add(slug);
    }

    if (canonicalPath) {
      check(
        !canonicalPaths.has(canonicalPath),
        `${label}.canonicalPath ${canonicalPath} 重複。`,
      );
      canonicalPaths.add(canonicalPath);
    }
  });
}

function validateStoryManifest(stories: UnknownRecord[]): void {
  const slugs = new Set<string>();

  stories.forEach((story, index) => {
    const label = `manifest.stories[${index}]`;
    const slug = stringValue(story, 'slug');
    const canonicalPath = stringValue(story, 'canonicalPath');
    const modernWpId = numberValue(story, 'modernWpId');
    const legacyWpId = numberValue(story, 'legacyWpId');
    const modernPageCount = numberValue(story, 'modernPageCount');
    const legacyPageCount = numberValue(story, 'legacyPageCount');

    check(Boolean(slug), `${label}.slug 不可為空。`);
    check(
      Boolean(slug && canonicalPath === `/web-stories/${slug}/`),
      `${label}.canonicalPath 必須是 /web-stories/<slug>/。`,
    );
    check(
      Number.isInteger(modernWpId) && (modernWpId ?? 0) > 0,
      `${label}.modernWpId 必須是正整數。`,
    );
    check(
      Number.isInteger(legacyWpId) && (legacyWpId ?? 0) > 0,
      `${label}.legacyWpId 必須是正整數。`,
    );
    check(
      Number.isInteger(modernPageCount) && (modernPageCount ?? 0) > 0,
      `${label}.modernPageCount 必須是正整數。`,
    );
    check(
      Number.isInteger(legacyPageCount) && (legacyPageCount ?? 0) > 0,
      `${label}.legacyPageCount 必須是正整數。`,
    );
    check(Array.isArray(story.aliases), `${label}.aliases 必須是陣列。`);
    check(
      Array.isArray(story.mediaDependencies),
      `${label}.mediaDependencies 必須是陣列。`,
    );
    check(
      sha256Pattern.test(stringValue(story, 'sourceChecksum') ?? ''),
      `${label}.sourceChecksum 必須是 SHA-256。`,
    );
    check(
      sha256Pattern.test(stringValue(story, 'artifactChecksum') ?? ''),
      `${label}.artifactChecksum 必須是 SHA-256。`,
    );

    if (slug) {
      check(!slugs.has(slug), `${label}.slug ${slug} 重複。`);
      slugs.add(slug);
    }
  });

  check(
    stories.some(
      (story) =>
        numberValue(story, 'modernPageCount') === 10 &&
        numberValue(story, 'legacyPageCount') === 12,
    ),
    'Stories manifest 缺少新版 10 頁、legacy 12 頁的李奧貝納差異紀錄。',
  );
  check(
    stories.some(
      (story) =>
        numberValue(story, 'modernPageCount') === 13 &&
        numberValue(story, 'legacyPageCount') === 13,
    ),
    'Stories manifest 缺少新版與 legacy 都為 13 頁的英國首相故事紀錄。',
  );
}

function extractDependencyPath(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of [
    'publicPath',
    'path',
    'destination',
    'outputPath',
    'src',
  ]) {
    const candidate = stringValue(value, key);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeMediaPath(value: string): string | undefined {
  let pathname: string;

  try {
    const parsed = new URL(value, PRODUCTION_SITE_URL);
    if (
      /^(?:https?:)?\/\//i.test(value) &&
      ![
        'darrenhuang.com',
        'www.darrenhuang.com',
        'member.darrenhuang.com',
      ].includes(parsed.hostname.toLowerCase())
    ) {
      return undefined;
    }
    pathname = parsed.pathname;
    pathname = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }

  return pathname.startsWith('/wp-content/uploads/') ||
    pathname.startsWith('/story-media/')
    ? pathname
    : undefined;
}

async function verifyMediaDependencies(
  entries: UnknownRecord[],
): Promise<void> {
  const dependencies = new Set<string>();

  for (const entry of entries) {
    const values = entry.mediaDependencies;
    if (!Array.isArray(values)) {
      continue;
    }

    for (const value of values) {
      const rawPath = extractDependencyPath(value);
      if (!rawPath) {
        failures.push('mediaDependencies 含有無法辨識路徑的資料。');
        continue;
      }

      const normalized = normalizeMediaPath(rawPath);
      if (!normalized) {
        failures.push(`媒體 dependency 不是允許的站內媒體路徑：${rawPath}`);
        continue;
      }

      dependencies.add(normalized);
    }
  }

  check(
    dependencies.size > 0,
    'Manifest 沒有任何 media dependency；dependency graph 尚未產生。',
  );

  for (const dependency of dependencies) {
    const relative = dependency.replace(/^\/+/, '');
    const absolute = path.resolve(publicRoot, relative);
    const traversal = path.relative(publicRoot, absolute);

    if (traversal.startsWith('..') || path.isAbsolute(traversal)) {
      failures.push(`媒體 dependency 離開 public 目錄：${dependency}`);
      continue;
    }

    check(await exists(absolute), `缺少 manifest 引用的媒體：${dependency}`);
  }

  const contentRoots = [
    path.join(root, 'src', 'content', 'posts'),
    path.join(root, 'src', 'content', 'pages'),
    path.join(root, 'src', 'content', 'stories'),
  ];
  const mediaReferencePattern =
    /(?:https?:\/\/[^\s"'<>]+)?\/wp-content\/uploads\/[^\s"'<>]+/gi;

  for (const contentRoot of contentRoots) {
    for (const file of await walkFiles(contentRoot)) {
      if (!/\.(?:json|mdx?)$/i.test(file)) {
        continue;
      }

      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(mediaReferencePattern)) {
        const rawPath = match[0].replace(/[),.;]+$/g, '');
        const normalized = normalizeMediaPath(rawPath);
        if (!normalized) {
          continue;
        }

        const relativeFile = path.relative(root, file).replaceAll('\\', '/');
        check(
          dependencies.has(normalized),
          `${relativeFile} 引用的媒體未列入 dependency graph：${normalized}`,
        );

        const publicFile = path.resolve(
          publicRoot,
          normalized.replace(/^\/+/, ''),
        );
        check(
          await exists(publicFile),
          `${relativeFile} 引用不存在的媒體：${normalized}`,
        );
      }
    }
  }

  console.log(
    `[verify:migration] 已檢查 ${dependencies.size} 個唯一媒體 dependencies。`,
  );
}

async function scanForSensitiveFiles(files: string[]): Promise<void> {
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const basename = path.basename(file);

    if (isSensitiveRepositoryFile(relative)) {
      failures.push(`Repository 含有禁止提交的敏感檔名：${relative}`);
    }

    if (
      /^(?:migration\/(?:raw|exports|private)|private)\//i.test(relative) &&
      basename !== '.gitkeep'
    ) {
      failures.push(`Repository 含有私人 migration input：${relative}`);
    }
  }
}

async function scanPublishedText(files: string[]): Promise<void> {
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (!shouldScanPublishedText(relative)) {
      continue;
    }

    const source = await readFile(file, 'utf8');
    for (const label of findForbiddenPublishedText(source)) {
      failures.push(`${relative} 含有${label}。`);
    }
  }
}

async function validateContent(
  posts: UnknownRecord[],
  stories: UnknownRecord[],
  drafts: UnknownRecord[],
): Promise<void> {
  const postEntries = await readMarkdownEntries(postsRoot);
  const storyEntries = await readStoryEntries(storiesRoot);

  check(
    postEntries.length === 86,
    `正式文章檔案應為 86，實際為 ${postEntries.length}。`,
  );
  check(
    storyEntries.length === 2,
    `Story 來源檔案應為 2，實際為 ${storyEntries.length}。`,
  );

  const memberPosts = postEntries.filter(
    (entry) => entry.data.wasMembersOnly === true,
  );
  check(
    memberPosts.length === 41,
    `wasMembersOnly: true 應為 41，實際為 ${memberPosts.length}。`,
  );

  const publishedDrafts = postEntries.filter(
    (entry) =>
      entry.data.originalStatus === 'draft' ||
      entry.data.draft === true ||
      entry.data.published === false,
  );
  check(
    publishedDrafts.length === 0,
    `有 ${publishedDrafts.length} 篇 draft 被放入正式文章目錄。`,
  );
  check(
    drafts.length === 19,
    `Manifest drafts 應為 19，實際為 ${drafts.length}。`,
  );

  const postWpIds = new Set(
    postEntries
      .map((entry) => entry.data.wpId)
      .filter((value): value is number => typeof value === 'number'),
  );
  const draftWpIds = new Set<number>();

  drafts.forEach((draft, index) => {
    const wpId = numberValue(draft, 'wpId');
    const slug = stringValue(draft, 'slug');
    check(
      Number.isInteger(wpId) && (wpId ?? 0) > 0,
      `manifest.drafts[${index}].wpId 必須是正整數。`,
    );
    check(Boolean(slug), `manifest.drafts[${index}].slug 不可為空。`);
    check(
      draft.originalStatus === 'draft' || draft.status === 'draft',
      `manifest.drafts[${index}] 必須明確標示 draft 狀態。`,
    );

    if (wpId !== undefined) {
      check(!draftWpIds.has(wpId), `manifest.drafts 的 wpId ${wpId} 重複。`);
      check(!postWpIds.has(wpId), `Draft wpId ${wpId} 同時出現在正式文章中。`);
      draftWpIds.add(wpId);
    }
  });

  const contentByWpId = new Map<number, ContentEntry>();
  for (const entry of postEntries) {
    const wpId = entry.data.wpId;
    if (typeof wpId === 'number') {
      check(!contentByWpId.has(wpId), `文章 frontmatter wpId ${wpId} 重複。`);
      contentByWpId.set(wpId, entry);
    } else {
      failures.push(`${path.relative(root, entry.file)} 缺少數字 wpId。`);
    }
  }

  for (const post of posts) {
    const wpId = numberValue(post, 'wpId');
    if (wpId === undefined) {
      continue;
    }

    const content = contentByWpId.get(wpId);
    if (!check(content, `Manifest wpId ${wpId} 沒有對應文章檔案。`)) {
      continue;
    }

    check(
      content.data.slug === post.slug,
      `wpId ${wpId} 的 content slug 與 manifest 不一致。`,
    );
    check(
      content.data.canonicalPath === post.canonicalPath,
      `wpId ${wpId} 的 content canonicalPath 與 manifest 不一致。`,
    );
    check(
      content.data.wasMembersOnly === post.wasMembersOnly,
      `wpId ${wpId} 的 wasMembersOnly 與 manifest 不一致。`,
    );
    check(
      content.data.sourceChecksum === post.sourceChecksum,
      `wpId ${wpId} 的 sourceChecksum 與 manifest 不一致。`,
    );

    const expectedChecksum = stringValue(post, 'normalizedTextChecksum');
    if (expectedChecksum) {
      const mismatch = checksumMismatch(content.body, expectedChecksum);
      check(
        !mismatch,
        `wpId ${wpId} 的正文 checksum 漂移：manifest=${mismatch?.expected ?? expectedChecksum}，content=${mismatch?.actual ?? '(unknown)'}。`,
      );
    }
  }

  const requiredMissingSlugs = [
    'about-the-site',
    'how-to-show-images-in-google-search-results',
    'seo-reputation-managment',
  ];
  const contentSlugs = new Set(
    postEntries
      .map((entry) => entry.data.slug)
      .filter((value): value is string => typeof value === 'string'),
  );

  for (const slug of requiredMissingSlugs) {
    check(contentSlugs.has(slug), `舊 Vercel 缺漏文章尚未補回：${slug}`);
  }

  const manifestStorySlugs = new Set(
    stories
      .map((story) => stringValue(story, 'slug'))
      .filter((slug): slug is string => Boolean(slug)),
  );
  for (const entry of storyEntries) {
    const slug = stringValue(entry.data, 'slug');
    check(
      Boolean(slug && manifestStorySlugs.has(slug)),
      `${path.relative(root, entry.file)} 沒有對應 manifest Story。`,
    );
  }

  const storyContentBySlug = new Map<string, ContentEntry>();
  for (const entry of storyEntries) {
    const slug = stringValue(entry.data, 'slug');
    if (slug) {
      storyContentBySlug.set(slug, entry);
    }
  }

  for (const story of stories) {
    const slug = stringValue(story, 'slug');
    if (!slug) {
      continue;
    }

    const content = storyContentBySlug.get(slug);
    if (!check(content, `Manifest Story ${slug} 沒有對應內容檔案。`)) {
      continue;
    }

    for (const field of storyRecordMismatches(story, content.data)) {
      failures.push(`Story ${slug} 的 ${field} 與 manifest 不一致。`);
    }

    const artifactPath = path.resolve(
      publicRoot,
      'web-stories',
      slug,
      'story.html',
    );
    const artifactRelative = path.relative(publicRoot, artifactPath);
    if (
      artifactRelative.startsWith('..') ||
      path.isAbsolute(artifactRelative)
    ) {
      failures.push(`Story ${slug} 的 AMP artifact 離開 public 目錄。`);
      continue;
    }
    if (!check(await exists(artifactPath), `Story ${slug} 缺少 story.html。`)) {
      continue;
    }

    const ampHtml = await readFile(artifactPath, 'utf8');
    const expectedArtifactChecksum = stringValue(story, 'artifactChecksum');
    const artifactMismatch = expectedArtifactChecksum
      ? artifactChecksumMismatch(ampHtml, expectedArtifactChecksum)
      : undefined;
    check(
      Boolean(expectedArtifactChecksum && !artifactMismatch),
      `Story ${slug} 的 artifact checksum 漂移：manifest=${expectedArtifactChecksum ?? '(missing)'}，content=${artifactMismatch?.actual ?? '(unknown)'}。`,
    );

    const analysis = analyzeStoryHtml(ampHtml);
    const actualTranscript = analysis.pages.map((page) => ({
      id: page.id || `page-${page.index}`,
      order: page.index,
      lines: page.transcript,
    }));
    check(
      analysis.pageCount === numberValue(story, 'modernPageCount'),
      `Story ${slug} 的 AMP 頁數與 manifest 不一致。`,
    );
    check(
      analysis.title === stringValue(story, 'title'),
      `Story ${slug} 的 AMP title 與 manifest 不一致。`,
    );
    check(
      analysis.canonicalUrl ===
        `${PRODUCTION_SITE_URL}${stringValue(story, 'canonicalPath') ?? ''}`,
      `Story ${slug} 的 AMP canonical 與 manifest 不一致。`,
    );
    check(
      JSON.stringify(actualTranscript) === JSON.stringify(story.transcript),
      `Story ${slug} 的 AMP transcript 與 manifest 不一致。`,
    );
  }
}

async function main(): Promise<void> {
  if (!(await exists(manifestPath))) {
    throw new Error(
      '找不到 migration/manifest.json。請先執行 npm run migrate，完成 86 篇文章、19 篇 drafts 與 2 篇 Stories 的匯入。',
    );
  }

  const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!isRecord(parsed)) {
    throw new Error('migration/manifest.json 的根節點必須是 JSON object。');
  }

  const generatedAt = stringValue(parsed, 'generatedAt');
  check(
    Boolean(generatedAt && !Number.isNaN(Date.parse(generatedAt))),
    'manifest.generatedAt 必須是有效日期字串。',
  );

  const sourceChecksums = parsed.sourceChecksums ?? parsed.sources;
  const checksumMatches =
    JSON.stringify(sourceChecksums ?? {}).match(/[a-f0-9]{64}/g) ?? [];
  check(checksumMatches.length > 0, 'Manifest 必須保存至少一筆來源 checksum。');

  const posts = requireRecords(parsed, 'posts');
  const drafts = requireRecords(parsed, 'drafts');
  const pages = requireRecords(parsed, 'pages');
  const stories = requireRecords(parsed, 'stories');

  check(
    posts.length === 86,
    `Manifest posts 應為 86，實際為 ${posts.length}。`,
  );
  check(
    posts.filter((post) => post.wasMembersOnly === true).length === 41,
    'Manifest 必須正好有 41 篇 wasMembersOnly。',
  );
  check(
    stories.length === 2,
    `Manifest stories 應為 2，實際為 ${stories.length}。`,
  );
  check(
    Array.isArray(parsed.media) || isRecord(parsed.media),
    'manifest.media 必須是陣列或 object。',
  );
  check(
    pages.length > 0,
    'Manifest pages 不可為空，至少應包含選定的 About 內容。',
  );

  validatePostManifest(posts);
  validateStoryManifest(stories);
  await validateContent(posts, stories, drafts);
  await verifyMediaDependencies([...posts, ...pages, ...stories]);
  const candidateFiles = repositoryCandidateFiles();
  await scanForSensitiveFiles(candidateFiles);
  await scanPublishedText(candidateFiles);

  for (const warning of warnings) {
    console.warn(`[verify:migration] WARNING: ${warning}`);
  }

  if (failures.length > 0) {
    console.error(`[verify:migration] FAILED：${failures.length} 個問題。`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    '[verify:migration] PASS：86 篇文章、41 篇原會員文章、19 篇 drafts、2 篇 Stories 與媒體依賴均符合規格。',
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[verify:migration] FAILED：${message}`);
    process.exitCode = 1;
  });
}
