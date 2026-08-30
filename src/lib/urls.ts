const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

export { slugifyTaxonomy } from './taxonomy';

export function withBase(path: string): string {
  if (/^(?:[a-z]+:|#)/i.test(path)) {
    return path;
  }

  const normalized = `/${path.replace(/^\/+/, '')}`;
  return `${base}${normalized}` || '/';
}

export function markdownPathForCanonical(path: string): string {
  const suffixIndex = path.search(/[?#]/u);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : path.slice(suffixIndex);
  if (!pathname.startsWith('/')) {
    throw new Error(`Canonical path must start with a slash: ${path}`);
  }

  if (pathname.endsWith('/')) {
    return `${pathname}index.md${suffix}`;
  }

  if (pathname.endsWith('.html')) {
    return `${pathname.slice(0, -'.html'.length)}.md${suffix}`;
  }

  return `${pathname}.md${suffix}`;
}
