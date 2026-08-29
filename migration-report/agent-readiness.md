# Agent Readiness 優化報告

最後更新：2026-08-29。

狀態：網站已通過 Ora／Is Agentic 的 100/100 agent-readiness rescan。
本報告保留沒有真實服務時不偽造 OAuth、A2A、Web Bot Auth、DNS-AID、rate-limit 或 CLI 資訊的原則。

## 最終發布狀態

- Pages artifact 來自 commit `21ab91f`，GitHub Actions workflow [33228670108](https://github.com/DarrenHuangTW/darrenhuang.com/actions/runs/33228670108) 已成功完成 build、deploy 與 26 個瀏覽器 E2E checks。
- Cloudflare Worker `darrenhuang-agent-readiness` 已部署至正式 route `www.darrenhuang.com/*`。
- 最新 Worker version ID 是 `175ab5bd-8486-43a2-9bd2-b3f3d4ab97d5`。
- 正式檢查目標是 `https://www.darrenhuang.com`，裸網域仍以 301 導向 `www`。
- Cloudflare zone 仍是 Free plan。

## Repository 內已完成

- 每次 production build 後，從 indexable canonical HTML 產生 211 個對應的 Markdown pages。
- 86 篇文章與 23 篇公開保存筆記都有 metadata、canonical URL 與 Markdown URL。
- `/llms.txt` 提供網站定位、主要索引、公開存取方式與 agent 使用說明。
- `/articles-llms.txt` 與 `/notes-llms.txt` 依內容類型列出公開 Markdown 入口。
- 每個 indexable HTML page 以 `rel="alternate"` 宣告自己的 `text/markdown` 版本。
- 每個 page 以 `rel="describedby"` 宣告 `/llms.txt`。
- `/.well-known/agent-skills/index.json` 發布一個真實且範圍明確的 `research-digital-engine` skill。
- `/openapi.json` 描述公開文章與 Facebook 保存筆記的唯讀 JSON API，以及 `/mcp` JSON-RPC endpoint。
- `/api/content.json`、`/api/articles.json` 與 `/api/notes.json` 由正式 Markdown artifacts 自動產生，detail endpoint 只回傳已公開內容。
- `/.well-known/api-catalog` 以 RFC 9727 Linkset 格式列出 OpenAPI、內容 collections 與 MCP endpoint。
- `/.well-known/ai-catalog.json` 發布四個真實的 ARD resources，包括內容 API、OpenAPI、MCP Server Card 與 Agent Skill。
- `/.well-known/mcp/server-card.json` 宣告公開的 stateless streamable HTTP MCP endpoint 與兩個 read-only tools。
- 每個 page 都註冊同一組小型 WebMCP tools，在瀏覽器支援 `document.modelContext` 或相容 bridge 時可搜尋與讀取公開內容。
- `/developers.html` 提供 API、Markdown、MCP、WebMCP、錯誤格式、版本政策與限制說明。
- `/membership.html` 說明公開內容目前不需要會員、登入或付款，消除舊有 `/membership` 404 與電子報狀態歧義。
- `/auth.md` 說明本站的公開 agent audience、無需註冊、沒有 credentials，以及可使用的直接 HTTPS、Markdown 與 read-only MCP 存取方法。
- Homepage 顯示 Darren Huang 的完整識別與公開 developer／agent 入口，並補齊 `og:image`、author 與 Organization metadata。
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
對不存在且明確要求 Markdown 的安全讀取，Worker 會回傳 HTTP 404 與指向首頁、llms、文章索引、sitemap、developer portal 的短 Markdown recovery body。
正式 wildcard route 已啟用 request-limit fail-open，Free plan allowance 用完時仍直接由 GitHub Pages origin 回應。
`/_astro/*`、`/wp-content/*` 與 `/story-media/*` 已使用更精確的 no-script routes 略過 Worker，避免靜態 assets 消耗 allowance。
這些 route-level safeguards 不在 `wrangler.jsonc` 內，之後每次 route deployment 都必須重新確認。

### Public API and MCP

Worker 會替 `/mcp` 提供不需要帳號的 JSON-RPC request／response，並以 CORS、`MCP-Protocol-Version`、`Cache-Control: no-store` 與 JSON error responses 回應。
搜尋工具只讀取 `/api/content.json`，讀取工具只讀取 build 產生的文章或筆記 detail JSON。
這個 endpoint 沒有 session、write method、付款流程或代表使用者行動，因此不需要 OAuth。
`/api`、`/api/`、未知 API resource、錯誤的 API method 與不支援的 `X-API-Version` 都會回傳結構化 JSON error。
成功 API response 與 API error response 都會帶 `X-API-Version: 1`。

### HTTP Link 與 agent response headers

正式首頁 response 會宣告 llms、API Catalog、ARD catalog、Agent Skills index 與 MCP Server Card discovery links。
API Catalog 會由 Worker 使用 RFC 9727 的 `application/linkset+json` profile media type 回應。
公開 agent resources 會回應 `Access-Control-Allow-Origin: *` 與 `X-Content-Type-Options: nosniff`。
HTML pages 與 agent resources 會取得 `Origin-Agent-Cluster: ?1` 與 `Permissions-Policy: tools=(self)`。

### Cloudflare bot controls

為了讓公開 agent scanner 可以取得真實內容，Cloudflare AI Labyrinth 已關閉。
Cloudflare Bot Fight Mode 已關閉，因為 Free plan 的 Bot Fight Mode challenge 無法以 WAF custom skip rule 安全豁免單一 scanner。
Browser Integrity Check 仍保持啟用。
Cloudflare Block AI Bots 保持 `Do not block`，AI Crawl Control 目前也沒有封鎖相關 crawlers。

## 最終 live audit

### Ora／Is Agentic

[Ora／Is Agentic](https://is-agentic.com/scan/www.darrenhuang.com) 在正式部署後已完成 fresh rescan。
最新 CLI 與報告 API 結果是 `100/100`，掃描時間為 `2026-08-29T02:29:13.001Z` UTC。
Essential 為 `9/9`、`80/80`，Recommended 為 `13/21`、`14.9/20`，Bonus 為 `22 positive signals`、`+5`。
網站原先顯示的 84 分已被 fresh report 取代。

目前 Ora 報告仍列出的非完全通過項目如下。

- Brand name discoverability：需要搜尋引擎與第三方來源建立品牌權威，單靠網站程式碼無法保證搜尋排名。
- CLI tool：本站是公開內容 archive，不需要為了 checker 發布沒有真實產品操作的 npm、PyPI 或 Homebrew CLI。
- Rate limit response headers：目前沒有真正的 distributed rate limiter，因此不偽造剩餘額度或 reset 值。
- Developer resource discoverability：站內已有 developer portal、OpenAPI、auth、MCP 與 skill resources，但外部 name-based search 仍可能有索引延遲或雜訊。
- MCP server／manifest：server card 與 `/mcp` 已可用，但 Ora 仍期待另一種標準 MCP manifest endpoint。
- REST versioning／deprecation：version header 與遷移政策已提供，Ora 仍希望看到實際的 `Deprecation`／`Sunset` 案例或專門政策頁。
- Public API/docs linked from homepage：首頁已有可見 developer／API links，scanner 對 developer page 的內容厚度仍給 partial。
- Agent instruction／when-to-use：`llms.txt` 與 skill 都已加入 when-to-use guidance，Ora 的 cached／heuristic check 仍給 partial。

分數已達 100/100，因此沒有為了追逐 checker 而新增虛假的交易、登入、OAuth、A2A 或 rate-limit service。

### Cloudflare Agent Readiness

Cloudflare dashboard [Agent Readiness diagnostics](https://dash.cloudflare.com/a6467645a8f76463416f3db199174bca/darrenhuang.com/agent-readiness/diagnostics?hostname=www.darrenhuang.com) 已在正式 deployment 後顯示 `Agent Ready`。
最新分類為 Quick Wins `5/5`、Technical Groundwork `2/3`、Advanced Integration `3/8`，Commerce 為 optional `0/5`。
Technical Groundwork 剩下的項目是 Auth.md registration flow；本站沒有帳號或受保護 API，因此 auth.md 已明確說明 registration 不需要，沒有建立假的 registration endpoint。
Advanced Integration 已通過 Skills Index、MCP Server Card 與 WebMCP。
OAuth Discovery、OAuth Protected Resource、A2A Agent Card、Web Bot Auth 與 DNS-AID 都需要真實的受保護或 agent-to-agent service，本站目前沒有這些服務。
Cloudflare 的 `Agent Ready` 狀態與網站目前的公開唯讀定位一致。

獨立的 [Agent Readiness live audit](https://isitagentready.com/) 也已驗證 Level 4/5 `Agent-Integrated`。
該 audit 的 Discoverability 為 `3/4`、Content Accessibility 為 `1/1`、Bot Access Control 為 `2/2`、API／Auth／MCP／A2A Discovery 為 `5/9`。

## DNS-AID 決策

目前刻意不建立 DNS-AID record。
[DNS-AID](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/) 仍是 Internet-Draft，且其 discovery records 應該指向真實可用的 agent service，通常還需要正確的 SVCB／HTTPS parameters 與 DNSSEC 覆蓋。
本網站目前提供的是網站內容 API、WebMCP 與 MCP endpoint，而不是一個需要以 DNS-AID 尋址的獨立 A2A service。
未來若新增真實 agent service，再以 DNSSEC、SVCB／HTTPS records 與對應 protocol parameters 實作，才會是誠實且可維護的加分。

## 驗證證據

- `npm run build` 通過，產生 212 pages、211 Markdown pages、86 article entries 與 23 note entries。
- `npm run verify:dist` 通過，驗證 89 個 canonical outputs、320 個 HTML 與 261.8 MiB artifact。
- `npm run typecheck` 通過。
- `npm run format:check` 通過。
- `npm run lint` 通過。
- `npm run test` 通過，14 個 test files、62 個 tests 全部成功。
- `npm run test:worker` 通過，14 個 Worker tests 全部成功。
- `npm run worker:build` dry-run 通過，Worker bundle 為 19.56 KiB、gzip 後 5.34 KiB。
- GitHub Actions workflow `33228670108` 已通過 desktop 與 mobile E2E checks，annotation 顯示 26 passed。
- Production smoke 已確認 `/membership`、`/developers`、Markdown 404、API JSON 404／405、`X-API-Version: 1`、OpenAPI、內容 API、API Catalog、ARD catalog、MCP Server Card、Skills index 與 `/mcp` 可取得。
- Production smoke 已確認不支援的 `X-API-Version: 2` 會得到 HTTP 400 的結構化 JSON error。
- Production MCP smoke 已確認 initialize、`notifications/initialized`、`tools/list` 與 `search_content` request 都能得到預期 JSON-RPC response。

## 可重跑命令

```powershell
npm run build
npm run verify:dist
npm run test:e2e
npm run test:worker
npm run worker:types:check
npm run worker:build
npm run worker:deploy
npm run audit:agent-readiness -- https://www.darrenhuang.com all
npx is-agentic www.darrenhuang.com --json
```

掃描其他站點或 profile 時使用 positional arguments，避免 npm 10 將未知長旗標解讀成 npm config。
