# Phase 6 GitHub Pages 預覽報告

最後更新：2026-08-09。

狀態：首次 push、GitHub Actions 與 GitHub Pages base-path 預覽已完成。
Custom domain、Cloudflare DNS 與正式流量切換尚未執行。

## 發布與 Pages 設定

- `main` 已首次 push 到 public repository `DarrenHuangTW/darrenhuang.com`。
- 第一次 run `31313116909` 的安裝、source gates、正式網域 build、Playwright 安裝與 Pages base-path E2E 均通過。
- 第一次 run 只在 `Configure GitHub Pages` 失敗，原因是空 repository 尚未啟用 Pages，而不是程式、內容或測試失敗。
- Repository Pages 已設為 `workflow` publishing source，HTTPS 已強制啟用，custom domain 仍為空。
- Workflow 已升級為 `actions/setup-node@v7`、`actions/configure-pages@v6` 與 `actions/upload-pages-artifact@v5`，避免 Node 20 淘汰 warning。
- Action 版本升級 commit 是 `1d92c8477a34`。

## 成功的 GitHub Actions run

- 成功 run 是 [31313254464](https://github.com/DarrenHuangTW/darrenhuang.com/actions/runs/31313254464)。
- Build job 從 2026-08-09 12:25:41 UTC 執行到 12:27:04 UTC，共 1 分 23 秒。
- Deploy job 從 2026-08-09 12:27:15 UTC 執行到 12:27:29 UTC，共 14 秒。
- Workflow 從建立到完成約 1 分 52 秒，低於 8 分鐘 warning 與 10 分鐘上限。
- 安裝、格式、lint、Astro check、typecheck、41 個 unit tests、migration verifier、正式網域 build、Pages base-path build、14 個 E2E、Pages 設定、artifact upload 與 deploy 均通過。
- Run artifact 名稱是 `github-pages`。

## 公開預覽驗收

- 預覽網址是 <https://darrenhuangtw.github.io/darrenhuang.com/>。
- 首頁、代表性文章、sitemap 與 RSS 均回傳 HTTP 200。
- Boris Johnson Story canonical、13 頁 Story runtime 與第一張圖片均正常載入。
- Leo Burnett Story canonical、10 頁 Story runtime 與第一張圖片均正常載入。
- 兩篇 Story 的 iframe 都留在 deployment base 內，transcript 可直接閱讀。
- 未知路徑回傳自訂 404，頁面含 `noindex,follow` 與正確的 base-path 首頁連結。
- 桌機與 390×844 手機 viewport 的首頁、文章、legacy gallery、兩篇 Stories 與 404 均完成目視驗收。
- 所有受測頁面均無水平溢位，瀏覽器 console 為 0 errors 與 0 warnings。

## 仍受保護的後續操作

- 尚未設定 GitHub Pages custom domain 或 CNAME。
- 尚未修改 Cloudflare apex、`www`、`member`、redirect rules、SSL 或其他正式流量設定。
- 尚未停止或刪除 AWS Lightsail。
- 尚未修改 Bluehost、Vercel 或舊 GitHub repository。
- Custom domain、DNS 與正式流量切換必須另行取得使用者明確授權。
