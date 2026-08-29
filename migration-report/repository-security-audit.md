# Repository、Verifier 與 Agent Readiness 安全稽核

最後更新：2026-08-29。

這份報告記錄本輪 verifier、Cloudflare Worker、GitHub Actions 與 repository security policy 的可重跑修正。

它只記錄公開 repository 可以安全保存的設定、契約、統計與驗證結果。

它不包含 secrets、tokens、私有 migration export、mailbox data、資料庫內容或其他私有來源資料。

## 稽核範圍與基線

本輪工作樹建立時的 HEAD 與 `origin/main` 都是 `45f2345`。

工作樹原本已有使用者刻意留下的 production transfer verifier、報告、測試與 `package.json` 變更。

這些變更均予以保留，沒有改寫既有歷史。

正式網站是 Astro 靜態網站，公開 agent-readiness endpoint 是掛在 `www.darrenhuang.com/*` 的 Cloudflare Worker。

Worker 沒有 secrets、bindings、持久化 request state 或需要登入的功能。

公開 API 與 MCP endpoint 維持 anonymous、read-only，且只提供已發布內容。

本輪不新增 OAuth、A2A、付款、CLI 或 application-level rate limiter。

## 已修正的 findings

### Migration verifier 的非 HTTPS 誤判

原始 finding 是 `npm run verify:migration` 把 transfer checklist 中用於描述 redirect input 的正式站 HTTP fixture 當成公開非 HTTPS URL。

根因是 migration scanner 的安全規則原本對所有正式站 HTTP 字串採用單一全域文字規則，而文件沒有使用明確的 fixture 標記契約。

本輪將文件改為描述 redirect 行為與測試語意，不在可發布報告中放置正式站 HTTP URL 字串。

scanner 的非 HTTPS 正式站規則仍然保留，沒有全面忽略 HTTP。

測試明確證明真實的正式站 HTTP URL 仍會被拒絕，而中性的 redirect 語意描述不會觸發該規則。

`npm run verify:migration` 已通過。

### Apex `robots.txt` 的 Cloudflare Managed canonicalization

原始 finding 是 apex `robots.txt` request 回傳 `200 OK`，但帶有指向 canonical HTTPS `www` host 的 `Location`，因此不符合一般 apex redirect 的 `301` 或 `308` 契約。

公開 GET 重現顯示這是 Cloudflare Managed `robots.txt` 的特殊回應，而不是一般 HTML 或 API route 的 redirect 失效。

實際 response 是 `text/plain`，包含可解析的 wildcard crawler policy、`Allow: /`，並沒有 wildcard `Disallow: /`。

本輪沒有用「忽略 robots.txt」放寬 verifier，也沒有在 Cloudflare 修改 route 或 rules。

production verifier 現在只在以下條件全部成立時接受此例外：HTTPS apex、pathname 精確為 `/robots.txt`、status 為 `200`、`Location` 精確指向 canonical HTTPS `www` 並保留 path/query、content type 為 `text/plain`、wildcard group 存在且允許 root、wildcard group 沒有禁止 root。

其他 apex path 仍必須回傳 `301` 或 `308`，並保留 path 與 query。

canonical `www` 的 `robots.txt` 仍獨立驗證 `200`、`text/plain`、crawler policy、sitemap 與 final URL。

`npm run verify:production` 已通過。

### Worker request body buffering

原始 finding 是 MCP POST handler 先呼叫 `request.text()`，再檢查 64 KiB，可能先完整 buffer request body。

本輪改為先檢查嚴格的數字 `Content-Length`，對明確超限或不安全整數立即回傳 JSON-RPC `413`。

沒有可靠 `Content-Length` 時，Worker 會以 `ReadableStream` reader 逐 chunk 讀取，累積總 byte 數超過 64 KiB 時取消 stream 並停止保存內容。

限制以 UTF-8 bytes 計算，而不是以 JavaScript string code units 計算。

JSON-RPC parser 也改為建立明確的 typed request object，避免以 double cast 掩蓋輸入形狀問題。

Worker test 覆蓋超過 64 KiB 的 MCP body，並確認回傳 status `413` 與 JSON-RPC invalid-request code `-32600`。

靜態 public API response 仍完整保留，沒有以容量限制截斷發布內容。

### Wrangler local secret files

`.gitignore` 現在明確忽略 `.dev.vars` 與 `.dev.vars.*`，並保留 `.dev.vars.example` 作為可提交的範例例外。

