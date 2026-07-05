import type { Metadata } from 'next';
import { POSTS } from './data';

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

export const metadata: Metadata = {
  title: 'Blog — Drinks Guides, Recipes & Lifestyle',
  description:
    'Expert drink guides, cocktail recipes, tasting notes, and lifestyle articles from Nigeria\'s premier beverage store. Explore wines, whiskies, spirits, and more.',
  keywords: [
    'drinks blog Nigeria', 'whisky tasting notes', 'cocktail recipes Nigeria',
    'wine guide Nigeria', 'spirits guide Africa', 'how to drink whisky',
    'best wines Nigeria', 'DrinksHarbour blog', 'Nigerian drinks blog',
    'buy wine online Nigeria', 'beer styles guide', 'lagos cocktail recipes',
  ],
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${BASE_URL}/blog`,
    languages: { 'en-NG': `${BASE_URL}/blog` },
  },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/blog`,
    siteName: SITE_NAME,
    title: 'Blog — Drinks Guides, Recipes & Lifestyle | DrinksHarbour',
    description:
      'Expert drink guides, cocktail recipes, tasting notes, and lifestyle articles from Nigeria\'s premier beverage store.',
    images: [{
      url: 'https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=1200&q=80',
      width: 1200,
      height: 630,
      alt: 'DrinksHarbour Blog — drink guides, cocktail recipes, tasting notes',
    }],
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@DrinkHarbour',
    title: 'Blog — Drinks Guides, Recipes & Lifestyle | DrinksHarbour',
    description: 'Expert drink guides, cocktail recipes, tasting notes and lifestyle content.',
    images: ['https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=1200&q=80'],
  },
};

const blogJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'DrinksHarbour Blog',
  description: 'Drink guides, cocktail recipes, tasting notes, and lifestyle content from Nigeria\'s premier beverage store.',
  url: `${BASE_URL}/blog`,
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` },
  },
  inLanguage: 'en-NG',
  blogPost: POSTS.map(p => ({
    '@type': 'BlogPosting',
    headline: p.title,
    url: `${BASE_URL}/blog/${p.slug}`,
    datePublished: p.isoDate,
    author: { '@type': 'Person', name: p.author.name },
  })),
};

const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: POSTS.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${BASE_URL}/blog/${p.slug}`,
  })),
  numberOfItems: POSTS.length,
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
  ],
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://images.unsplash.com" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      {children}
    </>
  );
}
