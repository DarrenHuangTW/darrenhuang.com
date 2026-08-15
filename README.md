# 數位引擎

這個 repository 是 `darrenhuang.com` 從 WordPress 搬遷到 Astro 與 GitHub Pages 的新網站。
Phase 1–5 的本機搬遷與驗收已完成，內容完整性、既有網址、媒體與 SEO 的正確性優先於視覺翻新。

## 搬遷進度

截至 2026-08-09，Phase 1–5 已完成，Phase 6 的首次 push、GitHub Actions、Pages base-path 預覽與 GitHub 帳號層級網域驗證已完成。
最新 importer 產物包含 86 篇正式文章、41 篇原會員限定文章、19 篇排除 drafts、1 篇正式內容頁、2 篇 Web Stories、773 個發布媒體與 192 個外部媒體或附件參考，未知 Gutenberg blocks 為 0。
正式網域與 GitHub Pages base-path 兩種本機 production build、211 個 HTML artifact、桌機與手機代表性頁面目視驗收、14 個 E2E、完整秘密掃描、staged-files 審查、第一個本機 commit，以及 clean-clone 重跑均已通過。
GitHub Pages preview 已在公開環境通過 HTTP、桌機與手機驗收。
正式 canonical host 已確認為 `https://www.darrenhuang.com`；repository custom domain、網站流量 DNS 與 redirect 切換尚未執行。

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
- Post-build 產生 canonical 頁面的 Markdown alternates、LLM indexes 與具 digest 的 Agent Skill discovery。

## Agent-readable 介面

- `/llms.txt` 提供網站定位與主要機器可讀入口。
- `/articles-llms.txt` 列出全部 86 篇文章、日期、摘要與 Markdown 版本。
- 每個 indexable canonical 頁面都有對應 `.md` artifact 與 HTML `rel="alternate"` discovery link。
- `/.well-known/agent-skills/index.json` 發布可驗證的 `research-digital-engine` skill。
- `npm run audit:agent-readiness` 透過 Cloudflare 官方 MCP scanner 檢查正式 `www` hostname。

Repository 內的完整實作與 Cloudflare edge 待辦記錄在 [Agent Readiness 優化報告](./migration-report/agent-readiness.md)。

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
npm run audit:agent-readiness
```

WordPress importer 的原始輸入必須位於 repository 外，並透過本機環境變數提供。
可用的變數名稱記錄在 [.env.example](./.env.example)，但實際路徑與秘密值不得提交。

## 目錄

```text
src/content/                 經過清理與 schema 驗證的文章、頁面與 Stories 來源。
src/components/embeds/      可降級的第三方 embed components。
public/wp-content/uploads/  只有正式內容實際引用的媒體。
scripts/migrate-wordpress/  可重跑且輸出可重現的 importer。
scripts/build/              Agent-readable Markdown 與 discovery artifact 產生器。
scripts/verify/              搬遷與建置成品驗收工具。
migration/                  Manifest 與機器可讀的遷移報告。
migration-report/           適合提交至 public repository 的執行摘要。
```

## GitHub Pages 預覽

[Pages workflow](./.github/workflows/pages.yml) 已在 `main` commit `1d92c8477a34` 成功完成 build 與 deploy。
成功的 [Actions run](https://github.com/DarrenHuangTW/darrenhuang.com/actions/runs/31313254464) build 為 1 分 23 秒、deploy 為 14 秒，整體從建立到完成約 1 分 52 秒。
Repository 的 Pages source 已設為 GitHub Actions，HTTPS 已強制啟用。
[GitHub Pages preview](https://darrenhuangtw.github.io/darrenhuang.com/) 已通過首頁、文章、Stories、sitemap、RSS、自訂 404、桌機與手機視覺驗收。
完整執行證據記錄在 [Phase 6 Pages 預覽報告](./migration-report/phase-6-pages-preview.md)。

這個 workflow 不會建立 custom domain、修改 DNS 或刪除舊服務。
正式切換到 `https://www.darrenhuang.com` 仍須逐步取得 repository custom domain、網站流量 DNS 與 redirect 操作的明確確認。
`darrenhuang.com` 與 `member.darrenhuang.com` 的 HTTP／HTTPS 請求將以 301 導向相同 path 與 query 的 `https://www.darrenhuang.com` URL。

## 安全邊界

任何 Cloudflare DNS 修改、AWS Lightsail 刪除、Bluehost nameserver／續約／付款修改，以及 Vercel 或舊 GitHub repository 刪除，都不屬於目前自動化流程。
每次後續 push 前，必須再次檢查待發布的 commits 與 staged files，確定沒有資料庫、個資、archives、憑證或 secrets。
