import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;

type SuggestedRender =
  'article-candidate' | 'note-candidate' | 'media-review' | 'archive-only';

interface CliOptions {
  input: string;
  compare?: string;
  output: string;
}

interface NormalizedMediaReference {
  relativeUri: string;
  mediaType: 'audio' | 'image' | 'unknown' | 'video';
  description: string;
}

interface ExtractedPostText {
  text: string;
  source: 'media-description' | 'none' | 'post' | 'post+media-description';
}

export interface NormalizedFacebookPost {
  recordId: string;
  publishedAt: string | null;
  title: string;
  kind: 'link' | 'media' | 'other' | 'photo' | 'status' | 'video';
  text: string;
  textLength: number;
  textSource: ExtractedPostText['source'];
  externalLinks: string[];
  media: NormalizedMediaReference[];
  sourceFile: string;
  sourceIndex: number;
  contentFingerprint: string | null;
  duplicateGroupSize: number;
  suggestedRender: SuggestedRender;
  autoSignals: string[];
  reviewFlags: string[];
}

interface MediaFile {
  relativePath: string;
  mediaType: 'audio' | 'image' | 'unknown' | 'video';
  extension: string;
  bytes: number;
  referencedByPostCount: number;
}

interface ExportComparison {
  firstFileCount: number;
  secondFileCount: number;
  firstHtmlFileCount: number;
  secondHtmlFileCount: number;
  sameFileCount: number;
  differentFileCount: number;
  missingFromSecondCount: number;
  missingFromFirstCount: number;
  differentExamples: string[];
}

interface InventorySummary {
  generatedAt: string;
  inputRoot: string;
  activityRoot: string;
  page: {
    id: string | null;
    name: string;
  };
  includedSources: string[];
  excludedRoots: string[];
  warnings: string[];
  comparison?: ExportComparison;
  posts: {
    records: number;
    earliestPublishedAt: string | null;
    latestPublishedAt: string | null;
    withText: number;
    withExternalLinks: number;
    withMedia: number;
    linkOnly: number;
    withMembershipReferences: number;
    duplicateGroups: number;
    duplicateRecords: number;
    suggestedRenderCounts: Record<SuggestedRender, number>;
  };
  media: {
    files: number;
    bytes: number;
    imageFiles: number;
    videoFiles: number;
    referencedFiles: number;
    unreferencedFiles: number;
    metadataRecords: {
      videos: number;
      photos: number;
      albums: number;
    };
  };
}

const decoder = new TextDecoder('utf-8', { fatal: false });
const activityDirectoryName = "this_profile's_activity_across_facebook";
const profilePostsPattern = /^profile_posts(?:_\d+)?\.json$/u;
const mediaExtensions = new Map<string, MediaFile['mediaType']>([
  ['.aac', 'audio'],
  ['.gif', 'image'],
  ['.jpeg', 'image'],
  ['.jpg', 'image'],
  ['.m4a', 'audio'],
  ['.mp3', 'audio'],
  ['.mp4', 'video'],
  ['.png', 'image'],
  ['.webp', 'image'],
]);

function usage(): string {
  return [
    'Usage: npx tsx scripts/audit/facebook-export.ts --input <export> [options]',
    '',
    'Options:',
    '  --input <path>    Facebook export directory (required)',
    '  --compare <path>  Optional second export directory to compare by SHA-256',
    '  --output <path>   Local output directory (default: .tmp/facebook-export)',
    '  --help            Show this help',
  ].join('\n');
}

function nextValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function parseOptions(args: string[]): CliOptions | undefined {
  let input = '';
  let compare: string | undefined;
  let output = path.resolve('.tmp/facebook-export');

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') {
      return undefined;
    }

    if (argument === '--input') {
      input = nextValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument?.startsWith('--input=')) {
      input = argument.slice('--input='.length);
      continue;
    }

    if (argument === '--compare') {
      compare = nextValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument?.startsWith('--compare=')) {
      compare = argument.slice('--compare='.length);
      continue;
    }

    if (argument === '--output') {
      output = path.resolve(nextValue(args, index, argument));
      index += 1;
      continue;
    }

    if (argument?.startsWith('--output=')) {
      output = path.resolve(argument.slice('--output='.length));
      continue;
    }

    throw new Error(`Unknown option: ${argument ?? ''}`);
  }

  if (!input) {
    throw new Error('--input is required.');
  }

  return {
    input: path.resolve(input),
    compare: compare ? path.resolve(compare) : undefined,
    output,
  };
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function repairMojibake(value: string): string {
  if (
    !value ||
    [...value].some((character) => (character.codePointAt(0) ?? 0) > 0xff) ||
    !/[\u0080-\u009f]|(?:[\u00c2-\u00f4][\u0080-\u00bf])/u.test(value)
  ) {
    return value;
  }

  const bytes = Uint8Array.from(
    [...value].map((character) => character.charCodeAt(0) & 0xff),
  );
  const decoded = decoder.decode(bytes);
  return decoded.includes('\ufffd') ? value : decoded;
}

