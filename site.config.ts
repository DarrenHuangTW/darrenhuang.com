export const PRODUCTION_SITE_URL = 'https://www.darrenhuang.com';

export function productionSiteUrl(pathname = '/'): URL {
  return new URL(pathname, `${PRODUCTION_SITE_URL}/`);
}
