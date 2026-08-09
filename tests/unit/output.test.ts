import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeAliasPage } from '../../scripts/migrate-wordpress/output';

describe('migration alias output', () => {
  it('uses the canonical www host while keeping navigation relative', () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'digital-engine-alias-'));

    try {
      writeAliasPage({
        repoRoot,
        alias: '/blog/legacy-post',
        canonicalPath: '/canonical-post.html',
        title: 'Legacy post',
      });

      const html = readFileSync(
        path.join(repoRoot, 'public', 'blog', 'legacy-post', 'index.html'),
        'utf8',
      );
      expect(html).toContain(
        '<link rel="canonical" href="https://www.darrenhuang.com/canonical-post.html">',
      );
      expect(html).toContain('content="0;url=../../canonical-post.html"');
      expect(html).not.toContain('href="https://darrenhuang.com/');
    } finally {
      rmSync(repoRoot, { force: true, recursive: true });
    }
  });
});
