const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBase(path: string): string {
  if (/^(?:[a-z]+:|#)/i.test(path)) {
    return path;
  }

  const normalized = `/${path.replace(/^\/+/, '')}`;
  return `${base}${normalized}` || '/';
}

export function slugifyTaxonomy(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-Hant')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}
