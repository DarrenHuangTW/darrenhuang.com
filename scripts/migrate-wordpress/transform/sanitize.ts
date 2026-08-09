import sanitizeHtml from 'sanitize-html';

const lengthPattern = /^-?\d+(?:\.\d+)?(?:%|ch|em|px|rem|vh|vw)?$/;
const colorPattern =
  /^(?:#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i;
const removedCredentialQueryParameters = new Set([
  'access_token',
  'auth_token',
  'awsaccesskeyid',
  'bearer_token',
  'client_secret',
  'key-pair-id',
  'policy',
  'refresh_token',
  'secret',
  'signature',
  'token',
  'x-amz-credential',
  'x-amz-security-token',
  'x-amz-signature',
]);
const removedCapabilityQueryParameters = new Set([
  'accesskey',
  'capability',
  'capabilitykey',
  'capabilitytoken',
  'downloadkey',
  'downloadtoken',
  'invitationtoken',
  'invitetoken',
  'magiclinktoken',
  'notekey',
  'sharekey',
  'sharetoken',
  'signedtoken',
]);
const apiKeyNamePattern = 'api[_-]?key';
const credentialNamePattern =
  'access[_-]?token|auth[_-]?token|awsaccesskeyid|bearer[_-]?token|client[_-]?secret|key-pair-id|policy|refresh[_-]?token|secret|signature|token|x-amz-credential|x-amz-security-token|x-amz-signature';
const capabilityNamePattern =
  'access[_-]?key|capability(?:[_-]?(?:key|token))?|download[_-]?(?:key|token)|invitation[_-]?token|invite[_-]?token|magic[_-]?link[_-]?token|note[_-]?key|share[_-]?(?:key|token)|signed[_-]?token';

export function redactPublicCredentialValues(value: string): string {
  return redactCredentialAssignments(
    redactCredentialAssignments(
      redactCredentialAssignments(value, apiKeyNamePattern, 20),
      capabilityNamePattern,
      12,
    ),
    credentialNamePattern,
    12,
  );
}

function redactCredentialAssignments(
  value: string,
  namePattern: string,
  minimumLength: number,
): string {
  const unquotedKey = new RegExp(
    `(\\b(?:${namePattern})\\s*(?:=|:)\\s*)(["']?)([^&\\s<>"']{${minimumLength},})\\2`,
    'gi',
  );
  const quotedKey = new RegExp(
    `(["'])((?:${namePattern}))\\1(\\s*:\\s*)(["'])([^"']{${minimumLength},})\\4`,
    'gi',
  );

  return value
    .replace(unquotedKey, '$1$2REDACTED$2')
    .replace(quotedKey, '$1$2$1$3$4REDACTED$4');
}

export function sanitizePublicUrl(value: string): string {
  const protocolRelative = value.startsWith('//');
  const candidate = protocolRelative ? `https:${value}` : value;
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    return sanitizeRelativePublicUrl(value);
  }

  let changed = false;
  if (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    (parsed.username !== '' || parsed.password !== '')
  ) {
    parsed.username = '';
    parsed.password = '';
    changed = true;
  }

  const pathname = redactPublicCredentialValues(parsed.pathname);
  if (pathname !== parsed.pathname) {
    parsed.pathname = pathname;
    changed = true;
  }

  const hash = redactPublicCredentialValues(parsed.hash);
  if (hash !== parsed.hash) {
    parsed.hash = hash;
    changed = true;
  }

  for (const key of [...parsed.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    const parameterValue = parsed.searchParams.get(key) ?? '';

    if (shouldRemoveQueryParameter(normalizedKey)) {
      parsed.searchParams.delete(key);
      changed = true;
      continue;
    }

    if (
      /^api[_-]?key$/i.test(key) &&
      parameterValue.length >= 20 &&
      parameterValue !== 'REDACTED'
    ) {
      parsed.searchParams.set(key, 'REDACTED');
      changed = true;
      continue;
    }

    const redactedParameterValue = redactPublicCredentialValues(parameterValue);
    if (redactedParameterValue !== parameterValue) {
      parsed.searchParams.set(key, redactedParameterValue);
      changed = true;
    }
  }

  if (!changed) {
    return redactPublicCredentialValues(value);
  }

  const sanitized = parsed.toString();
  return protocolRelative ? sanitized.replace(/^https:/, '') : sanitized;
}

function sanitizeRelativePublicUrl(value: string): string {
  const queryIndex = value.indexOf('?');
  if (queryIndex < 0) {
    return redactPublicCredentialValues(value);
  }

  const hashIndex = value.indexOf('#', queryIndex);
  const prefix = value.slice(0, queryIndex);
  const query = value.slice(
    queryIndex + 1,
    hashIndex < 0 ? undefined : hashIndex,
  );
  const hash = hashIndex < 0 ? '' : value.slice(hashIndex);
  const separator = /&amp;/i.test(query) ? '&amp;' : '&';
  const parameters = query.split(/&(?:amp;)?/i);
  const sanitized: string[] = [];
  let changed = false;

  for (const parameter of parameters) {
    const equalsIndex = parameter.indexOf('=');
    const rawKey =
      equalsIndex < 0 ? parameter : parameter.slice(0, equalsIndex);
    const rawValue = equalsIndex < 0 ? '' : parameter.slice(equalsIndex + 1);
    const normalizedKey = safelyDecodeQueryComponent(rawKey).toLowerCase();
    const parameterValue = safelyDecodeQueryComponent(rawValue);

    if (shouldRemoveQueryParameter(normalizedKey)) {
      changed = true;
      continue;
    }

    if (
      /^api[_-]?key$/i.test(normalizedKey) &&
      parameterValue.length >= 20 &&
      parameterValue !== 'REDACTED'
    ) {
      sanitized.push(`${rawKey}=REDACTED`);
      changed = true;
      continue;
    }

    const redactedParameter = redactPublicCredentialValues(parameter);
    sanitized.push(redactedParameter);
    changed ||= redactedParameter !== parameter;
  }

  if (!changed) {
    return redactPublicCredentialValues(value);
  }

  return `${redactPublicCredentialValues(prefix)}${sanitized.length > 0 ? `?${sanitized.join(separator)}` : ''}${redactPublicCredentialValues(hash)}`;
}

function shouldRemoveQueryParameter(value: string): boolean {
  const normalized = safelyDecodeQueryComponent(value).toLowerCase();
  const compact = normalized.replace(/[-_]/g, '');

  return (
    removedCredentialQueryParameters.has(normalized) ||
    removedCapabilityQueryParameters.has(compact)
  );
}

function safelyDecodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll('+', ' '));
  } catch {
    return value;
  }
}

