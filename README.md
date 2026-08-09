# 數位引擎

這個 repository 是 `darrenhuang.com` 從 WordPress 搬遷到 Astro 與 GitHub Pages 的新網站。
Phase 1–5 的本機搬遷與驗收已完成，內容完整性、既有網址、媒體與 SEO 的正確性優先於視覺翻新。

## 搬遷進度

截至 2026-08-09，Phase 1–5 已完成，Phase 6 尚未開始。
最新 importer 產物包含 86 篇正式文章、41 篇原會員限定文章、19 篇排除 drafts、1 篇正式內容頁、2 篇 Web Stories、773 個發布媒體與 192 個外部媒體或附件參考，未知 Gutenberg blocks 為 0。
正式網域與 GitHub Pages base-path 兩種本機 production build、211 個 HTML artifact、桌機與手機代表性頁面目視驗收、14 個 E2E、完整秘密掃描、staged-files 審查、第一個本機 commit，以及 clean-clone 重跑均已通過。
GitHub Actions 與 Pages 預覽尚未執行，必須等首次 push 後才能驗證。

## 搬遷基準

- 新站必須公開 86 篇正式文章，其中包含 41 篇原會員限定文章。
- 19 篇 WordPress drafts 不得發布。
- 每篇文章保留既有的 `/<slug>.html` canonical path。
- 兩個 Web Stories 主題必須以靜態頁面與可閱讀 transcript 保存。
- 會員登入、付款、密碼重設與其他 membership 功能不會搬遷。
- SQL、會員資料、密碼雜湊、憑證、權杖、原始 archives 與 `.env` 不得進入 public repository。

完整規格、資料來源優先順序與驗收門檻請見 [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)。
非敏感的執行證據與驗收摘要集中在 [migration-report](./migration-report/README.md)。

## 技術架構

- Astro 產生純靜態網站。
- TypeScript 與 Astro Content Collections 驗證內容 schema。
- Vitest、Playwright、ESLint 與 Prettier 負責自動檢查。
- GitHub Actions 建置並發布經驗證的 GitHub Pages artifact。
- 第三方 embeds 使用 progressive enhancement，來源連結在外部 script 失效時仍可使用。

## 本機開發

需要符合 `>=22.12.0 <25` 的 Node.js 與 npm。
CI 固定使用 Node.js 24，以降低本機與 GitHub Actions 的差異。

```powershell
npm ci
npm run dev
```

常用檢查如下。

```powershell
npm run format:check
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:migration
npm run verify:dist
npm run test:e2e
```

WordPress importer 的原始輸入必須位於 repository 外，並透過本機環境變數提供。
可用的變數名稱記錄在 [.env.example](./.env.example)，但實際路徑與秘密值不得提交。

## 目錄

```text
src/content/                 經過清理與 schema 驗證的文章、頁面與 Stories 來源。
src/components/embeds/      可降級的第三方 embed components。
public/wp-content/uploads/  只有正式內容實際引用的媒體。
scripts/migrate-wordpress/  可重跑且輸出可重現的 importer。
scripts/verify/              搬遷與建置成品驗收工具。
migration/                  Manifest 與機器可讀的遷移報告。
migration-report/           適合提交至 public repository 的執行摘要。
```

## GitHub Pages 預覽

[Pages workflow](./.github/workflows/pages.yml) 設定為只在 `main` push 或手動觸發時建置並部署，目前尚未執行。
workflow 預定使用 `https://darrenhuangtw.github.io/darrenhuang.com/` 作為正式切站前的預覽網址。
Repository 的 Pages source 仍需在 GitHub Settings 選擇 GitHub Actions。

這個 workflow 不會建立 custom domain、修改 DNS 或刪除舊服務。
正式切換到 `https://darrenhuang.com` 屬於 Phase 6，必須在本機與 Pages 預覽完成驗收並取得明確確認後另行執行。

## 安全邊界

任何 Cloudflare DNS 修改、AWS Lightsail 刪除、Bluehost nameserver／續約／付款修改，以及 Vercel 或舊 GitHub repository 刪除，都不屬於目前自動化流程。
首次 push 前，必須再次檢查待發布的 commit 與 staged files，確定沒有資料庫、個資、archives、憑證或 secrets。