migration verifier 的 sensitive-file regression test 也確認實際 local vars 會被拒絕，而 example 不會被拒絕。

既有 `.env` 規則與 `.env.example` 例外均保留。

### GitHub Pages workflow

Pages workflow 現在同時支援 `push`、`workflow_dispatch` 與只做 validation 的 `pull_request`。

pull request 不會執行 Pages upload 或 deploy job。

Pages write 與 OIDC write 權限已縮到 build/deploy job，workflow top level 只有 `contents: read`。

build 仍保留 format、lint、Astro check、typecheck、unit test、Worker test、Worker type generation check、Worker dry-run build、migration verification、兩種 base path build、dist verification 與 E2E gate。

正式 artifact 仍以 `include-hidden-files: true` 上傳，並在 upload 前明確檢查 `dist/.nojekyll`、`dist/.well-known` 與 unexpected hidden files。

官方 Actions 已固定到本輪查證的 immutable commit SHA，並保留原 major version comment 供 Dependabot 維護。

CodeQL workflow 同樣使用 immutable SHA，並以 JavaScript/TypeScript analysis、pull request、main push 與 weekly schedule 執行。

新增的 Dependabot 設定涵蓋 npm 與 GitHub Actions。

### Repository policy files

新增 `SECURITY.md`，記錄 private vulnerability reporting、敏感資料處理原則與公開 endpoint scope。

新增 `.github/CODEOWNERS`，讓 repository、Cloudflare 與 GitHub configuration 變更有明確 owner review 對象。

新增 `.github/dependabot.yml` 與 `.github/workflows/codeql.yml`，提供依賴更新與靜態分析的可追蹤入口。

這些 policy files 的有效性仍需在變更發布後由 GitHub Actions 實際 run confirmation 補充。

## 未自動處理的限制與風險

本輪沒有建立 application-level distributed rate limiter。

這個 endpoint 是 public read-only、靜態資料為主，可靠的 abuse control 應由 Cloudflare WAF、rate limiting 或其他平台 policy 管理，而不是由單一 Worker instance 的全域 mutable state 模擬。

本輪沒有修改 Cloudflare route、WAF、rate-limit、DNS、zone、robots 設定或部署 Worker。

Worker 的 route 仍是 `www.darrenhuang.com/*`，但 handler 只對明確 agent resource、API、MCP、Markdown negotiation 與 page response 做對應處理，其餘 request 轉交 origin。

本輪沒有修改 GitHub branch protection，因為目前部署流程仍依賴 main push，強制 PR gate、required checks、admin enforcement 與 signed commit policy 需要 repository owner 依日常維運方式另行決策。

本輪沒有改寫 commit、移除遠端 branch、prune Git objects 或清理 `.tmp`、Facebook export、`node_modules`、`dist`、`.astro`、`.wrangler`、`test-results` 等資料。

`origin/codex/astro-native-ux` 保留不動。

該 branch 的唯一非 main commit 是 `293a3e7`，內容是 native Astro reading experience，且與 main 的相關變更存在 patch-equivalent history；它目前落後 main 九個 commit。

本輪沒有足夠依據安全刪除該 branch。

Unsigned commits 沒有被改寫。

若日後需要 signed commit enforcement，應先由 repository owner 建立並保管 signing key，再配置 branch policy。

## GitHub remote settings audit

本輪開始前的 read-only baseline 是：secret scanning 開啟、push protection 開啟、Dependabot security updates 關閉、vulnerability alerts endpoint 不可用、CodeQL analysis 尚未建立、main 沒有 branch protection、Actions 允許 all 且未要求 SHA pinning。

本輪新增的 security policy files 與 workflow 已包含在 `a033c9c`，並已推送至 `origin/main`。

2026-08-29 透過 `gh api -X PUT repos/DarrenHuangTW/darrenhuang.com/vulnerability-alerts` 啟用 vulnerability alerts，response 為 `204 No Content`。

同日透過 `gh api -X PUT repos/DarrenHuangTW/darrenhuang.com/automated-security-fixes` 啟用 Dependabot automated security fixes，response 為 `204 No Content`。

啟用後讀回 `security_and_analysis` 顯示 `dependabot_security_updates.status=enabled`，vulnerability alerts endpoint 也回傳 `204 No Content`。

啟用後讀回 automated security fixes 顯示 `enabled=true` 且 `paused=false`。

Actions remote policy 仍是 `allowed_actions=all`、`sha_pinning_required=false`，本輪沒有修改。

