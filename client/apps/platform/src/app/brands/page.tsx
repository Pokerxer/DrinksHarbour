import type { Metadata } from 'next';
import BrandsBrowser from './BrandsBrowser';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';
const PAGE_URL = `${BASE_URL}/brands`;

// Force dynamic — the root layout resolves the tenant via headers(). Brand data
// is still cached through the Next.js fetch cache (revalidate below).
export const dynamic = 'force-dynamic';

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
  alternates: {
    canonical: PAGE_URL,
    languages: { 'en-NG': PAGE_URL, 'x-default': PAGE_URL },
  },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    siteName: SITE_NAME,
    title: 'Shop by Brand — Premium Drinks Brands in Nigeria | DrinksHarbour',
    description:
      'Browse all premium drinks brands on DrinksHarbour. Hennessy, Glenfiddich, Moët & Chandon, Ciroc and hundreds more — authentic, fast delivery nationwide.',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'DrinksHarbour — Shop by Brand' }],
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@drinksharbour',
    title: 'Shop by Brand — Premium Drinks Brands in Nigeria | DrinksHarbour',
    description:
      'Browse all premium drinks brands on DrinksHarbour. Authentic products with fast delivery across Nigeria.',
    images: ['/og-default.jpg'],
  },
};

// Server-side fetch so the page ships a real, crawlable brand grid — and the
// matching CollectionPage ItemList — in its HTML. <BrandsBrowser/> is seeded
// with this exact list (same limit, same productCount filter, same default
// name-ascending sort) so hydration matches and it skips its own first fetch.
async function fetchBrands(): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}/api/brands?limit=100&status=active`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.data?.brands ?? data?.data ?? data?.brands ?? [];
    return (Array.isArray(list) ? list : [])
      .filter((b: any) => b?.slug && b?.name && (b?.productCount ?? 0) > 0)
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  } catch {
    return [];
  }
}

export default async function BrandsPage() {
  const brands = await fetchBrands();

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${PAGE_URL}#collection`,
    name: 'Shop by Brand — DrinksHarbour',
    description:
      "Browse premium drinks brands available on DrinksHarbour — Nigeria's premier online beverage store.",
    url: PAGE_URL,
    inLanguage: 'en-NG',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    provider: { '@id': `${BASE_URL}/#organization` },
    ...(brands.length
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: brands.length,
            itemListElement: brands.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: b.name,
              url: `${BASE_URL}/brands/${b.slug}`,
            })),
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Brands', item: PAGE_URL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <BrandsBrowser initialBrands={brands} />
    </>
  );
}
