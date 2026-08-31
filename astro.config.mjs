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
import { TAXONOMY_TRANSLATIONS } from './src/i18n/config.ts';
import { slugifyTaxonomy } from './src/lib/taxonomy.ts';

const site = process.env.SITE_URL ?? PRODUCTION_SITE_URL;
const requestedBase = process.env.BASE_PATH ?? '/';
const base = requestedBase === '/' ? undefined : requestedBase;
const storyContentDirectory = fileURLToPath(
  new URL('./src/content/stories/', import.meta.url),
);
const notesContentDirectory = fileURLToPath(
  new URL('./src/content/notes/', import.meta.url),
);
const postTranslationsDirectory = fileURLToPath(
  new URL('./src/content/post-translations/en/', import.meta.url),
);
const storyTranslationsDirectory = fileURLToPath(
  new URL('./src/content/story-translations/en/', import.meta.url),
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
const englishStorySlugs = existsSync(storyTranslationsDirectory)
  ? readdirSync(storyTranslationsDirectory)
      .filter(
        (filename) => filename.endsWith('.md') || filename.endsWith('.mdx'),
      )
      .map((filename) => {
        const source = readFileSync(
          path.join(storyTranslationsDirectory, filename),
          'utf8',
        );
        const status = /^status:\s*published\s*$/mu.test(source);
        const slug = /^slug:\s*([^\s]+)\s*$/mu.exec(source)?.[1];
        return status && slug ? slug : null;
      })
      .filter((slug) => slug !== null)
  : [];
const publishedNoteSlugs = existsSync(notesContentDirectory)
  ? readdirSync(notesContentDirectory)
      .filter(
        (filename) => filename.endsWith('.md') || filename.endsWith('.mdx'),
      )
      .map((filename) => {
        const source = readFileSync(
          path.join(notesContentDirectory, filename),
          'utf8',
        );
        const status = /^editorialStatus:\s*published\s*$/mu.test(source);
        const slug = /^slug:\s*([^\s]+)\s*$/mu.exec(source)?.[1];
        return status && slug ? slug : null;
      })
      .filter((slug) => slug !== null)
  : [];
const publishedEnglishPostSlugs = existsSync(postTranslationsDirectory)
  ? readdirSync(postTranslationsDirectory)
      .filter(
        (filename) => filename.endsWith('.md') || filename.endsWith('.mdx'),
      )
      .map((filename) => {
        const source = readFileSync(
          path.join(postTranslationsDirectory, filename),
          'utf8',
        );
        const status = /^status:\s*published\s*$/mu.test(source);
        const slug = /^slug:\s*([^\s]+)\s*$/mu.exec(source)?.[1];
        return status && slug ? slug : null;
      })
      .filter((slug) => slug !== null)
  : [];
const normalizedBase =
  requestedBase === '/' ? '' : `/${requestedBase.replace(/^\/+|\/+$/g, '')}`;
const taxonomySitemapCounterparts = new Map();

for (const kind of ['categories', 'tags']) {
  for (const [sourceLabel, englishLabel] of Object.entries(
    TAXONOMY_TRANSLATIONS.en[kind],
  )) {
    const chinesePath = `/${kind}/${slugifyTaxonomy(sourceLabel)}.html`;
    const englishPath = `/en/${kind}/${slugifyTaxonomy(englishLabel)}.html`;
    const chineseUrl = new URL(
      `${normalizedBase}${chinesePath}`,
      `${site}/`,
    ).toString();
    const englishUrl = new URL(
      `${normalizedBase}${englishPath}`,
      `${site}/`,
    ).toString();
    const cluster = [
      { lang: 'zh-Hant', url: chineseUrl },
      { lang: 'en', url: englishUrl },
    ];
    taxonomySitemapCounterparts.set(new URL(chineseUrl).pathname, cluster);
    taxonomySitemapCounterparts.set(new URL(englishUrl).pathname, cluster);
  }
}

function storyDirectoryOutput() {
  return {
    name: 'story-directory-output',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const outputDirectory = fileURLToPath(dir);
        const englishHomeSource = path.join(outputDirectory, 'en.html');
        const englishHomeDirectory = path.join(outputDirectory, 'en');
        if (!existsSync(englishHomeSource)) {
          throw new Error(
            `Missing generated English homepage route: ${englishHomeSource}`,
          );
        }
        mkdirSync(englishHomeDirectory, { recursive: true });
        renameSync(
          englishHomeSource,
          path.join(englishHomeDirectory, 'index.html'),
        );

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

        for (const slug of englishStorySlugs) {
          const source = path.join(
            outputDirectory,
            'en',
            'web-stories',
            `${slug}.html`,
          );
          const destinationDirectory = path.join(
            outputDirectory,
            'en',
            'web-stories',
            slug,
          );
          if (!existsSync(source))
            throw new Error(`Missing generated English Story route: ${source}`);
          mkdirSync(destinationDirectory, { recursive: true });
          renameSync(source, path.join(destinationDirectory, 'index.html'));
        }
      },
    },
  };
}

