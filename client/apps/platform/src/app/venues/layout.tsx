import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SeoContextBlock from '@/components/SEO/SeoContextBlock';

const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com'}/venues`;
const title = 'Discover Venues & Request a Table | DrinksHarbour';
const description = 'Explore venues on DrinksHarbour and request a table for your group. Sign in to send your booking details and receive confirmation from the venue.';

export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical: url, languages: { 'en-NG': url, 'x-default': url } },
  openGraph: {
    type: 'website', url, title, description, siteName: 'DrinksHarbour',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-default.jpg'] },
};

export default function VenuesLayout({ children }: { children: ReactNode }) {
  return <>
    <SeoContextBlock
      heading="Discover venues and request a table in Nigeria"
      paragraphs={[
        'Explore DrinksHarbour venues, discover places to enjoy premium drinks and request a table for your group.',
        'Review the venue details, send your booking request and wait for confirmation from the venue team.',
      ]}
      links={[
        { href: '/shop', label: 'Buy drinks online' },
        { href: '/categories', label: 'Browse drinks categories' },
        { href: '/shipping-info', label: 'Check delivery information' },
        { href: '/faqs', label: 'Read frequently asked questions' },
      ]}
    />
    {children}
  </>;
}
