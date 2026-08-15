import { PRODUCTION_SITE_URL } from '../../site.config.js';

type ScanProfile = 'all' | 'apiApp' | 'content';

interface CliOptions {
  profile: ScanProfile;
  url: string;
}

interface JsonRpcResponse {
  error?: { code?: number; message?: string };
  result?: {
    content?: Array<{ text?: string; type?: string }>;
  };
}

const endpoint = 'https://isitagentready.com/mcp';

function usage(): string {
  return [
    'Usage: npm run audit:agent-readiness -- [url] [profile]',
    '       npx tsx scripts/audit/agent-readiness.ts [options]',
    '',
    'Options:',
    `  --url <url>          Site to scan (default: ${PRODUCTION_SITE_URL})`,
    '  --profile <profile>  content, all, or apiApp (default: content)',
    '  --help               Show this help',
  ].join('\n');
}

function nextValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function parseOptions(args: string[]): CliOptions | undefined {
  let url = PRODUCTION_SITE_URL;
  let profile: ScanProfile = 'content';
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') {
      return undefined;
    }

    if (argument === '--url') {
      url = nextValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument?.startsWith('--url=')) {
      url = argument.slice('--url='.length);
      continue;
    }

    if (argument === '--profile') {
      profile = nextValue(args, index, argument) as ScanProfile;
      index += 1;
      continue;
    }

    if (argument?.startsWith('--profile=')) {
      profile = argument.slice('--profile='.length) as ScanProfile;
      continue;
    }

    if (argument && !argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }

    throw new Error(`Unknown option: ${argument ?? ''}`);
  }

  if (positional.length > 2) {
    throw new Error('Expected at most a URL and a profile.');
  }

  if (positional[0]) {
    url = positional[0];
  }

  if (positional[1]) {
    profile = positional[1] as ScanProfile;
  }

  if (!['all', 'apiApp', 'content'].includes(profile)) {
    throw new Error(`Unsupported profile: ${profile}`);
  }

  const parsedUrl = new URL(url);
  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('The scan URL must be an HTTP(S) URL without credentials.');
  }

  return { profile, url: parsedUrl.toString() };
}

function parseSse(source: string): JsonRpcResponse[] {
  const responses: JsonRpcResponse[] = [];

  for (const block of source.split(/\r?\n\r?\n/u)) {
    const data = block
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart())
      .join('\n');
    if (!data) {
      continue;
    }

    responses.push(JSON.parse(data) as JsonRpcResponse);
  }

  return responses;
}

async function scan(options: CliOptions): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'scan_site',
        arguments: options,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const source = await response.text();
  if (!response.ok) {
    throw new Error(
      `Agent Readiness endpoint returned ${response.status}: ${source.slice(0, 500)}`,
    );
  }

  const rpc = parseSse(source).at(-1);
  if (!rpc) {
    throw new Error('Agent Readiness endpoint returned no MCP message.');
  }

  if (rpc.error) {
    throw new Error(
      `MCP ${rpc.error.code ?? 'error'}: ${rpc.error.message ?? 'unknown error'}`,
    );
  }

  const report = rpc.result?.content?.find(
    (item) => item.type === 'text' && typeof item.text === 'string',
  )?.text;
  if (!report) {
    throw new Error('Agent Readiness MCP response did not contain a report.');
  }

  return report;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    console.log(usage());
    return;
  }

  console.log(await scan(options));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[audit:agent-readiness] FAILED: ${message}`);
  process.exitCode = 1;
});