function isPublishedNotePage(page) {
  const pathname = new URL(page).pathname;
  if (/\/notes(?:\.html)?$/u.test(pathname)) {
    return publishedNoteSlugs.length > 0;
  }
  const match = /\/notes\/([^/]+?)(?:\.html)?$/u.exec(pathname);
  return !match || publishedNoteSlugs.includes(match[1] ?? '');
}

const englishInterfaceSlugs = new Set([
  '404',
  'about',
  'articles',
  'categories',
  'contact',
  'developers',
  'membership',
  'notes',
  'privacy',
  'tags',
  'web-stories',
]);

function isPublishedEnglishPostPage(page) {
  const pathname = new URL(page).pathname;
  const match = /\/en\/([^/]+?)(?:\.html)?$/u.exec(pathname);
  if (!match) return true;
  const slug = match[1] ?? '';
  return (
    englishInterfaceSlugs.has(slug) || publishedEnglishPostSlugs.includes(slug)
  );
}

export default defineConfig({
  site,
  base,
  output: 'static',
  i18n: {
    defaultLocale: 'zh-hant',
    locales: ['zh-hant', 'en'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  prefetch: {
    defaultStrategy: 'hover',
    prefetchAll: false,
  },
  trailingSlash: 'ignore',
  build: {
    format: 'file',
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !new URL(page).pathname.endsWith('/404.html') &&
        isPublishedNotePage(page) &&
        isPublishedEnglishPostPage(page),
      i18n: {
        defaultLocale: 'zh-hant',
        locales: {
          'zh-hant': 'zh-Hant',
          en: 'en',
        },
      },
      serialize(item) {
        const canonicalSitemapUrl = (value) => {
          const url = new URL(value);
          const withoutBase =
            normalizedBase && url.pathname.startsWith(normalizedBase)
              ? url.pathname.slice(normalizedBase.length)
              : url.pathname;
          const routePath = withoutBase.replace(/\/+$/, '') || '/';
          const storySlug = storySlugs.find(
            (slug) => routePath === `/web-stories/${slug}`,
          );
          const englishStorySlug = englishStorySlugs.find(
            (slug) => routePath === `/en/web-stories/${slug}`,
          );

          if (routePath === '/en') {
            url.pathname = `${normalizedBase}/en/`;
          } else if (storySlug) {
            url.pathname = `${normalizedBase}/web-stories/${storySlug}/`;
          } else if (englishStorySlug) {
            url.pathname = `${normalizedBase}/en/web-stories/${englishStorySlug}/`;
          } else if (routePath !== '/' && !path.posix.extname(routePath)) {
            url.pathname = `${normalizedBase}${routePath}.html`;
          }

          return url.toString();
        };
        const url = new URL(canonicalSitemapUrl(item.url));
        const taxonomyLinks = taxonomySitemapCounterparts.get(url.pathname);

        return {
          ...item,
          url: url.toString(),
          links:
            taxonomyLinks ??
            item.links?.map((link) => ({
              ...link,
              url: canonicalSitemapUrl(link.url),
            })),
        };
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
