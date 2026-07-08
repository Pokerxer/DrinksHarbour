import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

export const metadata: Metadata = {
  title: 'Vendor Application | DrinksHarbour',
  description:
    "Apply to sell on DrinksHarbour — Nigeria's premier beverage marketplace. Get a branded storefront, reach buyers, and manage your business with ERM tools.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: `${BASE_URL}/vendors/register/apply`,
  },
  openGraph: {
    title: 'Vendor Application | DrinksHarbour',
    description: "Apply to sell on Nigeria's premier beverage marketplace.",
    url: `${BASE_URL}/vendors/register/apply`,
  },
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}