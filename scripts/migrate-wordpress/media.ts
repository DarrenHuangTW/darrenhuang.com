import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import * as tar from 'tar';

export interface PublishedMediaFile {
  path: string;
  bytes: number;
  sha256: string;
  mime: string;
  width?: number;
  height?: number;
}

export interface MediaExtractionResult {
  files: PublishedMediaFile[];
  duplicateContent: Array<{ sha256: string; paths: string[] }>;
  totalBytes: number;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function normalizeDependency(dependency: string): string {
  let decoded = dependency;

  try {
    decoded = decodeURIComponent(dependency);
  } catch {
    // Preserve the source spelling when it contains a literal percent sign.
  }

  const normalized = decoded
    .replaceAll('\\', '/')
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?wp-content\/uploads\//i, '')
    .replace(/^\/?uploads\//i, '')
    .replace(/^\/+/, '');

  if (
    !normalized ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw new Error(`Unsafe or empty media dependency: ${dependency}`);
  }

  return normalized.normalize('NFC');
}

function assertGeneratedTarget(repoRoot: string, targetDir: string): void {
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedTarget = path.resolve(targetDir);
  const expected = path.resolve(repoRoot, 'public', 'wp-content', 'uploads');

  if (
    resolvedTarget !== expected ||
    !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(
      `Refusing to replace unexpected media target: ${resolvedTarget}`,
    );
  }
}

export async function extractReferencedMedia(options: {
  archivePath: string;
  dependencies: Iterable<string>;
  repoRoot: string;
  targetDir?: string;
}): Promise<MediaExtractionResult> {
  const targetDir =
    options.targetDir ??
    path.join(options.repoRoot, 'public', 'wp-content', 'uploads');
  assertGeneratedTarget(options.repoRoot, targetDir);

  if (!existsSync(options.archivePath)) {
    throw new Error(`Uploads archive does not exist: ${options.archivePath}`);
  }

  const requested = new Set(
    Array.from(options.dependencies, normalizeDependency),
  );
  const archiveEntries = new Map<string, string>();

  await tar.t({
    file: options.archivePath,
    onentry(entry) {
      if (entry.type !== 'File') return;
      const normalized = entry.path
        .replaceAll('\\', '/')
        .replace(/^uploads\//, '')
        .normalize('NFC');
      archiveEntries.set(normalized, entry.path);
    },
  });

  const missing = [...requested].filter((item) => !archiveEntries.has(item));
  if (missing.length > 0) {
    throw new Error(
      `Uploads archive is missing ${missing.length} referenced file(s): ${missing.slice(0, 12).join(', ')}`,
    );
  }

  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });

  const requestedArchivePaths = new Set(
    [...requested].map((item) => archiveEntries.get(item)!),
  );
  await tar.x({
    cwd: targetDir,
    file: options.archivePath,
    filter: (entryPath) => requestedArchivePaths.has(entryPath),
    preservePaths: false,
    strip: 1,
  });

  const files: PublishedMediaFile[] = [];
  const sortedPaths = [...requested].sort((left, right) =>
    left.localeCompare(right, 'zh-Hant'),
  );

  for (const relativePath of sortedPaths) {
    const absolutePath = path.join(targetDir, ...relativePath.split('/'));
    if (!existsSync(absolutePath)) {
      throw new Error(`tar extraction did not produce ${relativePath}`);
    }

    const extension = path.extname(relativePath).toLocaleLowerCase('en-US');
    const mime = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
    const result: PublishedMediaFile = {
      path: `/wp-content/uploads/${relativePath}`,
      bytes: statSync(absolutePath).size,
      sha256: sha256File(absolutePath),
      mime,
    };

    if (mime.startsWith('image/') && mime !== 'image/svg+xml') {
      try {
        const dimensions = await sharp(absolutePath, {
          animated: false,
          limitInputPixels: 100_000_000,
          sequentialRead: true,
        }).metadata();
        if (dimensions.width && dimensions.height) {
          result.width = dimensions.width;
          result.height = dimensions.height;
        }
      } catch {
        // Animated or legacy images remain publishable even without dimensions.
      }
    }

    files.push(result);
  }

  const byChecksum = new Map<string, string[]>();
  for (const file of files) {
    const paths = byChecksum.get(file.sha256) ?? [];
    paths.push(file.path);
    byChecksum.set(file.sha256, paths);
  }

  return {
    files,
    duplicateContent: [...byChecksum]
      .filter(([, paths]) => paths.length > 1)
      .map(([sha256, paths]) => ({ sha256, paths })),
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
  };
}
