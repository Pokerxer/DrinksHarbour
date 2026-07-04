import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

export const metadata: Metadata = {
  title: 'Our Vendors',
  description: 'Browse all verified stores and merchants on DrinksHarbour. Discover premium spirits, wines, beers and more from trusted vendors across Nigeria.',
  alternates: { canonical: `${BASE_URL}/vendors` },
  openGraph: {
    title: 'Our Vendors | DrinksHarbour',
    description: 'Browse all verified stores and merchants on DrinksHarbour.',
    type: 'website',
    url: `${BASE_URL}/vendors`,
  },
};

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Vendors — DrinksHarbour',
  description: 'Browse all verified beverage stores and merchants on DrinksHarbour.',
  url: `${BASE_URL}/vendors`,
  provider: { '@type': 'Organization', name: 'DrinksHarbour', url: BASE_URL },
  inLanguage: 'en-NG',
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Vendors', item: `${BASE_URL}/vendors` },
  ],
};

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
