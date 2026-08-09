import type { APIRoute } from 'astro';
import { withBase } from '@/lib/urls';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://darrenhuang.com');
  const sitemap = new URL(withBase('/sitemap-index.xml'), origin);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