main branch protection endpoint 仍為 `404 Not Found`，本輪沒有修改。

CodeQL workflow 已隨 `a033c9c` 發布，push run `33240692404` 已成功完成。

## Cloudflare remote settings audit

本輪檢查了 `cloudflare/agent-readiness/wrangler.jsonc`、最新 Wrangler schema 與最新 Workers runtime types。

本輪修改了 Worker source 與 local test，並執行 Wrangler deploy；沒有修改 Cloudflare route、WAF、rate-limit、secrets、bindings 或 zone settings。

Worker deployment 使用 version ID `06a78f46-b12e-4803-a038-7b152a636906`，並套用既有 `www.darrenhuang.com/*` route。

本輪使用本地 Wrangler `4.123.0`，最新查證的 Workers types package 為 `5.20260829.1`。

Worker verification 已記錄 types check、dry-run build 與 Worker tests。

`npm run verify:production` 只發出 GET 請求，不登入或修改 Cloudflare、registrar、DNS、GitHub 或郵件服務。

另外以 live read-only POST 驗證 oversized MCP body 回傳 `413`，沒有觸發內容或設定修改。

## Verification record

執行日期：2026-08-29。

完整 verification command 結果：

- `npm run verify:migration`：通過，86 篇文章、41 篇原會員文章、19 篇 drafts、2 篇 Stories 與 773 個唯一媒體 dependencies。
- `npm run verify:production`：通過，包含 apex `robots.txt` 的精確 Cloudflare Managed policy exception。
- `npm run typecheck`：通過，site 與 Worker TypeScript 均無錯誤。
- `npm run check`：通過，87 個 Astro files、0 errors、0 warnings、0 hints。
- `npm run lint`：通過。
- `npm test`：通過，14 test files、65 tests。
- `npm run test:worker`：通過，1 test file、16 tests。
- `npm run worker:types:check`：通過，Wrangler types up to date。
- `npm run worker:build`：通過，dry-run upload 21.73 KiB、gzip 5.91 KiB、no bindings。
- `npm run build`：通過，212 pages built，postbuild 產生 211 Markdown pages、86 article entries 與 23 note entries。
- `npm run verify:dist`：通過，89 canonical outputs、320 HTML、261.8 MiB artifacts。
- `npm run format:check`：通過，所有檔案符合 Prettier style。
- `npm run test:e2e`：通過，26 desktop/mobile Chromium tests。
- `npm run audit:agent-readiness -- https://www.darrenhuang.com all`：完成，Level 4/5，已通過的 published capabilities 與刻意不支援的 DNS-AID、OAuth/Auth.md、A2A findings 均如實輸出。
- `npm audit --audit-level=high`：通過，0 vulnerabilities。
- GitHub Pages run `33240692397`：成功，build、兩組 artifact build、E2E、hidden-file checks、upload 與 deploy job 均成功。
- GitHub CodeQL run `33240692404`：成功。
- Live Worker smoke：server card `200`、content API `200`、Markdown negotiation `200 text/markdown`、oversized MCP request `413`。

先前的 targeted regression checks 也通過：`npm test -- tests/unit/verify-migration.test.ts tests/unit/verify-production.test.ts` 為 14 tests，`npm run test:worker -- cloudflare/agent-readiness/src/index.test.ts` 為 16 tests。

`git diff --check`：通過。

`.dev.vars` 與 `.dev.vars.production` 由 `.gitignore` 忽略，而 `.dev.vars.example` 保持可提交。

最終 versioned/untracked set 沒有 `node_modules`、`dist`、`.astro`、`.wrangler`、`test-results` 或 `NEXT_SESSION_PROMPT.md`。

最終 versioned/untracked set 只包含本輪 source、test、workflow、policy、verifier、migration report 與原先使用者刻意保留的 transfer verifier 變更。

本輪已建立 commit `a033c9c` 並 fast-forward push 至 `origin/main`，且完成 Pages 與 Worker deployment。

## Reproducibility references

Cloudflare Workers request body 與 ReadableStream 行為以 [Workers Request API documentation](https://developers.cloudflare.com/workers/runtime-apis/request/) 為準。

Cloudflare memory、request 與 platform limit 以 [Workers limits documentation](https://developers.cloudflare.com/workers/platform/limits/) 為準。

Cloudflare Managed `robots.txt` 行為以 [Managed robots.txt documentation](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) 為準。

GitHub Actions SHA pinning、CodeQL 與 security settings 的實際狀態仍以 repository API 與 workflow run evidence 為準。
