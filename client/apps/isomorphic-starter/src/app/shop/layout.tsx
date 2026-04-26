import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

export const metadata: Metadata = {
  title: 'Shop Beverages Online — Premium Spirits, Wines & Beers | DrinksHarbour',
  description: 'Browse our full collection of premium spirits, wines, beers, and non-alcoholic drinks. Shop online for authentic beverages with fast delivery across Nigeria.',
  keywords: ['shop beverages Nigeria', 'buy wine online', 'buy whiskey online', 'liquor store Nigeria', 'alcohol delivery Nigeria'],
  openGraph: {
    title: 'Shop Beverages — Premium Spirits, Wines & Beers | DrinksHarbour',
    description: 'Browse our full collection of premium beverages. Fast delivery across Nigeria.',
    url: `${BASE_URL}/shop`,
    type: 'website',
  },
  alternates: { canonical: `${BASE_URL}/shop` },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}