import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MigrationManifest } from './types';

export function writeJsonReport(
  repoRoot: string,
  filename: string,
  value: unknown,
): void {
  const reportDirectory = path.join(repoRoot, 'migration', 'reports');
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(
    path.join(reportDirectory, filename),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}

export function writePhaseFiveReport(options: {
  repoRoot: string;
  manifest: MigrationManifest;
  unknownBlockCount: number;
  externalReferenceCount: number;
  legacyComparisonChanged: number;
}): void {
  const { manifest } = options;
  const reportPath = path.join(
    options.repoRoot,
    'migration',
    'reports',
    'phase-5-importer-summary.md',
  );
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const mebibytes = manifest.media.totalBytes / 1024 / 1024;
  const unknownBlocksLine =
    options.unknownBlockCount === 0
      ? '- 未知 Gutenberg blocks：0 個。'
      : `- 未知 Gutenberg blocks：${options.unknownBlockCount} 個，全部保留為 sanitized HTML 並寫入機器可讀報告。`;
  const lines = [
    '# Phase 5 importer 摘要',
    '',
    '本摘要由可重跑的 WordPress importer 產生。',
    '完整 Phase 5 驗收報告由後續 build、dist、E2E、目視與 clean-clone 檢查共同維護，不會被 importer 覆寫。',
    '所有數量皆以已驗證的 Lightsail WXR、最新 SQL、會員站歷史 SQL 與 uploads archive 為依據。',
    '',
    '## 內容結果',
    '',
    `- 正式文章：${manifest.summary.posts} 篇。`,
    `- 原會員限定但現已公開：${manifest.summary.formerMemberPosts} 篇。`,
    `- 排除且另列清單的 drafts：${manifest.summary.draftsExcluded} 篇。`,
    `- 正式內容頁：${manifest.summary.pagesPublished} 篇。`,
    `- 邏輯 Web Stories：${manifest.summary.stories} 篇。`,
    `- 舊 Vercel 缺漏文章：about-the-site、how-to-show-images-in-google-search-results、seo-reputation-managment 均已納入。`,
    '',
    '## 媒體與內容轉換',
    '',
    `- 發布媒體：${manifest.summary.mediaFiles} 個檔案，共 ${mebibytes.toFixed(2)} MiB。`,
    unknownBlocksLine,
    `- 尚保留為外部來源的媒體或附件參考：${options.externalReferenceCount} 個，詳見 media dependency 報告。`,
    `- 舊 GitHub/Vercel 文字 checksum 與最新來源不同：${options.legacyComparisonChanged} 篇，最新 Lightsail 版本仍是唯一正文權威。`,
    '',
    '## Stories 決策',
    '',
    '- Boris Johnson Story 的新版與舊版皆為 13 頁。',
    '- Leo Burnett Story 的新版 10 頁是舊版 12 頁的合併重寫，而不是單純遺失兩頁。',
    '- Leo Burnett canonical 保留新版 10 頁，舊版特有素材與頁面對應保存在 story comparison 報告。',
    '- 每篇 Story 的 canonical 頁都提供可直接閱讀的 transcript，視覺 Story runtime 失效時仍有完整文字。',
    '',
    '## 尚未執行的受保護操作',
    '',
    '- 尚未修改 Cloudflare DNS 或 redirect rules。',
    '- 尚未刪除或停止 AWS Lightsail。',
    '- 尚未修改 Bluehost nameserver、續約或付款設定。',
    '- 尚未刪除 Vercel 或任何舊 GitHub repository。',
    '- GitHub Pages custom domain 與正式切站屬於後續 Gate，必須另行取得明確確認。',
    '',
  ];
  writeFileSync(reportPath, lines.join('\n'), 'utf8');
}
