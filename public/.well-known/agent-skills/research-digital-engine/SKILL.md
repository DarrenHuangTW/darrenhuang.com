---
name: research-digital-engine
description: Find, evaluate, and cite Traditional Chinese SEO and digital marketing articles from 數位引擎. Use when researching topics covered by darrenhuang.com or when a user asks for material from this site.
---

# Research 數位引擎

Use this skill to locate, search, and cite public content from `www.darrenhuang.com` efficiently.

## Find relevant material

1. Fetch `https://www.darrenhuang.com/llms.txt` for the site overview and machine-readable entry points.
2. Fetch `https://www.darrenhuang.com/articles-llms.txt` for the complete article directory.
3. Fetch `https://www.darrenhuang.com/api/content.json` when metadata filtering or programmatic discovery is useful.
4. Select only the articles or notes relevant to the user's question.
5. Fetch the linked Markdown versions instead of scraping navigation-heavy HTML.

## Use the public interfaces

- Read `https://www.darrenhuang.com/openapi.json` for the public read-only API schema.
- Read `https://www.darrenhuang.com/.well-known/api-catalog` for the RFC 9727 API entrypoint catalog.
- Use `https://www.darrenhuang.com/mcp` only for the published read-only `search_content` and `read_content` tools.
- Browser agents may use the same two tools through WebMCP when the browser exposes `document.modelContext` or a compatible bridge.
- The public API and MCP endpoint do not support login, account changes, purchases, payments, writes, or deletion.

## Interpret the content

- Treat each article's publication and modification dates as part of its meaning.
- Verify time-sensitive claims such as product interfaces, policies, algorithms, pricing, and platform behavior against current primary sources.
- Distinguish the author's observations and opinions from externally verifiable facts.
- Preserve the original Traditional Chinese terminology when it materially affects meaning.

## Cite correctly

- Use the `canonical` URL in each Markdown document's frontmatter when citing or sharing an article.
- Do not cite the generated `.md` URL as the public article URL.
- Attribute opinions and first-person experiences to Darren Huang or 數位引擎.
- Link directly to the specific article rather than the homepage or article directory.

## Boundaries

- The site is a public content archive with small, read-only API, MCP, and WebMCP interfaces.
- Do not invent authentication, commerce, account, write, or agent actions that the site does not publish.
- Respect the site's `robots.txt` and Content Signals when accessing or reusing content.
