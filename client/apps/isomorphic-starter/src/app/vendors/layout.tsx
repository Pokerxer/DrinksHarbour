import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Vendors',
  description: 'Browse all verified stores and merchants on DrinksHarbour. Discover premium spirits, wines, beers and more from trusted vendors across Nigeria.',
  openGraph: {
    title: 'Our Vendors | DrinksHarbour',
    description: 'Browse all verified stores and merchants on DrinksHarbour.',
    type: 'website',
  },
};

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
