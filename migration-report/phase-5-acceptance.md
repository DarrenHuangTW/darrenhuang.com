# Phase 5 驗收報告

最後更新：2026-08-09。

狀態：Phase 5 完成。
本報告由人工維護，彙整可重跑的 WordPress importer、驗收腳本及目視檢查結果。
Importer 只會覆寫 `migration/reports/phase-5-importer-summary.md`，不會覆寫本報告。
所有數量皆以已驗證的 Lightsail WXR、最新 SQL、會員站歷史 SQL 與 uploads archive 為依據。

## 已完成的 importer 基準

- 正式文章：86 篇。
- 原會員限定但現已公開：41 篇。
- 排除且另列清單的 drafts：19 篇。
- 正式內容頁：1 篇。
- 邏輯 Web Stories：2 篇。
- 舊 Vercel 缺漏文章：about-the-site、how-to-show-images-in-google-search-results、seo-reputation-managment 均已納入。

## 媒體與內容轉換

- 發布媒體：773 個檔案，共 145.54 MiB。
- 未知 Gutenberg blocks：0 個。
- 尚保留為外部來源的媒體或附件參考：192 個，詳見 media dependency 報告。
- 舊 GitHub/Vercel 文字 checksum 與最新來源不同：83 篇，最新 Lightsail 版本仍是唯一正文權威。

## 已完成的本機自動檢查

- `format:check`、ESLint、Astro check 與可重現的 `typecheck` 均通過，Astro check 結果為 57 個檔案、0 errors、0 warnings、0 hints。
- Vitest 的 8 個 test files 與 41 個 tests 全部通過。
- Migration verifier 通過 86 篇文章、41 篇原會員文章、19 篇 drafts、2 篇 Stories 與 773 個唯一媒體 dependencies。
- 正式網域與 GitHub Pages base-path 兩種 production build 均產生 103 個 Astro pages。
- 兩種 build 的 dist verifier 均通過 89 個 canonical outputs、211 個 HTML 與 147.8 MiB artifact。
- GitHub Pages base-path 的桌機與手機 Playwright E2E 共 14 個 tests 全部通過。

## Stories 決策

- Boris Johnson Story 的新版與舊版皆為 13 頁。
- Leo Burnett Story 的新版 10 頁是舊版 12 頁的合併重寫，而不是單純遺失兩頁。
- Leo Burnett canonical 保留新版 10 頁，舊版特有素材與頁面對應保存在 story comparison 報告。
- 每篇 Story 的 canonical 頁都提供可直接閱讀的 transcript，視覺 Story runtime 失效時仍有完整文字。

## 已完成的目視、安全與 clean-clone Gate

- 已使用桌機與手機 viewport 目視驗收首頁、代表性長文、legacy gallery、兩篇 Stories 與 404。
- 長文章標題、gallery 與首頁在手機 viewport 均無水平溢位或孤字，legacy gallery 在桌機與手機皆使用正確版面。
- Boris Johnson Story 的 13 頁與 Leo Burnett Story 的 10 頁均完成視覺、local asset 與 transcript 檢查。
- Repository pre-stage 與 1,056 個 staged files 安全審查均通過，未發現非測試 secrets、私人來源檔、敏感檔名、symlink、submodule 或超過 100 MiB 的檔案。
- 第一個本機 commit 已建立，且未 push。
- 已從最新程式 commit `eb18c6371593` 建立 clean clone，從 lockfile 完成 591 packages 安裝後重跑全部 source gates、migration verifier、兩種 build、兩次 dist verifier 與 14 個 E2E。
- Clean clone 驗證完成後工作樹保持乾淨。

## Phase 6 尚未開始

- 尚未首次 push。
- 尚未取得 GitHub Actions 的實際 build 時間，也尚未驗證 GitHub Pages 預覽。
- GitHub Actions build 應在 10 分鐘內完成，並建議於 8 分鐘顯示 warning；此 Gate 必須在首次 push 後驗證。

## 尚未執行的受保護操作

- 尚未修改 Cloudflare DNS 或 redirect rules。
- 尚未刪除或停止 AWS Lightsail。
- 尚未修改 Bluehost nameserver、續約或付款設定。
- 尚未刪除 Vercel 或任何舊 GitHub repository。
- GitHub Pages custom domain 與正式切站屬於後續 Gate，必須另行取得明確確認。
