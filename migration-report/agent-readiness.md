# Agent Readiness 優化報告

最後更新：2026-08-28。

狀態：repository 內的 agent-readable 內容、探索 metadata、公開唯讀 API、MCP／WebMCP、Free-plan Worker、自動驗證與 live audit 已完成實作，待本次 Pages artifact 與 Worker 發布後重新掃描。
Cloudflare zone 已確認使用 Free plan。
GitHub Pages workflow [31863578234](https://github.com/DarrenHuangTW/darrenhuang.com/actions/runs/31863578234) 已成功發布 commit `354bcca`，實際 artifact tar 包含 `.nojekyll` 與完整 `.well-known` 目錄。
Cloudflare Worker `darrenhuang-agent-readiness` 已於 2026-08-15 部署，正式 route 是 `www.darrenhuang.com/*`。

## 部署前基準

- 正式掃描目標是 `https://www.darrenhuang.com`。
- Cloudflare `content` profile 的基準是 Level 2/5（Bot-Aware）。
- `robots.txt`、sitemap、AI bot rules 與 Content Signals 通過，共 4/7 個內容型網站 checks。
- HTTP `Link` response headers、Markdown content negotiation 與 DNS-AID 尚未通過。
- 裸網域目前以 301 導向 `www`；掃描器跟隨轉址後得到相同結果，但正式 audit 固定直接掃 `www`。

## Repository 內已完成

- 每次 production build 後，從 indexable canonical HTML 產生 102 個對應的 Markdown 頁面。
- 86 篇文章都有標題、摘要、發布與更新日期、canonical URL、Markdown URL 與 `zh-Hant` 語言 metadata。
- `/llms.txt` 提供網站定位、主要索引與 agent 使用說明。
- `/articles-llms.txt` 依發布日期列出 86 篇文章及其 Markdown 版本。
- 每個 indexable HTML 頁面以 `rel="alternate"` 宣告自己的 `text/markdown` 版本。
- 每個頁面以 `rel="describedby"` 宣告 `/llms.txt`。
- `/.well-known/agent-skills/index.json` 發布一個真實且範圍明確的 `research-digital-engine` skill。
- `/openapi.json` 描述公開文章與 Facebook 保存筆記的唯讀 JSON API，以及 `/mcp` JSON-RPC endpoint。
- `/api/content.json`、`/api/articles.json` 與 `/api/notes.json` 由 build 後的正式 Markdown artifact 自動產生，detail endpoint 只回傳已公開內容。
- `/.well-known/api-catalog` 以 RFC 9727 Linkset 格式列出 OpenAPI、內容 collections 與 MCP endpoint。
- `/auth.md` 明確說明本站目前沒有登入、付款、OAuth、API key 或代表使用者操作。
- `/.well-known/mcp/server-card.json` 宣告公開的 stateless streamable HTTP MCP endpoint 與兩個 read-only tools。
- 每個頁面都註冊同一組小型 WebMCP tools；瀏覽器支援 `document.modelContext` 或相容 bridge 時，agent 可以搜尋與讀取公開內容。
- `/contact.html` 與 `/privacy.html` 提供可供 agent 驗證的實際聯絡、網站用途、第三方服務與資料處理說明。
- Root `.nojekyll` 會保留 `.well-known` 目錄，避免 GitHub Pages 的 Jekyll 規則排除 Agent Skill discovery files。
- Pages artifact upload 明確啟用 hidden files，確保 `.nojekyll` 與 `.well-known` 都進入實際發布 tarball。
- Skill index 依 Agent Skills Discovery v0.2.0 產生 SHA-256 digest，dist verifier 會重新計算並拒絕不一致的 artifact。
- `npm run audit:agent-readiness` 可透過 Cloudflare 官方 MCP scanner 重跑 live `content` profile。
- Dist verifier 會檢查 Markdown alternate、86 篇文章輸出、LLM indexes、skill schema、skill URL 與 digest。
- Playwright 會在桌機與手機專案驗證 LLM indexes、Markdown content type、canonical metadata 與 skill discovery endpoint。

## Cloudflare 邊緣部署

以下設定是在包含新 artifact 的 GitHub Pages deploy 完成並驗證後才接到正式流量。

### 1. Markdown content negotiation

這個 zone 已確認使用 Free plan，因此無法啟用只提供給 Pro、Business 與 Enterprise 的 managed Markdown for Agents。
不應只為分數直接升級。
Repository 已產生完整 `.md` alternates，並在 `cloudflare/agent-readiness` 實作 Free-plan Worker。
Worker 只替明確接受 `text/markdown` 的安全讀取要求取得對應 `.md` artifact，保留 query string，並以串流方式回傳 body。
一般瀏覽、非頁面資源與非安全 HTTP methods 會原樣傳到 GitHub Pages origin。
若 Markdown artifact 不存在，Worker 會回退到原始 HTML，不會把缺漏擴大成網站中斷。
Wrangler runtime tests、generated types check 與 deploy dry-run 都納入 CI。
正式 wildcard route 已啟用 request-limit fail-open，Free plan allowance 用完時仍直接由 GitHub Pages origin 回應。
`/_astro/*`、`/wp-content/*` 與 `/story-media/*` 已使用更精確的 no-script routes 略過 Worker，避免靜態 assets 消耗 allowance。
這些 route-level safeguards 不在 `wrangler.jsonc` 內，之後每次 route deployment 都必須重新確認。

### 2. HTTP Link response header

同一個 Worker 會在正式 homepage 回應加入下列 header：

```http
Link: </llms.txt>; rel="describedby"; type="text/plain"
```

`describedby` 是已註冊的 relation，且 `/llms.txt` 是真實、可讀、與網站相關的資源。
把 Link header 與 content negotiation 放在同一份可測試、可版本化的 Worker source，可避免另外維護 Dashboard-only Transform Rule。

### 3. Public API and MCP

Worker 會替 `/mcp` 提供不需要帳號的 JSON-RPC request／response，並以 CORS、`MCP-Protocol-Version`、`Cache-Control: no-store` 與 JSON error responses 回應。
搜尋工具只讀取 `/api/content.json`，讀取工具只讀取 build 產生的文章或筆記 detail JSON。
這個 endpoint 沒有 session、write method、付款流程或代表使用者行動，因此不需要 OAuth。
Worker 也會在 API detail artifact 不存在時，把 GitHub Pages 的 HTML 404 轉成帶有 code、message 與 discovery hint 的 JSON 404。

### 4. Agent response headers

HTML 頁面與 agent resources 會取得 `Origin-Agent-Cluster: ?1` 與 `Permissions-Policy: tools=(self)`。
首頁會同時宣告 `llms.txt`、API Catalog、Agent Skills index 與 MCP Server Card。
API Catalog 會由 Worker 改寫成 RFC 9727 要求的 `application/linkset+json` profile media type。

### 5. DNS-AID

目前不建議為了分數建立 DNS-AID record。
DNS-AID 仍是新興 draft，而且這個靜態內容網站沒有需要透過 DNS 宣告的 agent service endpoint。
若未來新增真實 agent endpoint，再以 DNSSEC、SVCB／HTTPS records 與對應 protocol parameters 實作。

## 部署後驗證

- Cloudflare 官方 scanner 的 `content` profile 由 Level 2/5 提升到 Level 5/5（Agent-Native），7 個 checks 中通過 6 個。
- HTTP `Link` discovery、Markdown content negotiation、AI bot rules、Content Signals、robots.txt 與 sitemap 全部通過。
- Full profile 的 Agent Skills check 通過，scanner 接受 v0.2.0 index 與一個有效 skill。
- Full profile 是 Level 4/5（Agent-Integrated），因為它還評估 API Catalog、OAuth、MCP、A2A 與 WebMCP；本站沒有這些服務，因此不發布虛假的 discovery endpoints。
- DNS-AID 保留為刻意接受的唯一 content-profile gap，因為本站沒有可透過 DNS 誠實宣告的 agent service。
- Canonical 文章以 `Accept: text/markdown` 取得的 body 與直接 `.md` artifact 完全相同，代表 live check 的 SHA-256 一致。
- 桌機與 Pixel 7 真實瀏覽器都取得正常 HTML，首頁與代表文章為 HTTP 200、零 console/page errors、零水平溢位。

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

掃描其他站點或 profile 時使用 positional arguments，避免 npm 10 將未知長旗標解讀成 npm config：

```powershell
npm run audit:agent-readiness -- https://www.darrenhuang.com all
```
