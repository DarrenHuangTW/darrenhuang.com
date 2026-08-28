# Agent Readiness Worker

This Worker adds agent discovery, Markdown content negotiation, and a small read-only MCP endpoint in front of the existing GitHub Pages origin.

It preserves ordinary browser responses and streams origin bodies without buffering them.
For safe `GET` and `HEAD` requests that explicitly accept `text/markdown`, it requests the generated Markdown artifact with the same query string and returns it at the canonical URL.
If the Markdown artifact is unavailable, it falls back to the original HTML response.

The homepage response advertises `/llms.txt` with a registered `describedby` HTTP `Link` relation.
It also advertises the API Catalog, Agent Skills index, and MCP Server Card with HTTP `Link` relations.

The static build publishes a public OpenAPI 3.1 document at `/openapi.json`, JSON content indexes under `/api/`, `/.well-known/api-catalog`, `/auth.md`, and `/.well-known/mcp/server-card.json`.
The Worker implements stateless MCP JSON-RPC for `initialize`, `ping`, `tools/list`, and `tools/call`.
The two MCP tools are `search_content` and `read_content`, and both are explicitly read-only.
The Worker converts missing content detail responses into structured JSON errors so agents do not have to parse the site's HTML 404 page.

## Commands

```powershell
npm run worker:types
npm run worker:types:check
npm run worker:build
npm run test:worker
npm run worker:deploy
```

`wrangler.jsonc` is the source of truth for the Worker name, compatibility date, route, and observability configuration.
Deploy only after the matching GitHub Pages artifact is live so every canonical page has its generated `.md` alternate.

The production route uses request-limit fail-open so the GitHub Pages origin remains reachable if the Free-plan Worker quota is exhausted.
More-specific no-script routes bypass the Worker for `/_astro/*`, `/wp-content/*`, and `/story-media/*` assets so those requests do not consume the Worker allowance.
These route-level safeguards live in the Cloudflare zone rather than `wrangler.jsonc`; verify them after every route deployment.

## Verification

```powershell
curl.exe -I https://www.darrenhuang.com/
curl.exe -i https://www.darrenhuang.com/ -H "Accept: text/markdown"
npm run build
npm run verify:dist
npm run worker:build
npm run test:worker
npm run audit:agent-readiness
```

The first response must include a `Link` header for `/llms.txt`.
The second response must include `Content-Type: text/markdown`, `Vary: Accept`, and the Markdown body while keeping the requested canonical URL.
The API Catalog response must use the RFC 9727 Linkset media type and include the OpenAPI and MCP endpoint links.
An MCP client can verify the endpoint with a JSON-RPC `initialize` request followed by `tools/list`.

The site does not publish OAuth, A2A, DNS-AID, or Web Bot Auth metadata because it does not operate a protected API, an AI agent, DNS-discoverable agent service, or outbound bot identity.

## Rollback

Remove or disable the `www.darrenhuang.com/*` Worker route first.
Normal traffic will immediately return directly to GitHub Pages.
The Worker can then be rolled back or deleted without affecting the origin deployment.
