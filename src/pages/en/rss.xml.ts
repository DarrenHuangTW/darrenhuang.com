import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getLocalizedPostsNewestFirst } from '@/lib/localized-content';
import { withBase } from '@/lib/urls';
import { productionSiteUrl } from '../../../site.config';

export const GET: APIRoute = async (context) => {
  const posts = await getLocalizedPostsNewestFirst('en');
  const site = new URL(withBase('/en/'), context.site ?? productionSiteUrl());

  return rss({
    title: 'Digital Engine by Darren Huang',
    description:
      'Personal notes on SEO, AI, content strategy, and technology from Darren Huang.',
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.publishedAt,
      link: withBase(post.data.canonicalPath),
    })),
    customData: '<language>en-US</language>',
  });
};