function cleanText(value: string): string {
  const normalized = repairMojibake(value)
    .replace(/@\[[^:\]]+:\d+:([^\]]+)\]/gu, '$1')
    .replace(/\r\n?/gu, '\n');
  return [...normalized]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(
        (codePoint >= 0 && codePoint <= 8) ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        codePoint === 127 ||
        codePoint === 0xfffc
      );
    })
    .join('')
    .trim();
}

function normalizedComparisonText(value: string): string {
  return cleanText(value)
    .normalize('NFKC')
    .toLocaleLowerCase('zh-Hant')
    .replace(/\s+/gu, '');
}

function isNearDuplicate(left: string, right: string): boolean {
  const normalizedLeft = normalizedComparisonText(left);
  const normalizedRight = normalizedComparisonText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const shorter =
    normalizedLeft.length <= normalizedRight.length
      ? normalizedLeft
      : normalizedRight;
  const longer =
    normalizedLeft.length > normalizedRight.length
      ? normalizedLeft
      : normalizedRight;

  return shorter.length >= 120 && longer.includes(shorter);
}

function relativeSlashPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\/+/, '');
}

function activityRelativeUri(value: string): string {
  const normalized = relativeSlashPath(value);
  const activityPrefix = `${activityDirectoryName}/`;
  return normalized.startsWith(activityPrefix)
    ? normalized.slice(activityPrefix.length)
    : normalized;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function readJsonObject(filePath: string): JsonObject {
  const value = asObject(readJson(filePath));
  if (!value) {
    throw new Error(`Expected a JSON object: ${filePath}`);
  }

  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function findActivityRoot(inputRoot: string): string {
  const direct = path.join(inputRoot, activityDirectoryName);
  if (existsSync(direct) && statSync(direct).isDirectory()) {
    return direct;
  }

  if (
    existsSync(inputRoot) &&
    statSync(inputRoot).isDirectory() &&
    path.basename(inputRoot) === activityDirectoryName
  ) {
    return inputRoot;
  }

  throw new Error(
    `Could not find ${activityDirectoryName} under ${inputRoot}.`,
  );
}

function listFiles(root: string): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  visit(root);
  return files.toSorted((left, right) => left.localeCompare(right));
}

function getActivityRelativePath(
  activityRoot: string,
  filePath: string,
): string {
  return relativeSlashPath(path.relative(activityRoot, filePath));
}

function getPostText(post: JsonObject): ExtractedPostText {
  const directText = asArray(post.data)
    .map(asObject)
    .filter((item): item is JsonObject => item !== null)
    .map((item) => cleanText(asString(item.post)))
    .filter(Boolean);

  const mediaText = asArray(post.attachments)
    .flatMap((attachment) => {
      const attachmentObject = asObject(attachment);
      return attachmentObject ? asArray(attachmentObject.data) : [];
    })
    .map(asObject)
    .filter((item): item is JsonObject => item !== null)
    .map((item) => asObject(item.media))
    .filter((item): item is JsonObject => item !== null)
    .map((item) => cleanText(asString(item.description)))
    .filter(Boolean);

  const uniqueDirectText = [...new Set(directText)];
  const uniqueMediaText = [...new Set(mediaText)].filter(
    (mediaValue) =>
      !uniqueDirectText.some((directValue) =>
        isNearDuplicate(directValue, mediaValue),
      ),
  );
  const values = [...uniqueDirectText, ...uniqueMediaText];
  return {
    text: values.join('\n\n'),
    source:
      uniqueDirectText.length > 0 && uniqueMediaText.length > 0
        ? 'post+media-description'
        : uniqueDirectText.length > 0
          ? 'post'
          : uniqueMediaText.length > 0
            ? 'media-description'
            : 'none',
  };
}

function extractTextLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/\S+/gu) ?? [];
  return matches
    .map((match) => match.replace(/[.,;:!?，。；：！？)\]}]+$/gu, ''))
    .filter(Boolean);
}

