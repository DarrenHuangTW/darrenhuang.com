import { fileURLToPath } from 'node:url';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createTestHarness } from 'wrangler';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const server = createTestHarness({
  root: repoRoot,
  workers: [
    {
      configPath: 'cloudflare/agent-readiness/wrangler.jsonc',
    },
  ],
});

beforeAll(async () => {
  await server.listen();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.close();
});

function mockOrigin(
  responder: (request: Request) => Response | Promise<Response>,
): Request[] {
  const requests: Request[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return responder(request);
  });
  return requests;
}

describe('agent readiness Worker', () => {
  it('serves the generated Markdown alternate for an explicit preference', async () => {
    const requests = mockOrigin(
      () =>
        new Response('# Agent-readable article', {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            Vary: 'Accept-Encoding',
          },
        }),
    );

    const response = await server.fetch(
      'https://www.darrenhuang.com/seo-newsletter-issue-70-71.html?source=agent',
      { headers: { Accept: 'text/markdown, text/html;q=0.5' } },
    );

    expect(await response.text()).toBe('# Agent-readable article');
    expect(response.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(response.headers.get('content-location')).toBe(
      '/seo-newsletter-issue-70-71.md?source=agent',
    );
    expect(response.headers.get('vary')).toBe('Accept-Encoding, Accept');
    expect(requests).toHaveLength(1);
    const originUrl = new URL(requests[0]?.url ?? '');
    expect(originUrl.hostname).toBe('www.darrenhuang.com');
    expect(`${originUrl.pathname}${originUrl.search}`).toBe(
      '/seo-newsletter-issue-70-71.md?source=agent',
    );
  });

  it.each([
    ['/', '/index.md'],
    ['/web-stories/example/', '/web-stories/example/index.md'],
  ])('maps %s to %s', async (pathname, expectedPath) => {
    const requests = mockOrigin(() => new Response('# Markdown'));

    const response = await server.fetch(
      `https://www.darrenhuang.com${pathname}`,
      { headers: { Accept: 'text/markdown' } },
    );

    expect(response.status).toBe(200);
    expect(new URL(requests[0]?.url ?? '').pathname).toBe(expectedPath);
  });

  it('adds homepage discovery without changing browser HTML', async () => {
    const requests = mockOrigin(
      () =>
        new Response('<h1>數位引擎</h1>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    );

    const response = await server.fetch('https://www.darrenhuang.com/');

    expect(await response.text()).toBe('<h1>數位引擎</h1>');
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
    expect(response.headers.get('link')).toContain(
      '</llms.txt>; rel="describedby"; type="text/plain"',
    );
    expect(response.headers.get('link')).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
    );
    expect(response.headers.get('vary')).toBe('Accept');
    expect(response.headers.get('origin-agent-cluster')).toBe('?1');
    expect(response.headers.get('permissions-policy')).toBe('tools=(self)');
    const originUrl = new URL(requests[0]?.url ?? '');
    expect(originUrl.hostname).toBe('www.darrenhuang.com');
    expect(originUrl.pathname).toBe('/');
  });

  it('honors q=0 and passes the original HTML request through', async () => {
    const requests = mockOrigin(
      () => new Response('<h1>HTML</h1>', { status: 200 }),
    );

    const response = await server.fetch(
      'https://www.darrenhuang.com/articles.html',
      { headers: { Accept: 'text/markdown;q=0, text/html' } },
    );

    expect(await response.text()).toBe('<h1>HTML</h1>');
    expect(response.headers.get('vary')).toBe('Accept');
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/articles.html');
  });

  it('falls back to HTML when a Markdown artifact is missing', async () => {
    const requests = mockOrigin((request) => {
      if (new URL(request.url).pathname.endsWith('.md')) {
        return new Response('missing', { status: 404 });
      }

      return new Response('<h1>Fallback HTML</h1>', { status: 200 });
    });

    const response = await server.fetch(
      'https://www.darrenhuang.com/not-generated.html',
      { headers: { Accept: 'text/markdown' } },
    );

    expect(await response.text()).toBe('<h1>Fallback HTML</h1>');
    expect(response.headers.get('vary')).toBe('Accept');
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/not-generated.md',
      '/not-generated.html',
    ]);
  });

  it('does not negotiate unsafe request methods', async () => {
    const requests = mockOrigin(
      async (request) => new Response(await request.text(), { status: 201 }),
    );

    const response = await server.fetch(
      'https://www.darrenhuang.com/articles.html',
      {
        method: 'POST',
        headers: { Accept: 'text/markdown' },
        body: 'preserve this body',
      },
    );

    expect(response.status).toBe(201);
    expect(await response.text()).toBe('preserve this body');
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/articles.html');
  });

  it('serves a stateless MCP handshake and tool catalog', async () => {
    mockOrigin(() => new Response('{}'));

    const initialize = await server.fetch('https://www.darrenhuang.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18' },
      }),
    });
    expect(initialize.status).toBe(200);
    expect(initialize.headers.get('content-type')).toContain(
      'application/json',
    );
    expect(initialize.headers.get('mcp-protocol-version')).toBe('2025-06-18');
    const initializeBody = (await initialize.json()) as {
      result?: { capabilities?: { tools?: { listChanged?: boolean } } };
    };
    expect(initializeBody.result?.capabilities?.tools?.listChanged).toBe(false);

    const list = await server.fetch('https://www.darrenhuang.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    const listBody = (await list.json()) as {
      result?: { tools?: Array<{ name?: string }> };
    };
    expect(listBody.result?.tools?.map((tool) => tool.name)).toEqual([
      'search_content',
      'read_content',
    ]);
  });

  it('executes read-only MCP content tools through the origin API', async () => {
    const requests = mockOrigin((request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/api/content.json') {
        return new Response(
          JSON.stringify({
            items: [
              {
                kind: 'article',
                slug: 'seo-basics',
                title: 'SEO 基礎',
                description: '搜尋引擎最佳化入門。',
              },
            ],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (pathname === '/api/articles/seo-basics.json') {
        return new Response(
          JSON.stringify({
            slug: 'seo-basics',
            title: 'SEO 基礎',
            content: '# SEO 基礎',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const search = await server.fetch('https://www.darrenhuang.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'search_content', arguments: { query: 'SEO' } },
      }),
    });
    const searchBody = (await search.json()) as {
      result?: { structuredContent?: { count?: number } };
    };
    expect(searchBody.result?.structuredContent?.count).toBe(1);

    const read = await server.fetch('https://www.darrenhuang.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'read_content', arguments: { slug: 'seo-basics' } },
      }),
    });
    const readBody = (await read.json()) as {
      result?: { structuredContent?: { content?: string } };
    };
    expect(readBody.result?.structuredContent?.content).toBe('# SEO 基礎');
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/api/content.json',
      '/api/articles/seo-basics.json',
    ]);
  });

  it('handles MCP CORS preflight and structured method errors', async () => {
    mockOrigin(() => new Response('{}'));

    const preflight = await server.fetch('https://www.darrenhuang.com/mcp', {
      method: 'OPTIONS',
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-methods')).toContain(
      'POST',
    );

    const invalid = await server.fetch('https://www.darrenhuang.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(invalid.status).toBe(400);
    const invalidBody = (await invalid.json()) as {
      error?: { code?: number; message?: string };
    };
    expect(invalidBody.error).toMatchObject({ code: -32600 });
  });

  it('turns missing public API items into structured JSON errors', async () => {
    mockOrigin(
      () =>
        new Response('<html><h1>Not found</h1></html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }),
    );

    const response = await server.fetch(
      'https://www.darrenhuang.com/api/articles/missing.json',
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as {
      error?: { code?: string; hint?: string };
    };
    expect(body.error).toMatchObject({
      code: 'not_found',
      hint: expect.stringContaining('/api/content.json'),
    });
  });
});
