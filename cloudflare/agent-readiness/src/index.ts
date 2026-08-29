const markdownMediaType = 'text/markdown';
const discoveryLinks = [
  '</llms.txt>; rel="describedby"; type="text/plain"',
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/ai-catalog+json"',
  '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
  '</.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"',
];
const apiCatalogPath = '/.well-known/api-catalog';
const ardCatalogPath = '/.well-known/ai-catalog.json';
const mcpPath = '/mcp';
const apiRootPath = '/api';
const apiVersionHeader = 'X-API-Version';
const apiVersion = '1';
const mcpProtocolVersion = '2025-06-18';
const mcpRequestMaxBytes = 64 * 1024;
const mcpServerInfo = {
  name: 'darrenhuang-public-content',
  version: '1.0.0',
};

type JsonRpcId = string | number | null;
type JsonRecord = Record<string, unknown>;

interface JsonRpcRequest {
  id?: JsonRpcId;
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

interface ContentItem {
  canonicalUrl?: string;
  description?: string;
  kind?: 'article' | 'note';
  markdownUrl?: string;
  publishedAt?: string | null;
  slug: string;
  title: string;
  updatedAt?: string | null;
}

interface McpToolDefinition {
  annotations: {
    readOnlyHint: true;
    untrustedContentHint: true;
  };
  description: string;
  inputSchema: JsonRecord;
  name: string;
  title: string;
}

const mcpTools: McpToolDefinition[] = [
  {
    name: 'search_content',
    title: 'Search 數位引擎 content',
    description:
      'Search the public Traditional Chinese articles and Facebook notes on 數位引擎.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 120 },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'read_content',
    title: 'Read 數位引擎 content',
    description:
      'Read one public article or Facebook note with its canonical URL and Markdown content.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['article', 'note'], default: 'article' },
        slug: { type: 'string', minLength: 1, maxLength: 160 },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
];

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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function appendLink(headers: Headers, value: string): void {
  const current = headers.get('link');
  if (!current?.includes(value)) {
    headers.append('Link', value);
  }
}

function addDiscoveryLinks(headers: Headers): void {
  for (const link of discoveryLinks) {
    appendLink(headers, link);
  }
}

function addPageAgentHeaders(headers: Headers): void {
  headers.set('Origin-Agent-Cluster', '?1');
  headers.set('Permissions-Policy', 'tools=(self)');
}

function addPublicAgentHeaders(headers: Headers): void {
  addPageAgentHeaders(headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Content-Type-Options', 'nosniff');
}

function addApiAgentHeaders(headers: Headers): void {
  addPublicAgentHeaders(headers);
  headers.set(apiVersionHeader, apiVersion);
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

async function fetchOriginPath(
  request: Request,
  pathname: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  return fetchOrigin(
    new Request(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }),
  );
}

function jsonResponse(
  value: unknown,
  status: number,
  headers: Headers,
): Response {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { status, headers });
}

function apiErrorResponse(status: number): Response {
  const normalizedStatus = status >= 400 && status <= 599 ? status : 502;
  const isNotFound = normalizedStatus === 404;
  const isMethodNotAllowed = normalizedStatus === 405;
  const headers = new Headers();
  addApiAgentHeaders(headers);
  if (isMethodNotAllowed) {
    headers.set('Allow', 'GET, HEAD');
  }

  return jsonResponse(
    {
      error: {
        code: isNotFound
          ? 'not_found'
          : isMethodNotAllowed
            ? 'method_not_allowed'
            : 'api_error',
        message: isNotFound
          ? 'The requested public API resource was not found.'
          : isMethodNotAllowed
            ? 'The requested API resource does not support this method.'
            : 'The public API could not complete the request.',
        hint: 'Read /openapi.json for valid endpoints, /api/content.json for public slugs, and X-API-Version: 1 for the current API version.',
      },
    },
    normalizedStatus,
    headers,
  );
}

function unsupportedApiVersionResponse(): Response {
  const headers = new Headers();
  addApiAgentHeaders(headers);
  return jsonResponse(
    {
      error: {
        code: 'unsupported_api_version',
        message: `Only public API version ${apiVersion} is currently supported.`,
        hint: `Send ${apiVersionHeader}: ${apiVersion} or read /openapi.json for the version policy.`,
      },
    },
    400,
    headers,
  );
}

function notFoundMarkdown(url: URL): string {
  const link = (pathname: string): string =>
    new URL(pathname, url.origin).toString();
  return [
    '# 找不到頁面',
    '',
    '此網址沒有對應的公開內容。',
    '',
    '你可以從以下入口繼續：',
    '',
    `- [網站首頁](${link('/')})`,
    `- [llms.txt](${link('/llms.txt')})`,
    `- [文章索引](${link('/articles-llms.txt')})`,
    `- [Sitemap](${link('/sitemap-index.xml')})`,
    `- [開發者與 Agent 入口](${link('/developers.html')})`,
    '',
  ].join('\n');
}

function markdownNotFoundResponse(request: Request, url: URL): Response {
  const headers = new Headers();
  addPublicAgentHeaders(headers);
  headers.set('Content-Type', `${markdownMediaType}; charset=utf-8`);
  headers.set('Content-Location', `${url.pathname}${url.search}`);
  appendVary(headers, 'Accept');
  return new Response(
    request.method === 'HEAD' ? null : notFoundMarkdown(url),
    { status: 404, headers },
  );
}

function mcpHeaders(): Headers {
  return new Headers({
    'Access-Control-Allow-Headers':
      'Accept, Content-Type, MCP-Protocol-Version, MCP-Session-Id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'MCP-Protocol-Version',
    'Cache-Control': 'no-store',
    'MCP-Protocol-Version': mcpProtocolVersion,
  });
}

function mcpJsonResponse(value: unknown, status = 200): Response {
  return jsonResponse(value, status, mcpHeaders());
}

function mcpEmptyResponse(status = 204): Response {
  return new Response(null, { status, headers: mcpHeaders() });
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRecord {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function jsonRpcResult(id: JsonRpcId, result: unknown): JsonRecord {
  return { jsonrpc: '2.0', id, result };
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function parseJsonRpcRequest(source: string): JsonRpcRequest | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || parsed.jsonrpc !== '2.0') {
    return undefined;
  }
  if (typeof parsed.method !== 'string' || !parsed.method) {
    return undefined;
  }

  let id: JsonRpcId | undefined;
  if ('id' in parsed) {
    if (!isJsonRpcId(parsed.id)) {
      return undefined;
    }
    id = parsed.id;
  }

  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    method: parsed.method,
  };
  if (id !== undefined) {
    request.id = id;
  }
  if ('params' in parsed) {
    request.params = parsed.params;
  }
  return request;
}

function contentItem(value: unknown): value is ContentItem {
  return (
    isRecord(value) &&
    typeof value.slug === 'string' &&
    typeof value.title === 'string'
  );
}

async function readContentItems(request: Request): Promise<ContentItem[]> {
  const response = await fetchOriginPath(request, '/api/content.json');
  const source = await response.text();
  if (!response.ok) {
    throw new Error(`Content index returned ${response.status}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error('Content index was not valid JSON.');
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new Error('Content index did not contain an items array.');
  }

  return parsed.items.filter(contentItem);
}

async function readContentDetail(
  request: Request,
  kind: 'articles' | 'notes',
  slug: string,
): Promise<unknown> {
  const response = await fetchOriginPath(
    request,
    `/api/${kind}/${encodeURIComponent(slug)}.json`,
  );
  const source = await response.text();
  if (!response.ok) {
    throw new Error(`Content item returned ${response.status}.`);
  }

  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error('Content item was not valid JSON.');
  }
}

function toolResult(value: unknown): JsonRecord {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function toolError(message: string): JsonRecord {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

class McpRequestTooLargeError extends Error {
  constructor() {
    super('MCP request is too large.');
    this.name = 'McpRequestTooLargeError';
  }
}

function exceedsMcpRequestMaxFromHeader(request: Request): boolean {
  const value = request.headers.get('content-length')?.trim();
  if (!value || !/^\d+$/u.test(value)) {
    return false;
  }

  const length = Number(value);
  return !Number.isSafeInteger(length) || length > mcpRequestMaxBytes;
}

async function readMcpRequestBody(request: Request): Promise<string> {
  if (exceedsMcpRequestMaxFromHeader(request)) {
    throw new McpRequestTooLargeError();
  }

  const body: ReadableStream<Uint8Array> | null = request.body;
  if (!body) {
    return '';
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!(value instanceof Uint8Array)) {
        await reader.cancel('MCP request body was not a byte stream.');
        throw new Error('MCP request body was not a byte stream.');
      }

      if (value.byteLength > mcpRequestMaxBytes - totalBytes) {
        await reader.cancel('MCP request is too large.');
        throw new McpRequestTooLargeError();
      }

      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function mcpRequestTooLargeResponse(): Response {
  return mcpJsonResponse(
    jsonRpcError(null, -32600, 'MCP request is too large.'),
    413,
  );
}

async function executeTool(
  request: Request,
  name: string,
  argumentsValue: JsonRecord,
): Promise<JsonRecord> {
  try {
    if (name === 'search_content') {
      const query =
        typeof argumentsValue.query === 'string'
          ? argumentsValue.query.trim()
          : '';
      if (!query) {
        return toolError('query is required.');
      }

      const requestedLimit = Number(argumentsValue.limit ?? 5);
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(10, Math.max(1, requestedLimit))
        : 5;
      const normalizedQuery = query.toLowerCase();
      const items = await readContentItems(request);
      const results = items
        .filter((item) => {
          const haystack = [item.title, item.description, item.slug, item.kind]
            .filter((value) => typeof value === 'string')
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
        .slice(0, limit);
      return toolResult({ query, count: results.length, results });
    }

    if (name === 'read_content') {
      const slug =
        typeof argumentsValue.slug === 'string'
          ? argumentsValue.slug.trim()
          : '';
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(slug)) {
        return toolError(
          'slug must contain only letters, numbers, dots, underscores, or hyphens.',
        );
      }
      const kind = argumentsValue.kind === 'note' ? 'notes' : 'articles';
      return toolResult(await readContentDetail(request, kind, slug));
    }

    return toolError(`Unknown tool: ${name}.`);
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return mcpEmptyResponse();
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const headers = mcpHeaders();
    headers.set('Allow', 'POST, OPTIONS');
    return jsonResponse(
      {
        error: {
          code: 'method_not_allowed',
          message:
            'This stateless MCP endpoint accepts POST JSON-RPC requests.',
        },
      },
      405,
      headers,
    );
  }

  if (request.method !== 'POST') {
    return mcpJsonResponse(
      {
        error: {
          code: 'method_not_allowed',
          message: 'MCP accepts POST, or OPTIONS for CORS preflight.',
        },
      },
      405,
    );
  }

  let source: string;
  try {
    source = await readMcpRequestBody(request);
  } catch (error) {
    if (error instanceof McpRequestTooLargeError) {
      return mcpRequestTooLargeResponse();
    }
    throw error;
  }

  const rpc = parseJsonRpcRequest(source);
  if (!rpc) {
    return mcpJsonResponse(
      jsonRpcError(null, -32600, 'Invalid JSON-RPC request.'),
      400,
    );
  }

  const id = rpc.id ?? null;
  if (rpc.method === 'notifications/initialized') {
    return mcpEmptyResponse();
  }

  if (rpc.method === 'ping') {
    return mcpJsonResponse(jsonRpcResult(id, {}));
  }

  if (rpc.method === 'initialize') {
    return mcpJsonResponse(
      jsonRpcResult(id, {
        protocolVersion: mcpProtocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: mcpServerInfo,
        instructions:
          'Use tools/list to inspect the two public read-only content tools.',
      }),
    );
  }

  if (rpc.method === 'tools/list') {
    return mcpJsonResponse(jsonRpcResult(id, { tools: mcpTools }));
  }

  if (rpc.method === 'tools/call') {
    if (!isRecord(rpc.params) || typeof rpc.params.name !== 'string') {
      return mcpJsonResponse(
        jsonRpcError(id, -32602, 'tools/call requires a tool name.'),
        400,
      );
    }
    const argumentsValue = rpc.params.arguments ?? {};
    if (!isRecord(argumentsValue)) {
      return mcpJsonResponse(
        jsonRpcError(id, -32602, 'tools/call arguments must be an object.'),
        400,
      );
    }
    const result = await executeTool(request, rpc.params.name, argumentsValue);
    return mcpJsonResponse(jsonRpcResult(id, result));
  }

  return mcpJsonResponse(
    jsonRpcError(id, -32601, `Method not found: ${rpc.method}.`),
    404,
  );
}

function isAgentResource(pathname: string): boolean {
  return (
    pathname === '/auth.md' ||
    pathname === '/openapi.json' ||
    pathname.startsWith('/api/') ||
    pathname === ardCatalogPath ||
    pathname === '/.well-known/agent-skills/index.json' ||
    pathname === '/.well-known/mcp/server-card.json'
  );
}

function isApiPath(pathname: string): boolean {
  return pathname === apiRootPath || pathname.startsWith(`${apiRootPath}/`);
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (isApiPath(url.pathname)) {
    const requestedVersion = request.headers.get(apiVersionHeader)?.trim();
    if (requestedVersion && requestedVersion !== apiVersion) {
      return unsupportedApiVersionResponse();
    }
  }

  if (url.pathname === mcpPath) {
    return handleMcpRequest(request);
  }

  if (url.pathname === apiRootPath || url.pathname === `${apiRootPath}/`) {
    return apiErrorResponse(404);
  }

  if (url.pathname === apiCatalogPath) {
    const response = await fetchOrigin(request);
    return responseWithHeaders(response, (headers) => {
      headers.set(
        'Content-Type',
        'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
      );
      addPublicAgentHeaders(headers);
    });
  }

  if (url.pathname === ardCatalogPath) {
    const response = await fetchOrigin(request);
    return responseWithHeaders(response, (headers) => {
      headers.set('Content-Type', 'application/ai-catalog+json; charset=utf-8');
      addPublicAgentHeaders(headers);
    });
  }

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
          addDiscoveryLinks(headers);
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
  if (isApiPath(url.pathname) && response.status >= 400) {
    await response.body?.cancel();
    return apiErrorResponse(response.status);
  }

  if (
    response.status === 404 &&
    isSafeRead &&
    acceptsMarkdown(request.headers.get('accept'))
  ) {
    await response.body?.cancel();
    return markdownNotFoundResponse(request, url);
  }

  if (isAgentResource(url.pathname)) {
    return responseWithHeaders(response, (headers) => {
      if (isApiPath(url.pathname)) {
        addApiAgentHeaders(headers);
      } else {
        addPublicAgentHeaders(headers);
      }
    });
  }

  if (!markdownPath && url.pathname !== '/') {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('text/html')) {
      return response;
    }

    return responseWithHeaders(response, (headers) => {
      addPageAgentHeaders(headers);
    });
  }

  return responseWithHeaders(response, (headers) => {
    if (markdownPath) {
      appendVary(headers, 'Accept');
    }
    if (
      (response.headers.get('content-type') ?? '')
        .toLowerCase()
        .includes('text/html')
    ) {
      addPageAgentHeaders(headers);
    }
    if (url.pathname === '/') {
      addPageAgentHeaders(headers);
      addDiscoveryLinks(headers);
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
