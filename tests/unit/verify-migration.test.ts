import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  artifactChecksumMismatch,
  checksumMismatch,
  findForbiddenPublishedText,
  isSensitiveRepositoryFile,
  shouldScanPublishedText,
  storyRecordMismatches,
} from '../../scripts/verify/migration';
import {
  normalizedTextChecksum,
  sha256,
} from '../../scripts/migrate-wordpress/output';

describe('migration verifier integrity helpers', () => {
  it('detects published body drift against the manifest checksum', () => {
    const expected = normalizedTextChecksum('<p>原始正文</p>');

    expect(checksumMismatch('<p>原始正文</p>', expected)).toBeUndefined();
    expect(checksumMismatch('<p>正文已漂移</p>', expected)).toMatchObject({
      expected,
    });
  });

  it('detects exact Story artifact drift, including markup-only changes', () => {
    const expected = sha256('<style>p{color:red}</style><p>正文</p>');

    expect(
      artifactChecksumMismatch(
        '<style>p{color:red}</style><p>正文</p>',
        expected,
      ),
    ).toBeUndefined();
    expect(
      artifactChecksumMismatch(
        '<style>p{color:blue}</style><p>正文</p>',
        expected,
      ),
    ).toMatchObject({ expected });
  });

  it('compares Story transcript and audit fields with the manifest', () => {
    const manifest = {
      aliases: ['/story.html'],
      canonicalPath: '/web-stories/story/',
      comparisonDecision: 'keep modern',
      legacyPageCount: 12,
      legacyWpId: 2,
      modernPageCount: 1,
      modernWpId: 1,
      slug: 'story',
      sourceChecksum: 'a'.repeat(64),
      title: 'Story title',
      transcript: [{ id: 'page-1', order: 1, lines: ['原始逐字稿'] }],
    };
    const content = {
      aliases: ['/story.html'],
      ampSourcePath: '/web-stories/story/story.html',
      canonicalPath: '/web-stories/story/',
      legacyComparison: { decision: 'keep modern' },
      legacyPageCount: 12,
      legacyWpId: 2,
      modernPageCount: 1,
      modernWpId: 1,
      slug: 'story',
      sourceChecksum: 'a'.repeat(64),
      title: 'Story title',
      transcript: [{ id: 'page-1', order: 1, lines: ['內容已漂移'] }],
    };

    expect(storyRecordMismatches(manifest, content)).toContain('transcript');
  });

  it('covers repository-root docs and migration reports without scanning source code', () => {
    expect(shouldScanPublishedText('README.md')).toBe(true);
    expect(shouldScanPublishedText('.github/workflows/pages.yml')).toBe(true);
    expect(shouldScanPublishedText('migration-report/phase-5.json')).toBe(true);
    expect(shouldScanPublishedText('src/content/posts/post.md')).toBe(true);
    expect(shouldScanPublishedText('scripts/verify/migration.ts')).toBe(false);
    expect(shouldScanPublishedText('tests/unit/fixture.ts')).toBe(false);
  });

  it('detects forbidden values and credential JSON filenames', () => {
    const noteKey = `fixture-note-${'N'.repeat(24)}`;
    const shareKey = `fixture-share-${'S'.repeat(24)}`;
    const findings = findForbiddenPublishedText(
      `https://example.com/note?noteGuid=00000000-0000-4000-8000-000000000000&noteKey=${noteKey}&share_key=${shareKey}`,
    );

    expect(
      findForbiddenPublishedText('api_key: VERIFY_SECRET_12345678901234567890'),
    ).toContain('未遮蔽的高熵 API key value');
    expect(findings).toContain('未移除的 capability credential value');
    expect(findings.join('\n')).not.toContain(noteKey);
    expect(findings.join('\n')).not.toContain(shareKey);
    expect(isSensitiveRepositoryFile('credentials.json')).toBe(true);
    expect(isSensitiveRepositoryFile('credentials.production.json')).toBe(true);
    expect(isSensitiveRepositoryFile('service-account-credentials.json')).toBe(
      true,
    );
    expect(isSensitiveRepositoryFile('google-service-account-key.json')).toBe(
      true,
    );
    expect(isSensitiveRepositoryFile('client_secret_example.json')).toBe(true);
    expect(isSensitiveRepositoryFile('.npmrc')).toBe(true);
    expect(isSensitiveRepositoryFile('.netrc')).toBe(true);
    expect(isSensitiveRepositoryFile('.htpasswd')).toBe(true);
    expect(isSensitiveRepositoryFile('browser/cookies.json')).toBe(true);
    expect(isSensitiveRepositoryFile('playwright/.auth/user.json')).toBe(true);
    expect(isSensitiveRepositoryFile('test-results/storage-state.json')).toBe(
      true,
    );
    expect(isSensitiveRepositoryFile('tests/unit/sanitize.test.ts')).toBe(
      false,
    );
    expect(isSensitiveRepositoryFile('migration/report.json')).toBe(false);
  });
});

describe('GitHub Pages deployment gates', () => {
  const workflow = readFileSync(
    path.join(process.cwd(), '.github', 'workflows', 'pages.yml'),
    'utf8',
  );

  it('runs every repository quality gate before upload', () => {
    const commands = [
      'npm run format:check',
      'npm run lint',
      'npm run check',
      'npm run typecheck',
      'npm test',
      'npm run verify:migration',
      'npm run verify:dist',
      'npm run test:e2e',
    ];
    const uploadIndex = workflow.indexOf('actions/upload-pages-artifact@');

    expect(uploadIndex).toBeGreaterThan(0);
    for (const command of commands) {
      const commandIndex = workflow.indexOf(command);
      expect(commandIndex, `${command} must be present`).toBeGreaterThan(0);
      expect(commandIndex, `${command} must run before upload`).toBeLessThan(
        uploadIndex,
      );
    }
  });

  it('verifies both production-root and GitHub Pages base-path builds', () => {
    expect(workflow).toContain('SITE_URL: https://www.darrenhuang.com');
    expect(workflow).toContain('BASE_PATH: /');
    expect(workflow).toContain('SITE_URL: https://darrenhuangtw.github.io');
    expect(workflow).toContain('BASE_PATH: /darrenhuang.com');

    const previewIndex = workflow.indexOf(
      'name: Verify project-base preview build end to end',
    );
    const productionIndex = workflow.indexOf(
      'name: Build verified custom-domain artifact',
    );
    const uploadIndex = workflow.indexOf('actions/upload-pages-artifact@');
    expect(previewIndex).toBeGreaterThan(0);
    expect(productionIndex).toBeGreaterThan(previewIndex);
    expect(uploadIndex).toBeGreaterThan(productionIndex);
  });
});
