import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

export const metadata: Metadata = {
  title: 'Become a Vendor | Sell on DrinksHarbour',
  description:
    "List your beverages on Nigeria's premier drinks marketplace. Get a digital storefront, reach thousands of buyers, and manage your business with our ERM tools. Plans from ₦0 to ₦150K/month.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${BASE_URL}/vendors/register`,
    languages: { 'en-NG': `${BASE_URL}/vendors/register` },
  },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/vendors/register`,
    siteName: 'DrinksHarbour',
    title: 'Become a Vendor | Sell on DrinksHarbour',
    description:
      "List your beverages on Nigeria's premier drinks marketplace. Get a digital storefront, reach buyers, and manage your business with ERM tools.",
    images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: 'Sell on DrinksHarbour' }],
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@DrinkHarbour',
    title: 'Become a Vendor | Sell on DrinksHarbour',
    description: "List your beverages on Nigeria's premier drinks marketplace.",
    images: [`${BASE_URL}/og-default.jpg`],
  },
};

const BREADCRUMB_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Vendors', item: `${BASE_URL}/vendors` },
    { '@type': 'ListItem', position: 3, name: 'Become a Vendor', item: `${BASE_URL}/vendors/register` },
  ],
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }} />
      {children}
    </>
  );
}