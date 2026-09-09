import SeoContextBlock from '@/components/SEO/SeoContextBlock';

// Metadata is handled dynamically in page.tsx via generateMetadata (reads searchParams).
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <><SeoContextBlock
    heading="Buy drinks online in Nigeria"
    paragraphs={[
      'Shop wines, spirits, beer and non-alcoholic drinks online at DrinksHarbour. Filter by category, brand, origin, flavour and price to find the right bottle.',
      'Order authentic drinks for delivery in Abuja, Lagos and across Nigeria. Alcohol is available to customers aged 18 and over.',
    ]}
    links={[
      { href: '/categories', label: 'Browse drinks categories' },
      { href: '/brands', label: 'Explore drinks brands' },
      { href: '/deals', label: 'Shop drinks deals' },
      { href: '/shipping-info', label: 'View delivery areas and fees' },
    ]}
  />{children}</>;
}