export function sanitizeTransformedHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'aside',
      'audio',
      'details',
      'figcaption',
      'figure',
      'iframe',
      'img',
      'picture',
      'source',
      'summary',
      'video',
    ],
    allowedAttributes: {
      '*': [
        'aria-*',
        'class',
        'data-*',
        'dir',
        'id',
        'lang',
        'role',
        'style',
        'title',
      ],
      a: ['href', 'rel', 'target'],
      audio: ['autoplay', 'controls', 'loop', 'muted', 'preload', 'src'],
      details: ['open'],
      iframe: [
        'allow',
        'allowfullscreen',
        'height',
        'loading',
        'referrerpolicy',
        'src',
        'title',
        'width',
      ],
      img: [
        'alt',
        'decoding',
        'height',
        'loading',
        'sizes',
        'src',
        'srcset',
        'width',
      ],
      li: ['value'],
      ol: ['reversed', 'start', 'type'],
      source: ['media', 'sizes', 'src', 'srcset', 'type'],
      table: ['summary'],
      td: ['colspan', 'headers', 'rowspan'],
      th: ['abbr', 'colspan', 'headers', 'rowspan', 'scope'],
      time: ['datetime'],
      video: [
        'autoplay',
        'controls',
        'height',
        'loop',
        'muted',
        'playsinline',
        'poster',
        'preload',
        'src',
        'width',
      ],
    },
    allowedIframeHostnames: ['open.spotify.com', 'www.youtube-nocookie.com'],
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['cite', 'href', 'poster', 'src'],
    allowedStyles: {
      '*': {
        'background-color': [colorPattern],
        'border-color': [colorPattern],
        'border-style': [/^(?:dashed|dotted|double|none|solid)$/],
        'border-width': [lengthPattern],
        color: [colorPattern],
        gap: [lengthPattern],
        height: [lengthPattern, /^auto$/],
        'margin-bottom': [lengthPattern, /^auto$/],
        'margin-left': [lengthPattern, /^auto$/],
        'margin-right': [lengthPattern, /^auto$/],
        'margin-top': [lengthPattern, /^auto$/],
        'max-height': [lengthPattern, /^none$/],
        'max-width': [lengthPattern, /^none$/],
        'min-height': [lengthPattern],
        'min-width': [lengthPattern],
        opacity: [/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/],
        'padding-bottom': [lengthPattern],
        'padding-left': [lengthPattern],
        'padding-right': [lengthPattern],
        'padding-top': [lengthPattern],
        'text-align': [/^(?:center|end|justify|left|right|start)$/],
        width: [lengthPattern, /^auto$/],
      },
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    nonTextTags: ['iframe', 'noscript', 'script', 'style', 'textarea', 'title'],
  });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
