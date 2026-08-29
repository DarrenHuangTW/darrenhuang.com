# Agent Readiness 優化報告

最後更新：2026-08-29。

狀態：agent-readable 內容、探索 metadata、公開唯讀 API、MCP／WebMCP、Free-plan Worker、ARD manifest、自動驗證與 live audit 已完成並已發布。
本報告保留沒有真實服務時不偽造 OAuth、A2A、Web Bot Auth 或 DNS-AID 資訊的原則。

## 最終發布狀態

- Pages artifact 來自 commit `94b1633`，GitHub Actions workflow [33226834484](https://github.com/DarrenHuangTW/darrenhuang.com/actions/runs/33226834484) 已成功完成 build、deploy 與 26 個瀏覽器 annotation checks。
- Cloudflare Worker `darrenhuang-agent-readiness` 已部署至正式 route `www.darrenhuang.com/*`。
- 最新 Worker version ID 是 `d0e7ecd0-38c6-4fba-be4d-755b29ff8b8f`。
- 正式檢查目標是 `https://www.darrenhuang.com`，裸網域仍以 301 導向 `www`。
- Cloudflare zone 仍是 Free plan。

## Repository 內已完成

- 每次 production build 後，從 indexable canonical HTML 產生 102 個對應的 Markdown 頁面。
- 86 篇文章都有標題、摘要、發布與更新日期、canonical URL、Markdown URL 與 `zh-Hant` 語言 metadata。
- `/llms.txt` 提供網站定位、主要索引、公開存取方式與 agent 使用說明。
- `/articles-llms.txt` 依發布日期列出 86 篇文章及其 Markdown 版本。
- 每個 indexable HTML 頁面以 `rel="alternate"` 宣告自己的 `text/markdown` 版本。
- 每個頁面以 `rel="describedby"` 宣告 `/llms.txt`。
- `/.well-known/agent-skills/index.json` 發布一個真實且範圍明確的 `research-digital-engine` skill。
- `/openapi.json` 描述公開文章與 Facebook 保存筆記的唯讀 JSON API，以及 `/mcp` JSON-RPC endpoint。
- `/api/content.json`、`/api/articles.json` 與 `/api/notes.json` 由正式 Markdown artifact 自動產生，detail endpoint 只回傳已公開內容。
- `/.well-known/api-catalog` 以 RFC 9727 Linkset 格式列出 OpenAPI、內容 collections 與 MCP endpoint。
- `/.well-known/ai-catalog.json` 發布四個真實的 ARD resources，包括內容 API、OpenAPI、MCP Server Card 與 Agent Skill。
- `/.well-known/mcp/server-card.json` 宣告公開的 stateless streamable HTTP MCP endpoint 與兩個 read-only tools。
- 每個頁面都註冊同一組小型 WebMCP tools，在瀏覽器支援 `document.modelContext` 或相容 bridge 時可搜尋與讀取公開內容。
- `/auth.md` 說明本站的公開 agent audience、無需註冊、沒有 credentials，以及可使用的直接 HTTPS、Markdown 與 read-only MCP 存取方法。
- `/contact.html` 與 `/privacy.html` 提供可供 agent 驗證的實際聯絡、網站用途、第三方服務與資料處理說明。
- Root `.nojekyll` 會保留 `.well-known` 目錄，避免 GitHub Pages 的 Jekyll 規則排除 Agent discovery files。
- Pages artifact upload 明確啟用 hidden files，確保 `.nojekyll` 與 `.well-known` 都進入實際發布 tarball。
- Skill index 依 Agent Skills Discovery v0.2.0 產生 SHA-256 digest，dist verifier 會重新計算並拒絕不一致的 artifact。

## Cloudflare 邊緣部署

### Markdown content negotiation

這個 zone 已確認使用 Free plan，因此無法啟用只提供給 Pro、Business 與 Enterprise 的 managed Markdown for Agents。
Repository 已產生完整 `.md` alternates，並在 `cloudflare/agent-readiness` 實作 Free-plan Worker。
Worker 只替明確接受 `text/markdown` 的安全讀取要求取得對應 `.md` artifact，保留 query string，並以串流方式回傳 body。
一般瀏覽、非頁面資源與非安全 HTTP methods 會原樣傳到 GitHub Pages origin。
若 Markdown artifact 不存在，Worker 會回退到原始 HTML，不會把缺漏擴大成網站中斷。
正式 wildcard route 已啟用 request-limit fail-open，Free plan allowance 用完時仍直接由 GitHub Pages origin 回應。
`/_astro/*`、`/wp-content/*` 與 `/story-media/*` 已使用更精確的 no-script routes 略過 Worker，避免靜態 assets 消耗 allowance。
這些 route-level safeguards 不在 `wrangler.jsonc` 內，之後每次 route deployment 都必須重新確認。

### HTTP Link response headers

正式首頁 response 會宣告下列 discovery links。

```http
Link: </llms.txt>; rel="describedby"; type="text/plain",
      </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json",
      </.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/ai-catalog+json",
      </.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json",
      </.well-known/mcp/server-card.json>; rel="mcp"; type="application/json"
```

`describedby` 是已註冊的 relation，而其他 links 都指向本站實際發布的 discovery resources。

### Public API and MCP

Worker 會替 `/mcp` 提供不需要帳號的 JSON-RPC request／response，並以 CORS、`MCP-Protocol-Version`、`Cache-Control: no-store` 與 JSON error responses 回應。
搜尋工具只讀取 `/api/content.json`，讀取工具只讀取 build 產生的文章或筆記 detail JSON。
這個 endpoint 沒有 session、write method、付款流程或代表使用者行動，因此不需要 OAuth。
Worker 也會在 API detail artifact 不存在時，把 GitHub Pages 的 HTML 404 轉成帶有 `code`、`message` 與 discovery `hint` 的 JSON 404。

### Agent response headers

HTML 頁面與 agent resources 會取得 `Origin-Agent-Cluster: ?1` 與 `Permissions-Policy: tools=(self)`。
首頁會同時宣告 `llms.txt`、API Catalog、ARD catalog、Agent Skills index 與 MCP Server Card。
API Catalog 會由 Worker 使用 RFC 9727 的 `application/linkset+json` profile media type 回應。
公開 agent resources 會回應 `Access-Control-Allow-Origin: *` 與 `X-Content-Type-Options: nosniff`。

### Cloudflare bot controls

為了讓公開 agent scanner 可以取得真實內容，Cloudflare AI Labyrinth 已關閉。
Cloudflare Bot Fight Mode 已關閉，因為 Free plan 的 Bot Fight Mode challenge 無法以 WAF custom skip rule 安全豁免單一 scanner。
Browser Integrity Check 仍保持啟用。
Cloudflare Block AI Bots 保持 `Do not block`，AI Crawl Control 目前也沒有封鎖相關 crawlers。

## 最終 live audit

### Cloudflare official Agent Readiness audit

Cloudflare dashboard 重掃結果是 Level 1 `5/5`、Level 2 `2/3`、Level 3 `3/8`，Commerce optional `0/5`。
目前已被辨識的 Level 3 capabilities 包含 Skills Index、MCP Server Card 與 WebMCP。
官方 scanner 的完整結果是 [Level 4/5 — Agent-Integrated](https://dash.cloudflare.com/a6467645a8f76463416f3db199174bca/darrenhuang.com/agent-readiness/diagnostics?hostname=www.darrenhuang.com) 對應的 live audit。

- Discoverability：`3/4`，robots.txt、sitemap 與 Link headers 通過，DNS-AID 沒有記錄。
- Content Accessibility：`1/1`，Markdown content negotiation 通過。
- Bot Access Control：`2/2`，robots.txt AI rules 與 Content Signals 通過。
- API、Auth、MCP、A2A Discovery：`5/9`，API Catalog、MCP Server Card、Agent Skills、WebMCP 與 ARD 通過。
- OAuth Discovery 與 OAuth Protected Resource 不通過，但本站沒有受保護 API，因此不應偽造 OAuth metadata。
- A2A Agent Card 與 Web Bot Auth 不通過，但本站沒有 A2A 或需要簽章驗證的 agent service，因此不應偽造 service card。
- `auth.md` 的自包含公開存取說明已補齊，但 scanner 仍回報沒有 agent registration，這是公開匿名網站的 checker limitation。
- DNS-AID 仍沒有記錄，因為本站目前沒有需要透過 DNS 宣告的獨立 agent service endpoint。

`auth.md` 的公開 anonymous guidance 符合 [Auth.md checker skill](https://isitagentready.com/.well-known/agent-skills/auth-md/SKILL.md) 要求的 audience、registration endpoint、supported methods 與 credential use 說明。
公開網站仍被要求提供實際 registration endpoint 的問題，也可見於 [auth.md scanner issue #16](https://github.com/workos/auth.md/issues/16)。

### Ora rescan

[Ora／Is Agentic](https://is-agentic.com/scan/www.darrenhuang.com) 已執行 rescan，但畫面仍顯示 `5/100` 與 `Agents are likely to struggle`。
這個結果與直接 production smoke、Cloudflare official audit 和已部署 resources 不一致，因此目前視為 Ora 的快取、抓取來源或 scanner-specific access issue，不宣稱 Ora 已改善。
Cloudflare 的 Bot Fight Mode 已關閉後，Ora 仍沒有在此次 rescan 反映新的 resources。

## DNS-AID 決策

目前刻意不建立 DNS-AID record。
[DNS-AID](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/) 仍是 Internet-Draft，且其 discovery records 應該指向真實可用的 agent service，通常還需要正確的 SVCB／HTTPS parameters 與 DNSSEC 覆蓋。
本網站目前提供的是網站內容 API、WebMCP 與 MCP endpoint，而不是一個需要以 DNS-AID 尋址的獨立 A2A service。
未來若新增真實 agent service，再以 DNSSEC、SVCB／HTTPS records 與對應 protocol parameters 實作，才會是誠實且可維護的加分。

## 驗證證據

- `npm run build` 通過。
- `npm run verify:dist` 通過，驗證 89 個 canonical outputs、318 個 HTML 與 261.7 MiB artifact。
- `npm run typecheck` 通過。
- `npm run format:check` 通過。
- `npm run lint` 通過。
- `npm run test` 通過，14 個 test files、62 個 tests 全部成功。
- `npm run test:worker` 通過，12 個 Worker tests 全部成功。
- `npm run worker:build` dry-run 通過，Worker bundle 為 16.37 KiB、gzip 後 4.48 KiB。
- GitHub Actions workflow 已通過 desktop 與 mobile E2E checks。
- Production smoke 已確認首頁、`/auth.md`、OpenAPI、內容 API、API Catalog、ARD catalog、MCP Server Card、Skills index 與 `/mcp` 可取得。
- Production MCP smoke 已確認 initialize、`notifications/initialized`、`tools/list` 與 `search_content` request 都能得到預期 JSON-RPC response。
- 不存在的文章 detail endpoint 會回傳結構化的 `404 not_found` JSON，而不是把 HTML error page 當成 API response。

## 可重跑命令

```powershell
npm run build
npm run verify:dist
npm run test:e2e
npm run test:worker
npm run worker:types:check
npm run worker:build
npm run worker:deploy
npm run audit:agent-readiness
```

掃描其他站點或 profile 時使用 positional arguments，避免 npm 10 將未知長旗標解讀成 npm config。

```powershell
npm run audit:agent-readiness -- https://www.darrenhuang.com all
```
