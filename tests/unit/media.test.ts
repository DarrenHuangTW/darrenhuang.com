import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import * as tar from 'tar';
import { describe, expect, it } from 'vitest';

import { extractReferencedMedia } from '../../scripts/migrate-wordpress/media';

describe('WordPress media extraction', () => {
  it('extracts only requested files and records raster dimensions', async () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'digital-engine-media-'));
    const archiveRoot = path.join(repoRoot, 'archive');
    const uploadsRoot = path.join(archiveRoot, 'uploads');
    const imagePath = path.join(uploadsRoot, '2026', 'sample.png');
    const archivePath = path.join(repoRoot, 'uploads.tar');

    try {
      mkdirSync(path.dirname(imagePath), { recursive: true });
      await sharp({
        create: {
          width: 3,
          height: 2,
          channels: 4,
          background: { r: 16, g: 32, b: 64, alpha: 1 },
        },
      })
        .png()
        .toFile(imagePath);
      writeFileSync(path.join(uploadsRoot, 'unused.txt'), 'not requested');
      await tar.c({ cwd: archiveRoot, file: archivePath }, ['uploads']);

      const result = await extractReferencedMedia({
        archivePath,
        dependencies: ['/wp-content/uploads/2026/sample.png'],
        repoRoot,
      });

      expect(result.files).toEqual([
        expect.objectContaining({
          path: '/wp-content/uploads/2026/sample.png',
          mime: 'image/png',
          width: 3,
          height: 2,
        }),
      ]);
      expect(result.files[0]?.bytes).toBeGreaterThan(0);
      expect(result.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.totalBytes).toBe(result.files[0]?.bytes);
      expect(result.duplicateContent).toEqual([]);
      expect(
        existsSync(
          path.join(repoRoot, 'public', 'wp-content', 'uploads', 'unused.txt'),
        ),
      ).toBe(false);
    } finally {
      rmSync(repoRoot, { force: true, recursive: true });
    }
  });

  it('rejects traversal in requested archive paths', async () => {
    const repoRoot = mkdtempSync(
      path.join(tmpdir(), 'digital-engine-media-safety-'),
    );
    const archivePath = path.join(repoRoot, 'uploads.tar');
    const archiveRoot = path.join(repoRoot, 'archive');

    try {
      mkdirSync(path.join(archiveRoot, 'uploads'), { recursive: true });
      await tar.c({ cwd: archiveRoot, file: archivePath }, ['uploads']);

      await expect(
        extractReferencedMedia({
          archivePath,
          dependencies: ['../outside.png'],
          repoRoot,
        }),
      ).rejects.toThrow('Unsafe or empty media dependency');
    } finally {
      rmSync(repoRoot, { force: true, recursive: true });
    }
  });
});
