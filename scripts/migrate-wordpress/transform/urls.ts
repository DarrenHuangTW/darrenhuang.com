const DEFAULT_INTERNAL_HOSTS = [
  '127.0.0.1',
  'darrenhuang.com',
  'localhost',
  'member.darrenhuang.com',
  'www.darrenhuang.com',
];

export function getInternalHosts(additionalHosts: string[] = []): Set<string> {
  return new Set(
    [...DEFAULT_INTERNAL_HOSTS, ...additionalHosts].map((host) =>
      host.trim().toLowerCase(),
    ),
  );
}

export function isExternalUrl(
  value: string,
  internalHosts: Set<string>,
): boolean {
  const parsed = parseHttpUrl(value);

  return parsed !== null && !internalHosts.has(parsed.hostname.toLowerCase());
}

export function rewriteWordPressUrl(
  rawValue: string,
  additionalInternalHosts: string[] = [],
): string {
  const value = rawValue.trim();

  if (value === '') {
    return value;
  }

  const parsed = parseHttpUrl(value);

  if (parsed === null) {
    return value;
  }

  const internalHosts = getInternalHosts(additionalInternalHosts);

  if (!internalHosts.has(parsed.hostname.toLowerCase())) {
    return value.startsWith('//') ? `https:${value}` : value;
  }

  const uploadMarker = '/wp-content/uploads/';
  const markerIndex = parsed.pathname.indexOf(uploadMarker);
  const pathname =
    markerIndex >= 0
      ? parsed.pathname.slice(markerIndex)
      : parsed.pathname || '/';

  return `${pathname}${parsed.search}${parsed.hash}`;
}

export function replacePrivateOriginLiterals(
  value: string,
  privateHosts: string[] = [],
): string {
  return privateHosts.reduce((current, host) => {
    const normalized = host.trim();
    if (normalized === '') {
      return current;
    }

    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return current
      .replace(
        new RegExp(`https?:\\/\\/${escaped}(?=[:/\\s<>"'])`, 'gi'),
        'https://darrenhuang.com',
      )
      .replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'darrenhuang.com');
  }, value);
}

export function toAbsoluteUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, ensureTrailingSlash(baseUrl)).toString();
  } catch {
    return value;
  }
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function parseHttpUrl(value: string): URL | null {
  const candidate = value.startsWith('//') ? `https:${value}` : value;

  try {
    const parsed = new URL(candidate);

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed
      : null;
  } catch {
    return null;
  }
}
