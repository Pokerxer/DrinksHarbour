export type Category =
  | 'all'
  | 'Wine Guide'
  | 'Spirits Guide'
  | 'Beer Guide'
  | 'Recipes'
  | 'Entertaining'
  | 'Lifestyle';

export interface ContentBlock {
  type: 'p' | 'h2' | 'h3' | 'ul' | 'ol' | 'quote' | 'tip';
  text?: string;
  items?: string[];
}

export interface Post {
  id: string;
  title: string;
  excerpt: string;
  category: Exclude<Category, 'all'>;
  date: string;
  isoDate: string;
  readTime: string;
  image: string;
  imageAlt?: string;
  slug: string;
  featured?: boolean;
  tags: string[];
  author: { name: string; role: string; bio: string };
  content: ContentBlock[];
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Wine Guide':    'bg-purple-100 text-purple-700',
  'Spirits Guide': 'bg-amber-100  text-amber-700',
  'Beer Guide':    'bg-yellow-100 text-yellow-700',
  'Recipes':       'bg-orange-100 text-orange-700',
  'Entertaining':  'bg-pink-100   text-pink-700',
  'Lifestyle':     'bg-teal-100   text-teal-700',
};
