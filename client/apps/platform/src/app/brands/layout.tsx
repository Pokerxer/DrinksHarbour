import type { Metadata } from 'next';

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

export const metadata: Metadata = {
  title: 'Shop by Brand — Premium Drinks Brands in Nigeria',
  description:
    'Browse all premium drinks brands available on DrinksHarbour — Hennessy, Johnnie Walker, Glenfiddich, Moët & Chandon, Ciroc and more. Authentic products delivered across Nigeria.',
  keywords: [
    'drinks brands Nigeria',
    'buy Hennessy Nigeria',
    'buy Johnnie Walker Nigeria',
    'buy Glenfiddich Nigeria',
    'premium spirits brands Nigeria',
    'alcohol brands Nigeria',
    'wine brands Nigeria',
    'DrinksHarbour brands',
  ],
  alternates: { canonical: `${BASE_URL}/brands` },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/brands`,
    siteName: SITE_NAME,
    title: 'Shop by Brand — Premium Drinks Brands in Nigeria | DrinksHarbour',
    description:
      'Browse all premium drinks brands on DrinksHarbour. Hennessy, Glenfiddich, Moët & Chandon, Ciroc and hundreds more — authentic, fast delivery nationwide.',
    images: [{ url: '/images/logo.png', width: 1200, height: 630, alt: 'DrinksHarbour — Shop by Brand' }],
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@drinksharbour',
    title: 'Shop by Brand — Premium Drinks Brands in Nigeria | DrinksHarbour',
    description:
      'Browse all premium drinks brands on DrinksHarbour. Authentic products with fast delivery across Nigeria.',
    images: ['/images/logo.png'],
  },
};

const brandsJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Shop by Brand — DrinksHarbour',
  description: 'Browse premium drinks brands available on DrinksHarbour — Nigeria\'s premier online beverage store.',
  url: `${BASE_URL}/brands`,
  provider: {
    '@type': 'Organization',
    name: SITE_NAME,
    url: BASE_URL,
  },
  inLanguage: 'en-NG',
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',   item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Brands', item: `${BASE_URL}/brands` },
  ],
};

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(brandsJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
