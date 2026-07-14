import type { Post } from './data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function mapPost(raw: any): Post {
  const iso = raw.publishedAt || raw.createdAt || new Date().toISOString();
  return {
    id: String(raw._id),
    title: raw.title,
    excerpt: raw.excerpt || '',
    category: raw.category,
    date: new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    isoDate: String(new Date(iso).toISOString()).slice(0, 10),
    readTime: raw.readTime || '1 min read',
    image: raw.image || 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80',
    imageAlt: raw.imageAlt || '',
    slug: raw.slug,
    featured: Boolean(raw.featured),
    tags: raw.tags || [],
    author: raw.author || { name: '', role: '', bio: '' },
    content: raw.content || [],
    seo: raw.seo || {},
  };
}

export async function getPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE}/api/blog?limit=100`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).map(mapPost);
  } catch {
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/slug/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return mapPost(await res.json());
  } catch {
    return null;
  }
}
