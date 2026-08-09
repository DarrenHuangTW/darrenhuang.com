# Phase 6 GitHub Pages 預覽報告

最後更新：2026-08-09。

狀態：首次 push、GitHub Actions、GitHub Pages base-path 預覽與 GitHub 帳號層級網域驗證已完成。
正式 canonical host 已確認為 `https://www.darrenhuang.com`。
Repository custom domain、網站流量 DNS、redirect rules 與正式流量切換尚未執行。

## 發布與 Pages 設定

- `main` 已首次 push 到 public repository `DarrenHuangTW/darrenhuang.com`。
- 第一次 run `31313116909` 的安裝、source gates、正式網域 build、Playwright 安裝與 Pages base-path E2E 均通過。
- 第一次 run 只在 `Configure GitHub Pages` 失敗，原因是空 repository 尚未啟用 Pages，而不是程式、內容或測試失敗。
- Repository Pages 已設為 `workflow` publishing source，HTTPS 已強制啟用，custom domain 仍為空。
- GitHub 帳號層級已驗證 `darrenhuang.com` 的所有權，對應 Cloudflare TXT 應永久保留。
- Workflow 已升級為 `actions/setup-node@v7`、`actions/configure-pages@v6` 與 `actions/upload-pages-artifact@v5`，避免 Node 20 淘汰 warning。
- Action 版本升級 commit 是 `1d92c8477a34`。

## 成功的 GitHub Actions run

- 成功 run 是 [31313254464](https://github.com/DarrenHuangTW/darrenhuang.com/actions/runs/31313254464)。
- Build job 從 2026-08-09 12:25:41 UTC 執行到 12:27:04 UTC，共 1 分 23 秒。
- Deploy job 從 2026-08-09 12:27:15 UTC 執行到 12:27:29 UTC，共 14 秒。
- Workflow 從建立到完成約 1 分 52 秒，低於 8 分鐘 warning 與 10 分鐘上限。
- 安裝、格式、lint、Astro check、typecheck、41 個 unit tests、migration verifier、正式網域 build、Pages base-path build、14 個 E2E、Pages 設定、artifact upload 與 deploy 均通過。
- Run artifact 名稱是 `github-pages`。
- 這個歷史 run 是 project-base preview 證據，不是尚未執行的 `www` production-root 發布證據。

## 公開預覽驗收

- 預覽網址是 <https://darrenhuangtw.github.io/darrenhuang.com/>。
- 首頁、代表性文章、sitemap 與 RSS 均回傳 HTTP 200。
- Boris Johnson Story canonical、13 頁 Story runtime 與第一張圖片均正常載入。
- Leo Burnett Story canonical、10 頁 Story runtime 與第一張圖片均正常載入。
- 兩篇 Story 的 iframe 都留在 deployment base 內，transcript 可直接閱讀。
- 未知路徑回傳自訂 404，頁面含 `noindex,follow` 與正確的 base-path 首頁連結。
- 桌機與 390×844 手機 viewport 的首頁、文章、legacy gallery、兩篇 Stories 與 404 均完成目視驗收。
- 所有受測頁面均無水平溢位，瀏覽器 console 為 0 errors 與 0 warnings。

## `www` production-root 本機準備

- 正式 canonical host 已集中設定為 `https://www.darrenhuang.com`。
- 106 個 legacy alias 與 2 個 Story AMP artifact 已更新為 `www` canonical，Story checksums 已同步至內容檔與 manifest。
- 歷史文章內的 Wayback URLs、程式碼範例與「少了 www」等教學文字未做全域置換。
- 當前 shell 未掛載 importer 所需的私人外部來源路徑，因此沒有宣稱完成新一輪完整 importer 執行。
- Host-dependent 追蹤產物依現有 manifest 做精確刷新後，migration verifier 仍通過 86 篇文章、41 篇原會員文章、19 篇 drafts、2 篇 Stories 與 773 個媒體 dependencies。
- Dist verifier 現在會檢查 canonical、alias、sitemap、RSS 與 robots 的完整 origin 與 base path，不再只比對 pathname。
- `www` production-root 與 GitHub project-base build 都通過 211 個 HTML 的 dist 驗證，兩種 build 各自通過 14 個桌機與手機 E2E。
- Source gates 通過 format、lint、59-file Astro check、typecheck、9 個 unit test files 與 42 個 unit tests。
- Workflow 會先驗證 project-base preview，最後重建並上傳 `www` production-root artifact，避免把 preview base 發布到 custom domain。
- 以上修正目前只在本機工作樹，尚未 commit 或 push，也沒有變更 repository custom domain 或網站流量 DNS。

## 仍受保護的後續操作

- 尚未設定 GitHub Pages custom domain 或 CNAME。
- Cloudflare 只新增並驗證 GitHub Pages 網域所有權 TXT。
- 尚未修改 Cloudflare apex、`www`、`member` 網站流量 records、redirect rules、SSL 或其他正式流量設定。
- 尚未停止或刪除 AWS Lightsail。
- 尚未修改 Bluehost、Vercel 或舊 GitHub repository。
- 下一個 repository custom domain 必須設定為 `www.darrenhuang.com`。
- 後續順序是本機 commit、repository custom domain、push 與 Actions production-root deploy、`www` DNS、HTTPS 驗證，最後才建立 apex／`member` redirect。
- Apex 與 `member` 的 HTTP／HTTPS 請求將以保留 path 與 query string 的 301 導向 canonical `www`。
- Custom domain、網站流量 DNS、redirect rules 與正式流量切換必須逐步取得使用者明確授權。
