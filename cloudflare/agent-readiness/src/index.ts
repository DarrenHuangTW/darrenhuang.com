const markdownMediaType = 'text/markdown';
const discoveryLink = '</llms.txt>; rel="describedby"; type="text/plain"';

export function acceptsMarkdown(header: string | null): boolean {
  if (!header) {
    return false;
  }

  return header.split(',').some((candidate) => {
    const [mediaType, ...parameters] = candidate
      .split(';')
      .map((part) => part.trim().toLowerCase());
    if (mediaType !== markdownMediaType) {
      return false;
    }

    const qualityParameter = parameters.find((parameter) =>
      parameter.startsWith('q='),
    );
    if (!qualityParameter) {
      return true;
    }

    const quality = Number.parseFloat(qualityParameter.slice(2));
    return Number.isFinite(quality) && quality > 0 && quality <= 1;
  });
}

export function markdownPathForRequest(pathname: string): string | undefined {
  if (pathname === '/') {
    return '/index.md';
  }

  if (pathname.endsWith('.html')) {
    return `${pathname.slice(0, -'.html'.length)}.md`;
  }

  if (pathname.endsWith('/')) {
    return `${pathname}index.md`;
  }

  return undefined;
}

function appendVary(headers: Headers, value: string): void {
  const current = headers.get('vary');
  if (!current) {
    headers.set('Vary', value);
    return;
  }

  const values = current.split(',').map((item) => item.trim().toLowerCase());
  if (!values.includes('*') && !values.includes(value.toLowerCase())) {
    headers.set('Vary', `${current}, ${value}`);
  }
}

function addDiscoveryLink(headers: Headers): void {
  const current = headers.get('link');
  if (!current?.toLowerCase().includes('rel="describedby"')) {
    headers.append('Link', discoveryLink);
  }
}

function responseWithHeaders(
  response: Response,
  configure: (headers: Headers) => void,
): Response {
  const headers = new Headers(response.headers);
  configure(headers);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchOrigin(request: Request): Promise<Response> {
  return fetch(request);
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isSafeRead = request.method === 'GET' || request.method === 'HEAD';
  const markdownPath = isSafeRead
    ? markdownPathForRequest(url.pathname)
    : undefined;
  const wantsMarkdown =
    Boolean(markdownPath) && acceptsMarkdown(request.headers.get('accept'));

  if (wantsMarkdown && markdownPath) {
    const markdownUrl = new URL(url);
    markdownUrl.pathname = markdownPath;
    const markdownRequest = new Request(markdownUrl, request);
    const markdownResponse = await fetchOrigin(markdownRequest);

    if (markdownResponse.ok) {
      return responseWithHeaders(markdownResponse, (headers) => {
        headers.set('Content-Type', `${markdownMediaType}; charset=utf-8`);
        headers.set('Content-Location', `${markdownPath}${url.search}`);
        appendVary(headers, 'Accept');
        if (url.pathname === '/') {
          addDiscoveryLink(headers);
        }
      });
    }

    await markdownResponse.body?.cancel();
    console.warn(
      JSON.stringify({
        message: 'Markdown alternate unavailable; serving HTML fallback',
        markdownPath,
        path: url.pathname,
        status: markdownResponse.status,
      }),
    );
  }

  const response = await fetchOrigin(request);
  if (!markdownPath && url.pathname !== '/') {
    return response;
  }

  return responseWithHeaders(response, (headers) => {
    if (markdownPath) {
      appendVary(headers, 'Accept');
    }
    if (url.pathname === '/') {
      addDiscoveryLink(headers);
    }
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'Agent readiness edge request failed',
          error: error instanceof Error ? error.message : String(error),
          method: request.method,
          path: new URL(request.url).pathname,
        }),
      );
      return new Response('Bad Gateway', {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
