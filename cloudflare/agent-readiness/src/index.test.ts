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
    expect(response.headers.get('link')).toBe(
      '</llms.txt>; rel="describedby"; type="text/plain"',
    );
    expect(response.headers.get('vary')).toBe('Accept');
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
});
