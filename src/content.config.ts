import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const auditFields = {
  wpId: z.number().int().positive(),
  slug: z
    .string()
    .min(1)
    .regex(/^[^/]+$/),
  canonicalPath: z.string().regex(/^\/[^/]+\.html$/),
  aliases: z.array(z.string()).default([]),
  originalStatus: z.enum(['publish', 'private', 'draft']),
  sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
};

const featuredMedia = z
  .object({
    src: z.string().startsWith('/'),
    alt: z.string().default(''),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .nullable()
  .default(null);

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...auditFields,
    title: z.string().min(1),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    excerpt: z.string().default(''),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    featuredMedia,
    wasMembersOnly: z.boolean(),
  }),
});

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...auditFields,
    title: z.string().min(1),
    updatedAt: z.coerce.date(),
    excerpt: z.string().default(''),
    pageKind: z.enum(['about', 'historical', 'landing']),
    featuredMedia,
  }),
});

const stories = defineCollection({
  loader: glob({ base: './src/content/stories', pattern: '**/*.{json,md}' }),
  schema: z.object({
    slug: z
      .string()
      .min(1)
      .regex(/^[^/]+$/),
    title: z.string().min(1),
    canonicalPath: z.string().regex(/^\/web-stories\/[^/]+\/$/),
    aliases: z.array(z.string()).default([]),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    excerpt: z.string().default(''),
    poster: z.string().startsWith('/').nullable().default(null),
    modernWpId: z.number().int().positive(),
    legacyWpId: z.number().int().positive(),
    modernPageCount: z.number().int().positive(),
    legacyPageCount: z.number().int().positive(),
    ampSourcePath: z.string().regex(/^\/web-stories\/[^/]+\/story\.html$/),
    transcript: z.array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().positive(),
        lines: z.array(z.string()).default([]),
      }),
    ),
    legacyComparison: z.object({
      decision: z.string().min(1),
      notes: z.array(z.string()).default([]),
      omittedAssets: z.array(z.string()).default([]),
    }),
    sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    artifactChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});

export const collections = { pages, posts, stories };
