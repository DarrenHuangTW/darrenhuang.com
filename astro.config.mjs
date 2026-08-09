import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { PRODUCTION_SITE_URL } from './site.config.ts';

const site = process.env.SITE_URL ?? PRODUCTION_SITE_URL;
const requestedBase = process.env.BASE_PATH ?? '/';
const base = requestedBase === '/' ? undefined : requestedBase;
const storyContentDirectory = fileURLToPath(
  new URL('./src/content/stories/', import.meta.url),
);
const storySlugs = existsSync(storyContentDirectory)
  ? readdirSync(storyContentDirectory)
      .filter((filename) => filename.endsWith('.json'))
      .map(
        (filename) =>
          JSON.parse(
            readFileSync(path.join(storyContentDirectory, filename), 'utf8'),
          ).slug,
      )
      .filter((slug) => typeof slug === 'string' && slug.length > 0)
  : [];
const normalizedBase =
  requestedBase === '/' ? '' : `/${requestedBase.replace(/^\/+|\/+$/g, '')}`;

function storyDirectoryOutput() {
  return {
    name: 'story-directory-output',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const outputDirectory = fileURLToPath(dir);
        for (const slug of storySlugs) {
          const source = path.join(
            outputDirectory,
            'web-stories',
            `${slug}.html`,
          );
          const destinationDirectory = path.join(
            outputDirectory,
            'web-stories',
            slug,
          );
          if (!existsSync(source))
            throw new Error(`Missing generated Story route: ${source}`);
          mkdirSync(destinationDirectory, { recursive: true });
          renameSync(source, path.join(destinationDirectory, 'index.html'));
        }
      },
    },
  };
}

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'file',
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !new URL(page).pathname.endsWith('/404.html'),
      serialize(item) {
        const url = new URL(item.url);
        const withoutBase =
          normalizedBase && url.pathname.startsWith(normalizedBase)
            ? url.pathname.slice(normalizedBase.length)
            : url.pathname;
        const routePath = withoutBase.replace(/\/+$/, '') || '/';
        const storySlug = storySlugs.find(
          (slug) => routePath === `/web-stories/${slug}`,
        );

        if (storySlug) {
          url.pathname = `${normalizedBase}/web-stories/${storySlug}/`;
        } else if (routePath !== '/' && !path.posix.extname(routePath)) {
          url.pathname = `${normalizedBase}${routePath}.html`;
        }

        return { ...item, url: url.toString() };
      },
    }),
    storyDirectoryOutput(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
