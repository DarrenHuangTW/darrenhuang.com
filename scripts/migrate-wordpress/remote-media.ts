import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decode } from 'html-entities';

export interface RemoteMediaMirror {
  source: string;
  sourceKey: string;
  localPath: string;
  bytes: number;
  sha256: string;
}

function remoteDescriptor(
  rawUrl: string,
  storySlug: string,
): {
  fetchUrl: string;
  sourceKey: string;
  localPath: string;
} | null {
  const decodedUrl = decode(rawUrl);
  let url: URL;
  try {
    url = new URL(decodedUrl);
  } catch {
    return null;
  }

  if (url.hostname === 'images.unsplash.com') {
    const imageId = path.posix.basename(url.pathname);
    if (!imageId.startsWith('photo-')) return null;
    url.searchParams.set('fit', 'max');
    url.searchParams.set('fm', 'jpg');
    url.searchParams.set('q', '88');
    url.searchParams.set('w', '1800');
    url.searchParams.delete('h');
    return {
      fetchUrl: url.toString(),
      sourceKey: `${url.origin}${url.pathname}`,
      localPath: `/story-media/${storySlug}/${imageId}.jpg`,
    };
  }

  if (url.hostname === 'storage.coverr.co') {
    const mediaId = path.posix.basename(url.pathname);
    if (!mediaId) return null;
    const isVideo = url.pathname.startsWith('/videos/');
    return {
      fetchUrl: url.toString(),
      sourceKey: `${url.origin}${url.pathname}`,
      localPath: `/story-media/${storySlug}/coverr-${mediaId}.${isVideo ? 'mp4' : 'jpg'}`,
    };
  }

  return null;
}

function assertMediaLooksValid(filePath: string): void {
  const data = readFileSync(filePath);
  if (data.length < 256)
    throw new Error(`Remote media is unexpectedly small: ${filePath}`);
  const extension = path.extname(filePath).toLocaleLowerCase('en-US');

  if (
    extension === '.mp4' &&
    !data.subarray(0, 64).includes(Buffer.from('ftyp'))
  ) {
    throw new Error(
      `Remote video does not contain an MP4 ftyp header: ${filePath}`,
    );
  }

  if (
    extension === '.jpg' &&
    !(data[0] === 0xff && data[1] === 0xd8) &&
    !(data[0] === 0x89 && data.subarray(1, 4).toString('ascii') === 'PNG')
  ) {
    throw new Error(
      `Remote poster does not look like a JPEG or PNG: ${filePath}`,
    );
  }
}

export async function mirrorRemoteStoryMedia(options: {
  repoRoot: string;
  storySlug: string;
  urls: Iterable<string>;
}): Promise<RemoteMediaMirror[]> {
  const descriptors = new Map<string, ReturnType<typeof remoteDescriptor>>();
  for (const url of options.urls) {
    const descriptor = remoteDescriptor(url, options.storySlug);
    if (descriptor) descriptors.set(descriptor.sourceKey, descriptor);
  }

  const mirrors: RemoteMediaMirror[] = [];
  for (const descriptor of descriptors.values()) {
    if (!descriptor) continue;
    const absolutePath = path.resolve(
      options.repoRoot,
      'public',
      descriptor.localPath.slice(1),
    );
    const expectedRoot = path.resolve(
      options.repoRoot,
      'public',
      'story-media',
    );
    if (!absolutePath.startsWith(`${expectedRoot}${path.sep}`)) {
      throw new Error(`Unsafe remote media output path: ${absolutePath}`);
    }

    mkdirSync(path.dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      const response = await fetch(descriptor.fetchUrl, {
        headers: { 'User-Agent': 'darrenhuang.com static migration/1.0' },
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(
          `Remote media fetch failed (${response.status}): ${descriptor.sourceKey}`,
        );
      }
      writeFileSync(absolutePath, Buffer.from(await response.arrayBuffer()));
    }

    assertMediaLooksValid(absolutePath);
    const data = readFileSync(absolutePath);
    mirrors.push({
      source: descriptor.sourceKey,
      sourceKey: descriptor.sourceKey,
      localPath: descriptor.localPath,
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    });
  }

  return mirrors.sort((left, right) =>
    left.sourceKey.localeCompare(right.sourceKey),
  );
}

export function applyRemoteStoryMirrors(
  html: string,
  mirrors: RemoteMediaMirror[],
): string {
  let rewritten = html;
  for (const mirror of mirrors) {
    const escaped = mirror.sourceKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rewritten = rewritten.replace(
      new RegExp(`${escaped}[^"'<>\\s)]*`, 'g'),
      mirror.localPath,
    );
    rewritten = rewritten.replace(
      new RegExp(escaped.replaceAll('&', '&amp;') + `[^"'<>\\s)]*`, 'g'),
      mirror.localPath,
    );
  }
  return rewritten;
}
