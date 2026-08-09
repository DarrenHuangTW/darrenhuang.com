# Phase 5 驗收進度報告

最後更新：2026-08-09。

狀態：Phase 5 進行中。
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

- GitHub Pages base-path 成品已產生 211 個 HTML。
- 最新本機 E2E 執行結果為通過且 0 failures。
- 這些結果不取代尚待執行的逐頁目視、clean-clone 或 GitHub Actions 驗證。

## Stories 決策

- Boris Johnson Story 的新版與舊版皆為 13 頁。
- Leo Burnett Story 的新版 10 頁是舊版 12 頁的合併重寫，而不是單純遺失兩頁。
- Leo Burnett canonical 保留新版 10 頁，舊版特有素材與頁面對應保存在 story comparison 報告。
- 每篇 Story 的 canonical 頁都提供可直接閱讀的 transcript，視覺 Story runtime 失效時仍有完整文字。

## 尚待完成的 Phase 5 Gate

- 使用桌機與手機 viewport 逐頁目視驗收代表性頁面、長文、圖片密集文章、原會員文章、embeds、Stories 與 404。
- 完成 repository 秘密掃描與 staged-files 安全審查。
- 建立第一個本機 commit。
- 從 clean clone 重跑安裝、測試、build、dist 驗證與 E2E。
- 首次 push 後驗證 GitHub Actions build、執行時間與 GitHub Pages 預覽。

## 尚未執行的受保護操作

- 尚未修改 Cloudflare DNS 或 redirect rules。
- 尚未刪除或停止 AWS Lightsail。
- 尚未修改 Bluehost nameserver、續約或付款設定。
- 尚未刪除 Vercel 或任何舊 GitHub repository。
- GitHub Pages custom domain 與正式切站屬於後續 Gate，必須另行取得明確確認。
