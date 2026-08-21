import { randomBytes } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { load } from 'cheerio';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  optimizeBuiltImages,
  resolveLocalImageArtifact,
} from '../../scripts/build/optimize-images';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        maxRetries: 5,
        recursive: true,
        retryDelay: 100,
      }),
    ),
  );
});

describe('responsive image build output', () => {
  it('resolves root and base-path image references without escaping dist', () => {
    expect(
      resolveLocalImageArtifact(
        'article.html',
        './wp-content/uploads/sample.jpg',
      ),
    ).toBe('wp-content/uploads/sample.jpg');
    expect(
      resolveLocalImageArtifact(
        'article.html',
        '/darrenhuang.com/wp-content/uploads/sample.jpg',
        '/darrenhuang.com',
      ),
    ).toBe('wp-content/uploads/sample.jpg');
    expect(
      resolveLocalImageArtifact('article.html', '../../outside.jpg'),
    ).toBeNull();
    expect(
      resolveLocalImageArtifact('article.html', 'https://example.com/a.jpg'),
    ).toBeNull();
  });

  it('generates modern variants and keeps the original fallback URL', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'image-optimizer-'));
    temporaryDirectories.push(root);
    const distRoot = path.join(root, 'dist');
    const cacheRoot = path.join(root, 'cache');
    const imagePath = path.join(
      distRoot,
      'wp-content',
      'uploads',
      'sample.jpg',
    );
    await mkdir(path.dirname(imagePath), { recursive: true });
    await sharp(randomBytes(900 * 600 * 3), {
      raw: { channels: 3, height: 600, width: 900 },
    })
      .jpeg({ quality: 95 })
      .toFile(imagePath);
    await writeFile(
      path.join(distRoot, 'article.html'),
      '<!doctype html><html><body><main><article class="prose"><img src="./wp-content/uploads/sample.jpg" alt="Sample" width="600" height="500" loading="lazy"></article></main></body></html>',
      'utf8',
    );

    const summary = await optimizeBuiltImages({
      basePath: '/project',
      cacheRoot,
      concurrency: 2,
      distRoot,
      minBytes: 1,
      minWidth: 1,
    });
    expect(summary.sourceImages).toBe(1);
    expect(summary.variants).toBeGreaterThan(1);
    expect(summary.htmlFilesChanged).toBe(1);

    const $ = load(await readFile(path.join(distRoot, 'article.html'), 'utf8'));
    expect($('picture[data-responsive-image="true"]')).toHaveLength(1);
    expect($('picture img').attr('src')).toBe(
      './wp-content/uploads/sample.jpg',
    );
    expect($('picture img').attr('width')).toBe('600');
    expect($('picture img').attr('height')).toBe('400');
    expect($('picture img').attr('sizes')).toContain('50rem');
    expect($('source[type="image/avif"]').attr('srcset')).toContain(
      '/project/_optimized/',
    );
    expect($('source[type="image/webp"]').attr('srcset')).toContain(
      '/project/_optimized/',
    );

    const firstVariant = $('source').first().attr('srcset')?.split(' ', 1)[0];
    expect(firstVariant).toBeTruthy();
    const variantArtifact = firstVariant
      ?.replace(/^\/project\//u, '')
      .replace(/^\//u, '');
    expect(
      (await stat(path.join(distRoot, ...(variantArtifact ?? '').split('/'))))
        .size,
    ).toBeGreaterThan(0);
  });
});
