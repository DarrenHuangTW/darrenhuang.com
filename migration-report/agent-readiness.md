# Agent Readiness 優化報告

最後更新：2026-08-15。

狀態：repository 內的 agent-readable 內容、探索 metadata、Free-plan Worker、自動驗證與手動 live audit 已完成。
Cloudflare zone 已確認使用 Free plan。
本報告所述的新 artifact 與 Worker 尚未 push 或部署。

## 線上基準

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
- Root `.nojekyll` 會保留 `.well-known` 目錄，避免 GitHub Pages 的 Jekyll 規則排除 Agent Skill discovery files。
- Pages artifact upload 明確啟用 hidden files，確保 `.nojekyll` 與 `.well-known` 都進入實際發布 tarball。
- Skill index 依 Agent Skills Discovery v0.2.0 產生 SHA-256 digest，dist verifier 會重新計算並拒絕不一致的 artifact。
- `npm run audit:agent-readiness` 可透過 Cloudflare 官方 MCP scanner 重跑 live `content` profile。
- Dist verifier 會檢查 Markdown alternate、86 篇文章輸出、LLM indexes、skill schema、skill URL 與 digest。
- Playwright 會在桌機與手機專案驗證 LLM indexes、Markdown content type、canonical metadata 與 skill discovery endpoint。

## Cloudflare 邊緣部署

以下設定必須在包含新 artifact 的 GitHub Pages deploy 完成後才驗證。

### 1. Markdown content negotiation

這個 zone 已確認使用 Free plan，因此無法啟用只提供給 Pro、Business 與 Enterprise 的 managed Markdown for Agents。
不應只為分數直接升級。
Repository 已產生完整 `.md` alternates，並在 `cloudflare/agent-readiness` 實作 Free-plan Worker。
Worker 只替明確接受 `text/markdown` 的安全讀取要求取得對應 `.md` artifact，保留 query string，並以串流方式回傳 body。
一般瀏覽、非頁面資源與非安全 HTTP methods 會原樣傳到 GitHub Pages origin。
若 Markdown artifact 不存在，Worker 會回退到原始 HTML，不會把缺漏擴大成網站中斷。
Wrangler runtime tests、generated types check 與 deploy dry-run 都納入 CI。
正式 wildcard route 會啟用 request-limit fail-open，Free plan allowance 用完時仍直接由 GitHub Pages origin 回應。
`/_astro/*`、`/wp-content/*` 與 `/story-media/*` 會使用更精確的 no-script routes 略過 Worker，避免靜態 assets 消耗 allowance。
這些 route-level safeguards 不在 `wrangler.jsonc` 內，之後每次 route deployment 都必須重新確認。

### 2. HTTP Link response header

同一個 Worker 會在正式 homepage 回應加入下列 header：

```http
Link: </llms.txt>; rel="describedby"; type="text/plain"
```

`describedby` 是已註冊的 relation，且 `/llms.txt` 是真實、可讀、與網站相關的資源。
把 Link header 與 content negotiation 放在同一份可測試、可版本化的 Worker source，可避免另外維護 Dashboard-only Transform Rule。

### 3. DNS-AID

目前不建議為了分數建立 DNS-AID record。
DNS-AID 仍是新興 draft，而且這個靜態內容網站沒有 A2A、MCP 或其他 agent service endpoint 可誠實宣告。
若未來新增真實 agent endpoint，再以 DNSSEC、SVCB／HTTPS records 與對應 protocol parameters 實作。

## 預期驗證

- 新 artifact 發布後，full profile 的 Agent Skills check 應由 fail 轉為 pass。
- Free-plan Markdown negotiation Worker 與 Link header 完成後，content profile 應由 4/7 增加到 6/7 個 passing checks。
- DNS-AID 會暫時保留為刻意接受的唯一 content-profile gap。
- 實際 Level 必須以部署後的 Cloudflare scanner 結果為準，不在發布前預先宣稱。

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
