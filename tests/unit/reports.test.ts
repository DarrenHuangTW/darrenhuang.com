import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writePhaseFiveReport } from '../../scripts/migrate-wordpress/reports.js';
import type { MigrationManifest } from '../../scripts/migrate-wordpress/types.js';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function minimalManifest(): MigrationManifest {
  const fingerprint = { bytes: 1, filename: 'source', sha256: 'a'.repeat(64) };

  return {
    schemaVersion: 1,
    generatedAt: '2026-08-09T00:00:00.000Z',
    sources: {
      wxr: fingerprint,
      latestDatabase: fingerprint,
      memberDatabase: fingerprint,
      uploadsArchive: fingerprint,
    },
    summary: {
      posts: 86,
      formerMemberPosts: 41,
      draftsExcluded: 19,
      pagesPublished: 1,
      stories: 2,
      mediaFiles: 773,
      mediaBytes: 1,
    },
    posts: [],
    drafts: [],
    pages: [],
    stories: [],
    media: {
      files: [],
      duplicateContent: [],
      totalBytes: 1,
      externalReferences: [],
    },
  };
}

describe('migration reports', () => {
  it('writes the importer summary without overwriting manual Phase 5 acceptance', () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'migration-reports-'));
    temporaryRoots.push(repoRoot);
    const acceptanceDirectory = path.join(repoRoot, 'migration-report');
    const acceptancePath = path.join(
      acceptanceDirectory,
      'phase-5-acceptance.md',
    );
    mkdirSync(acceptanceDirectory, { recursive: true });
    writeFileSync(acceptancePath, 'manual acceptance evidence\n', 'utf8');

    writePhaseFiveReport({
      repoRoot,
      manifest: minimalManifest(),
      unknownBlockCount: 0,
      externalReferenceCount: 192,
      legacyComparisonChanged: 83,
    });

    expect(readFileSync(acceptancePath, 'utf8')).toBe(
      'manual acceptance evidence\n',
    );
    const importerSummary = readFileSync(
      path.join(
        repoRoot,
        'migration',
        'reports',
        'phase-5-importer-summary.md',
      ),
      'utf8',
    );
    expect(importerSummary).toContain('完整 Phase 5 驗收報告');
    expect(importerSummary).toContain('正式文章：86 篇');
    expect(importerSummary).toContain('原會員限定但現已公開：41 篇');
    expect(importerSummary).toContain('排除且另列清單的 drafts：19 篇');
    expect(importerSummary).toContain('正式內容頁：1 篇');
    expect(importerSummary).toContain('邏輯 Web Stories：2 篇');
    expect(importerSummary).toContain('發布媒體：773 個檔案');
    expect(importerSummary).toContain('未知 Gutenberg blocks：0 個。');
    expect(importerSummary).toContain('外部來源的媒體或附件參考：192 個');
    expect(importerSummary).not.toContain('發布媒體：772 個檔案');
  });
});
