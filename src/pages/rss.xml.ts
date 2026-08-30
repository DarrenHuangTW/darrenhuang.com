import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import {
  getPostsNewestFirst,
  getPublishedNotesNewestFirst,
} from '@/lib/content';
import { withBase } from '@/lib/urls';
import { productionSiteUrl } from '../../site.config';

export const GET: APIRoute = async (context) => {
  const posts = await getPostsNewestFirst();
  const notes = await getPublishedNotesNewestFirst();
  const site = new URL(withBase('/'), context.site ?? productionSiteUrl());
  const items = [
    ...posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.publishedAt,
      link: withBase(post.data.canonicalPath),
    })),
    ...notes.map((note) => ({
      title: note.data.title,
      description: note.data.excerpt,
      pubDate: note.data.publishedAt,
      link: withBase(note.data.canonicalPath),
    })),
  ].toSorted((left, right) => right.pubDate.getTime() - left.pubDate.getTime());

  return rss({
    title: '數位引擎 by Darren Huang',
    description: '數位行銷、SEO、內容策略與科技趨勢的長期觀察。',
    site,
    items,
    customData: '<language>zh-TW</language>',
  });
};
