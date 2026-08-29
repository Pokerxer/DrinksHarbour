import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

export const metadata: Metadata = {
  title: 'ERM Software for Beverage Businesses',
  description:
    'Explore DrinksHarbour ERM — inventory management, point of sale, invoicing, CRM, analytics, and more. The operating system for Nigerian beverage businesses.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${BASE_URL}/erm`,
    languages: { 'en-NG': `${BASE_URL}/erm` },
  },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/erm`,
    siteName: 'DrinksHarbour',
    title: 'ERM Software for Beverage Businesses | DrinksHarbour',
    description:
      'Inventory, POS, invoicing, CRM, analytics — every tool you need to run your beverage business, all in one dashboard.',
    images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: 'DrinksHarbour ERM' }],
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@DrinkHarbour',
    title: 'ERM Software for Beverage Businesses | DrinksHarbour',
    description: 'Inventory, POS, invoicing, CRM, analytics — the operating system for beverage businesses.',
    images: [`${BASE_URL}/og-default.jpg`],
  },
};

const BREADCRUMB_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'ERM', item: `${BASE_URL}/erm` },
  ],
};

export default function ErmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }}
      />
      {children}
    </>
  );
}
