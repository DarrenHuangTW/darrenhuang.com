# 搬遷報告索引

這個目錄只保存可安全提交至 public repository 的執行證據與驗收摘要。
原始 SQL、會員資料、使用者資料、密碼雜湊、完整 archives、雲端帳號資訊、IP、私鑰與 tokens 不得出現在這裡。

## 目前狀態

截至 2026-08-09，Phase 1–5 已完成，Phase 6 尚未開始。
Phase 1 的 Lightsail 原始資料匯出、完整性校驗與第二份私人備份已完成。
Astro skeleton、GitHub Pages workflow、內容 importer、媒體產物與 Stories 已建立。
最新 importer 產物包含 86 篇正式文章、41 篇原會員限定文章、19 篇排除 drafts、1 篇正式內容頁、2 篇 Web Stories、773 個發布媒體與 192 個外部媒體或附件參考，未知 Gutenberg blocks 為 0。
正式網域與 GitHub Pages base-path 成品均已在本機通過 build 與 dist 驗證，成品包含 211 個 HTML。
桌機與手機代表性頁面目視驗收、完整秘密掃描、staged-files 審查、第一個本機 commit、clean-clone 安裝與 14 個 E2E 均已完成。
首次 push、GitHub Actions 實際執行時間與 GitHub Pages 預覽屬於 Phase 6，仍未執行。

| 階段    | 報告或範圍                                                                | 狀態                         |
| ------- | ------------------------------------------------------------------------- | ---------------------------- |
| Phase 1 | [來源取得與封存驗證](./phase-1-source-acquisition.md)                     | 完成。                       |
| Phase 2 | Astro skeleton、內容 schema 與 Pages workflow                             | 完成。                       |
| Phase 3 | 文章、頁面、Gutenberg blocks 與內容差異                                   | 完成。                       |
| Phase 4 | 媒體 dependency graph、embeds 與 Stories                                  | 完成。                       |
| Phase 5 | [URL、SEO、build artifact、連結與 E2E](./phase-5-acceptance.md)           | 完成。                       |
| Phase 6 | 首次 push、GitHub Actions、Pages 預覽與 custom domain                     | 未開始，須另行取得操作授權。 |
| 產生檔  | [Phase 5 importer 摘要](../migration/reports/phase-5-importer-summary.md) | 每次 importer 執行時更新。   |

`migration/reports/phase-5-importer-summary.md` 只記錄 importer 統計，會由 importer 覆寫。
`migration-report/phase-5-acceptance.md` 維護完整 Phase 5 Gate 與人工驗收進度，不會由 importer 覆寫。

## 報告原則

- 每個結論都必須能由可重跑的 script、checksum、manifest 或測試輸出佐證。
- 不得因第三方服務無法連線而靜默遺失內文或來源 URL。
- 無法自動判定的內容必須列入人工審核，不得猜測後宣告通過。
- 報告可以記錄雜湊與統計數字，但不可包含資料庫內容、個資或雲端存取資訊。
- 完成狀態只代表對應 Gate 通過，不代表已取得正式 DNS 切換或舊服務刪除的授權。
