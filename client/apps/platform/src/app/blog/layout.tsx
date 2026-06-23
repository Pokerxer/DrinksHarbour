import type { Metadata } from 'next';

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

export const metadata: Metadata = {
  title: 'Blog — Drinks Guides, Recipes & Lifestyle',
  description:
    'Expert drink guides, cocktail recipes, tasting notes, and lifestyle articles from Nigeria\'s premier beverage store. Explore wines, whiskies, spirits, and more.',
  keywords: [
    'drinks blog Nigeria', 'whisky tasting notes', 'cocktail recipes Nigeria',
    'wine guide Nigeria', 'spirits guide Africa', 'how to drink whisky',
    'best wines Nigeria', 'DrinksHarbour blog',
  ],
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/blog`,
    siteName: SITE_NAME,
    title: 'Blog — Drinks Guides, Recipes & Lifestyle | DrinksHarbour',
    description:
      'Expert drink guides, cocktail recipes, tasting notes, and lifestyle articles from Nigeria\'s premier beverage store.',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'DrinksHarbour Blog' }],
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@DrinkHarbour',
    title: 'Blog — Drinks Guides, Recipes & Lifestyle | DrinksHarbour',
    description: 'Expert drink guides, cocktail recipes, tasting notes and lifestyle content.',
    images: ['/og-default.jpg'],
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
