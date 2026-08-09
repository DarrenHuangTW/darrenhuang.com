import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

export async function getPostsNewestFirst(): Promise<
  CollectionEntry<'posts'>[]
> {
  const posts = await getCollection('posts');

  return posts.toSorted(
    (left, right) =>
      right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'long',
    timeZone: 'Asia/Taipei',
  }).format(date);
}
