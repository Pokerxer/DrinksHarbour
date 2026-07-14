import { Suspense } from 'react';
import BlogIndexClient from './BlogIndexClient';
import { getPosts } from './api';

export const revalidate = 300;

export default async function BlogPage() {
  const posts = await getPosts();
  return (
    <Suspense>
      <BlogIndexClient posts={posts} />
    </Suspense>
  );
}