function getExternalLinks(post: JsonObject, text: string): string[] {
  const links = asArray(post.attachments)
    .flatMap((attachment) => {
      const attachmentObject = asObject(attachment);
      return attachmentObject ? asArray(attachmentObject.data) : [];
    })
    .map(asObject)
    .filter((item): item is JsonObject => item !== null)
    .map((item) => asObject(item.external_context))
    .filter((item): item is JsonObject => item !== null)
    .map((item) => asString(item.url).trim())
    .filter(Boolean);

  return [...new Set([...links, ...extractTextLinks(text)])];
}

function getMediaReferences(post: JsonObject): NormalizedMediaReference[] {
  const references = asArray(post.attachments)
    .flatMap((attachment) => {
      const attachmentObject = asObject(attachment);
      return attachmentObject ? asArray(attachmentObject.data) : [];
    })
    .map(asObject)
    .filter((item): item is JsonObject => item !== null)
    .map((item) => asObject(item.media))
    .filter((item): item is JsonObject => item !== null)
    .map((media) => {
      const relativeUri = activityRelativeUri(asString(media.uri));
      const extension = path.posix.extname(relativeUri).toLowerCase();
      return {
        relativeUri,
        mediaType: mediaExtensions.get(extension) ?? 'unknown',
        description: cleanText(asString(media.description)),
      } satisfies NormalizedMediaReference;
    })
    .filter((item) => item.relativeUri.length > 0);

  const unique = new Map<string, NormalizedMediaReference>();
  for (const reference of references) {
    unique.set(reference.relativeUri, reference);
  }

  return [...unique.values()];
}

function getPostKind(
  title: string,
  media: NormalizedMediaReference[],
  externalLinks: string[],
): NormalizedFacebookPost['kind'] {
  const normalizedTitle = title.toLocaleLowerCase('en-US');
  if (normalizedTitle.includes('video')) return 'video';
  if (normalizedTitle.includes('photo')) return 'photo';
  if (normalizedTitle.includes('status')) return 'status';
  if (media.length > 0) return 'media';
  if (externalLinks.length > 0 || normalizedTitle.includes('link')) {
    return 'link';
  }
  return 'other';
}

function getSuggestedRender(
  text: string,
  kind: NormalizedFacebookPost['kind'],
  externalLinks: string[],
): { render: SuggestedRender; signals: string[] } {
  const signals: string[] = [];
  if (text.length > 0) signals.push('has-text');
  if (text.length >= 500) signals.push('long-text');
  if (externalLinks.length > 0) signals.push('has-external-link');
  if (kind === 'video') signals.push('video-post');
  if (kind === 'photo' || kind === 'media') signals.push('media-post');

  if (text.length >= 500) {
    return { render: 'article-candidate', signals };
  }
  if (text.length >= 80 || externalLinks.length > 0) {
    return { render: 'note-candidate', signals };
  }
  if (kind === 'photo' || kind === 'video' || kind === 'media') {
    return { render: 'media-review', signals };
  }
  return { render: 'archive-only', signals };
}

function getContentFingerprint(text: string): string | null {
  const normalized = text
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
  return normalized.length >= 30 ? sha256(normalized).slice(0, 16) : null;
}

