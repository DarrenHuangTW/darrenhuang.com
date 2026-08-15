---
name: research-digital-engine
description: Find, evaluate, and cite Traditional Chinese SEO and digital marketing articles from 數位引擎. Use when researching topics covered by darrenhuang.com or when a user asks for material from this site.
---

# Research 數位引擎

Use this skill to locate and cite public content from `www.darrenhuang.com` efficiently.

## Find relevant material

1. Fetch `https://www.darrenhuang.com/llms.txt` for the site overview and machine-readable entry points.
2. Fetch `https://www.darrenhuang.com/articles-llms.txt` for the complete article directory.
3. Select only the articles relevant to the user's question.
4. Fetch the linked Markdown versions instead of scraping navigation-heavy HTML.

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

- The site is a public content archive, not an API, authentication provider, commerce service, MCP server, or A2A agent.
- Do not invent actions or capabilities that the site does not publish.
- Respect the site's `robots.txt` and Content Signals when accessing or reusing content.
