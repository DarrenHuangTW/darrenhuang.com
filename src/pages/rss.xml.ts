import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPostsNewestFirst } from '@/lib/content';
import { withBase } from '@/lib/urls';

export const GET: APIRoute = async (context) => {
  const posts = await getPostsNewestFirst();

  return rss({
    title: '數位引擎',
    description: '數位行銷、SEO、內容策略與科技趨勢的長期觀察。',
    site: context.site ?? 'https://darrenhuang.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.publishedAt,
      link: withBase(post.data.canonicalPath),
    })),
    customData: '<language>zh-TW</language>',
  });
};