function getReviewFlags(text: string, externalLinks: string[]): string[] {
  const combined = `${text}\n${externalLinks.join('\n')}`;
  const flags: string[] = [];
  if (text.length === 0 && externalLinks.length > 0) flags.push('link-only');
  if (
    /member\.darrenhuang\.com|\/membership(?:[/?#]|$)|\bmembership\b/iu.test(
      combined,
    )
  ) {
    flags.push('membership-reference');
  }
  return flags;
}

function normalizePost(
  post: JsonObject,
  sourceFile: string,
  sourceIndex: number,
): NormalizedFacebookPost {
  const timestamp = asFiniteNumber(post.timestamp);
  const publishedAt = timestamp === null ? null : new Date(timestamp * 1000);
  const title = cleanText(asString(post.title));
  const extractedText = getPostText(post);
  const { text } = extractedText;
  const externalLinks = getExternalLinks(post, text);
  const media = getMediaReferences(post);
  const kind = getPostKind(title, media, externalLinks);
  const suggested = getSuggestedRender(text, kind, externalLinks);
  const sourceKey = `${sourceFile}#${sourceIndex}`;

  return {
    recordId: `fb-${sha256(sourceKey).slice(0, 16)}`,
    publishedAt: publishedAt?.toISOString() ?? null,
    title,
    kind,
    text,
    textLength: text.length,
    textSource: extractedText.source,
    externalLinks,
    media,
    sourceFile,
    sourceIndex,
    contentFingerprint: getContentFingerprint(text),
    duplicateGroupSize: 1,
    suggestedRender: suggested.render,
    autoSignals: suggested.signals,
    reviewFlags: getReviewFlags(text, externalLinks),
  };
}

function loadPosts(activityRoot: string): NormalizedFacebookPost[] {
  const postsDirectory = path.join(activityRoot, 'posts');
  const postFiles = readdirSync(postsDirectory)
    .filter((fileName) => profilePostsPattern.test(fileName))
    .toSorted();
  const posts: NormalizedFacebookPost[] = [];

  for (const fileName of postFiles) {
    const filePath = path.join(postsDirectory, fileName);
    const values = asArray(readJson(filePath));
    const sourceFile = getActivityRelativePath(activityRoot, filePath);
    values.forEach((value, sourceIndex) => {
      const post = asObject(value);
      if (post) {
        posts.push(normalizePost(post, sourceFile, sourceIndex));
      }
    });
  }

  const sortedPosts = posts.toSorted((left, right) => {
    const leftTime = left.publishedAt ?? '';
    const rightTime = right.publishedAt ?? '';
    return (
      leftTime.localeCompare(rightTime) ||
      left.recordId.localeCompare(right.recordId)
    );
  });

  const fingerprintCounts = new Map<string, number>();
  for (const post of sortedPosts) {
    if (post.contentFingerprint) {
      fingerprintCounts.set(
        post.contentFingerprint,
        (fingerprintCounts.get(post.contentFingerprint) ?? 0) + 1,
      );
    }
  }
  for (const post of sortedPosts) {
    post.duplicateGroupSize = post.contentFingerprint
      ? (fingerprintCounts.get(post.contentFingerprint) ?? 1)
      : 1;
    if (post.duplicateGroupSize > 1) post.reviewFlags.push('duplicate-text');
  }

  return sortedPosts;
}

function getMediaFileType(filePath: string): MediaFile['mediaType'] {
  return mediaExtensions.get(path.extname(filePath).toLowerCase()) ?? 'unknown';
}

function loadMediaFiles(
  activityRoot: string,
  posts: NormalizedFacebookPost[],
): MediaFile[] {
  const mediaRoot = path.join(activityRoot, 'posts', 'media');
  const references = new Map<string, number>();
  for (const post of posts) {
    for (const media of post.media) {
      references.set(
        media.relativeUri,
        (references.get(media.relativeUri) ?? 0) + 1,
      );
    }
  }

  if (!existsSync(mediaRoot)) return [];
  return listFiles(mediaRoot).map((filePath) => {
    const relativePath = getActivityRelativePath(activityRoot, filePath);
    const extension = path.extname(filePath).toLowerCase();
    return {
      relativePath,
      mediaType: getMediaFileType(filePath),
      extension,
      bytes: statSync(filePath).size,
      referencedByPostCount: references.get(relativePath) ?? 0,
    } satisfies MediaFile;
  });
}

function countMediaMetadata(
  activityRoot: string,
): InventorySummary['media']['metadataRecords'] {
  const postsRoot = path.join(activityRoot, 'posts');
  const videosPath = path.join(postsRoot, 'videos.json');
  const photosPath = path.join(postsRoot, 'uncategorized_photos.json');
  const albumRoot = path.join(postsRoot, 'album');
  const videos = existsSync(videosPath)
    ? asArray(readJsonObject(videosPath).videos_v2).length
    : 0;
  const photos = existsSync(photosPath)
    ? asArray(readJsonObject(photosPath).other_photos_v2).length
    : 0;
  const albums = existsSync(albumRoot)
    ? readdirSync(albumRoot).filter((fileName) => fileName.endsWith('.json'))
        .length
    : 0;

  return { videos, photos, albums };
}

function getPageInfo(activityRoot: string): InventorySummary['page'] {
  const adminPath = path.join(activityRoot, 'pages', 'admin_activity.json');
  if (!existsSync(adminPath)) return { id: null, name: '' };
  const admin = readJsonObject(adminPath);
  const labelValues = asArray(admin.label_values)
    .map(asObject)
    .filter((item): item is JsonObject => item !== null);
  const name = labelValues.find((item) => item.label === 'Name');
  return {
    id: asString(admin.fbid) || null,
    name: cleanText(asString(name?.value)),
  };
}

function getTextCounts(
  posts: NormalizedFacebookPost[],
): InventorySummary['posts'] {
  const suggestedRenderCounts: Record<SuggestedRender, number> = {
    'article-candidate': 0,
    'note-candidate': 0,
    'media-review': 0,
    'archive-only': 0,
  };
  for (const post of posts) {
    suggestedRenderCounts[post.suggestedRender] += 1;
  }

  const dates = posts
    .map((post) => post.publishedAt)
    .filter((date): date is string => date !== null)
    .toSorted();

  return {
    records: posts.length,
    earliestPublishedAt: dates[0] ?? null,
    latestPublishedAt: dates.at(-1) ?? null,
    withText: posts.filter((post) => post.text.length > 0).length,
    withExternalLinks: posts.filter((post) => post.externalLinks.length > 0)
      .length,
    withMedia: posts.filter((post) => post.media.length > 0).length,
    linkOnly: posts.filter((post) => post.reviewFlags.includes('link-only'))
      .length,
    withMembershipReferences: posts.filter((post) =>
      post.reviewFlags.includes('membership-reference'),
    ).length,
    duplicateGroups: new Set(
      posts
        .filter((post) => post.duplicateGroupSize > 1)
        .map((post) => post.contentFingerprint),
    ).size,
    duplicateRecords: posts.filter((post) => post.duplicateGroupSize > 1)
      .length,
    suggestedRenderCounts,
  };
}

function compareDirectories(
  firstRoot: string,
  secondRoot: string,
): ExportComparison {
  const firstFiles = listFiles(firstRoot);
  const secondFiles = listFiles(secondRoot);
  const firstByRelativePath = new Map(
    firstFiles.map((filePath) => [
      relativeSlashPath(path.relative(firstRoot, filePath)),
      filePath,
    ]),
  );
  const secondByRelativePath = new Map(
    secondFiles.map((filePath) => [
      relativeSlashPath(path.relative(secondRoot, filePath)),
      filePath,
    ]),
  );
  const allPaths = new Set([
    ...firstByRelativePath.keys(),
    ...secondByRelativePath.keys(),
  ]);
  let sameFileCount = 0;
  let differentFileCount = 0;
  let missingFromSecondCount = 0;
  let missingFromFirstCount = 0;
  const differentExamples: string[] = [];

  for (const relativePath of [...allPaths].toSorted()) {
    const firstFile = firstByRelativePath.get(relativePath);
    const secondFile = secondByRelativePath.get(relativePath);
    if (!firstFile) {
      missingFromFirstCount += 1;
      continue;
    }
    if (!secondFile) {
      missingFromSecondCount += 1;
      continue;
    }

    const firstHash = readFileSync(firstFile);
    const secondHash = readFileSync(secondFile);
    if (
      createHash('sha256').update(firstHash).digest('hex') ===
      createHash('sha256').update(secondHash).digest('hex')
    ) {
      sameFileCount += 1;
    } else {
      differentFileCount += 1;
      if (differentExamples.length < 20) differentExamples.push(relativePath);
    }
  }

  return {
    firstFileCount: firstFiles.length,
    secondFileCount: secondFiles.length,
    firstHtmlFileCount: firstFiles.filter(
      (filePath) => path.extname(filePath).toLowerCase() === '.html',
    ).length,
    secondHtmlFileCount: secondFiles.filter(
      (filePath) => path.extname(filePath).toLowerCase() === '.html',
    ).length,
    sameFileCount,
    differentFileCount,
    missingFromSecondCount,
    missingFromFirstCount,
    differentExamples,
  };
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeReviewCsv(
  filePath: string,
  posts: NormalizedFacebookPost[],
): void {
  const headers = [
    'recordId',
    'publishedAt',
    'kind',
    'suggestedRender',
    'title',
    'textLength',
    'textSource',
    'text',
    'externalLinks',
    'mediaCount',
    'sourceFile',
    'sourceIndex',
    'contentFingerprint',
    'duplicateGroupSize',
    'autoSignals',
    'reviewFlags',
  ];
  const rows = posts.map((post) => [
    post.recordId,
    post.publishedAt,
    post.kind,
    post.suggestedRender,
    post.title,
    post.textLength,
    post.textSource,
    post.text,
    post.externalLinks.join(' | '),
    post.media.length,
    post.sourceFile,
    post.sourceIndex,
    post.contentFingerprint,
    post.duplicateGroupSize,
    post.autoSignals.join(' | '),
    post.reviewFlags.join(' | '),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(','))
    .join('\n');
  writeFileSync(filePath, `\ufeff${csv}\n`, 'utf8');
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function buildInventory(options: CliOptions): InventorySummary {
  const inputRoot = options.input;
  const activityRoot = findActivityRoot(inputRoot);
  const posts = loadPosts(activityRoot);
  const mediaFiles = loadMediaFiles(activityRoot, posts);
  const comparison = options.compare
    ? compareDirectories(inputRoot, options.compare)
    : undefined;
  const postSummary = getTextCounts(posts);
  const mediaMetadata = countMediaMetadata(activityRoot);
  const page = getPageInfo(activityRoot);
  const comparisonWarning =
    comparison &&
    (comparison.differentFileCount > 0 ||
      comparison.missingFromFirstCount > 0 ||
      comparison.missingFromSecondCount > 0)
      ? 'The comparison export differs; review the comparison report before merging sources.'
      : comparison
        ? comparison.firstHtmlFileCount === 0 &&
          comparison.secondHtmlFileCount === 0
          ? 'The comparison export is byte-identical by relative path and SHA-256; neither directory contains HTML files.'
          : 'The comparison export is byte-identical by relative path and SHA-256.'
        : 'No second export was supplied for comparison.';

  const summary: InventorySummary = {
    generatedAt: new Date().toISOString(),
    inputRoot,
    activityRoot,
    page,
    includedSources: [
      "this_profile's_activity_across_facebook/pages/admin_activity.json",
      "this_profile's_activity_across_facebook/posts/profile_posts_*.json",
      "this_profile's_activity_across_facebook/posts/media/**",
      "this_profile's_activity_across_facebook/posts/videos.json",
      "this_profile's_activity_across_facebook/posts/uncategorized_photos.json",
      "this_profile's_activity_across_facebook/posts/album/*.json",
    ],
    excludedRoots: [
      "this_profile's_activity_across_facebook/messages/**",
      "this_profile's_activity_across_facebook/comments_and_reactions/**",
      'profile_information/**',
      'connections/**',
      "this_profile's_activity_across_facebook/groups/**",
      "this_profile's_activity_across_facebook/events/**",
      "this_profile's_activity_across_facebook/fundraisers/**",
    ],
    warnings: [
      'Media EXIF, upload IPs, GPS coordinates, camera metadata, comments, reactions, messages, and account connections are not emitted.',
      'Suggested render values are heuristics and require editorial review.',
      comparisonWarning,
    ],
    comparison,
    posts: postSummary,
    media: {
      files: mediaFiles.length,
      bytes: mediaFiles.reduce((sum, file) => sum + file.bytes, 0),
      imageFiles: mediaFiles.filter((file) => file.mediaType === 'image')
        .length,
      videoFiles: mediaFiles.filter((file) => file.mediaType === 'video')
        .length,
      referencedFiles: mediaFiles.filter(
        (file) => file.referencedByPostCount > 0,
      ).length,
      unreferencedFiles: mediaFiles.filter(
        (file) => file.referencedByPostCount === 0,
      ).length,
      metadataRecords: mediaMetadata,
    },
  };

  mkdirSync(options.output, { recursive: true });
  writeJson(path.join(options.output, 'summary.json'), summary);
  writeJson(path.join(options.output, 'posts.json'), posts);
  writeJson(path.join(options.output, 'media.json'), mediaFiles);
  writeReviewCsv(path.join(options.output, 'review.csv'), posts);
  return summary;
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    console.log(usage());
    return;
  }

  const summary = buildInventory(options);
  console.log(JSON.stringify({ output: options.output, summary }, null, 2));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
