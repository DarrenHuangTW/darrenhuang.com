# Security policy

## Supported versions

The `main` branch is the only actively maintained version of this static site and its public read-only Worker.

Older commits and branches are historical references and do not receive security fixes.

## Reporting a vulnerability

Please do not publish sensitive vulnerability details in a public issue.

Use GitHub's private vulnerability reporting feature when it is available for this repository.

If private reporting is unavailable, contact the repository owner through GitHub with a minimal description and a safe way to reproduce the issue.

Do not include passwords, access tokens, private migration exports, mailbox data, or other credentials in a report.

The maintainer will assess the report, reproduce it where possible, and coordinate a fix or mitigation before public disclosure.

## Scope

The scope includes the Astro build and published artifacts, GitHub Actions workflows, and the Cloudflare Worker in `cloudflare/agent-readiness/`.

The public API and MCP endpoint are intentionally anonymous, read-only, and limited to published content.

They do not provide authentication, account access, payments, private content, or actions on behalf of a visitor.
