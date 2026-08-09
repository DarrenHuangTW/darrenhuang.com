import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MigrationOptions {
  repoRoot: string;
  internalHosts: string[];
  latestDatabasePath: string;
  memberDatabasePath: string;
  uploadsArchivePath: string;
  wxrPath: string;
  legacyRepoPath?: string;
}

const FLAG_TO_ENV = {
  '--latest-db': 'MIGRATION_LIGHTSAIL_DB',
  '--member-db': 'MIGRATION_MEMBER_DB',
  '--uploads-archive': 'MIGRATION_UPLOADS_ARCHIVE',
  '--wxr': 'MIGRATION_WXR',
  '--legacy-repo': 'MIGRATION_LEGACY_REPO',
} as const;

const INTERNAL_HOSTS_FLAG = '--internal-hosts';
const INTERNAL_HOSTS_ENV = 'MIGRATION_INTERNAL_HOSTS';

function readFlags(argv: string[]): Map<string, string> {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith('--'))
      throw new Error(`Unexpected positional argument: ${argument}`);

    const equalsAt = argument.indexOf('=');
    if (equalsAt > 0) {
      values.set(argument.slice(0, equalsAt), argument.slice(equalsAt + 1));
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${argument}`);
    values.set(argument, value);
    index += 1;
  }

  return values;
}

function resolveRequiredInput(
  flagValues: Map<string, string>,
  flag: keyof typeof FLAG_TO_ENV,
  repoRoot: string,
  required = true,
): string | undefined {
  const envName = FLAG_TO_ENV[flag];
  const configured = flagValues.get(flag) ?? process.env[envName];

  if (!configured) {
    if (!required) return undefined;
    throw new Error(`Missing ${flag}. Provide the flag or ${envName}.`);
  }

  const resolved = path.resolve(configured);
  if (!existsSync(resolved))
    throw new Error(`Input for ${flag} does not exist: ${resolved}`);
  const canonical = realpathSync(resolved);
  const canonicalRepo = realpathSync(repoRoot);

  if (
    canonical === canonicalRepo ||
    canonical.startsWith(`${canonicalRepo}${path.sep}`)
  ) {
    throw new Error(
      `${flag} must point outside the public repository: ${canonical}`,
    );
  }

  return canonical;
}

export function parseMigrationOptions(
  argv = process.argv.slice(2),
): MigrationOptions {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDirectory, '..', '..');
  const flags = readFlags(argv);
  const knownFlags = new Set([
    ...Object.keys(FLAG_TO_ENV),
    INTERNAL_HOSTS_FLAG,
  ]);

  for (const flag of flags.keys()) {
    if (!knownFlags.has(flag))
      throw new Error(`Unknown importer option: ${flag}`);
  }

  return {
    repoRoot,
    internalHosts: parseInternalHosts(
      flags.get(INTERNAL_HOSTS_FLAG) ?? process.env[INTERNAL_HOSTS_ENV] ?? '',
    ),
    latestDatabasePath: resolveRequiredInput(flags, '--latest-db', repoRoot)!,
    memberDatabasePath: resolveRequiredInput(flags, '--member-db', repoRoot)!,
    uploadsArchivePath: resolveRequiredInput(
      flags,
      '--uploads-archive',
      repoRoot,
    )!,
    wxrPath: resolveRequiredInput(flags, '--wxr', repoRoot)!,
    legacyRepoPath: resolveRequiredInput(
      flags,
      '--legacy-repo',
      repoRoot,
      false,
    ),
  };
}

function parseInternalHosts(value: string): string[] {
  const hosts = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let parsed: URL;

      try {
        parsed = new URL(
          /^[a-z][a-z\d+.-]*:\/\//i.test(entry) ? entry : `https://${entry}`,
        );
      } catch {
        throw new Error(
          `${INTERNAL_HOSTS_FLAG} contains an invalid host entry.`,
        );
      }

      if (
        parsed.username !== '' ||
        parsed.password !== '' ||
        parsed.port !== '' ||
        (parsed.pathname !== '' && parsed.pathname !== '/') ||
        parsed.search !== '' ||
        parsed.hash !== ''
      ) {
        throw new Error(
          `${INTERNAL_HOSTS_FLAG} accepts hostnames or IP addresses only.`,
        );
      }

      return parsed.hostname.toLowerCase();
    });

  return [...new Set(hosts)];
}
