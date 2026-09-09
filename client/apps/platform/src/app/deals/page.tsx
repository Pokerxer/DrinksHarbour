import type { Metadata } from 'next';
import ShopPage, { generateMetadata as shopMetadata } from '../shop/page';
import SeoContextBlock from '@/components/SEO/SeoContextBlock';

/**
 * /deals — the sale collection on a real, crawlable path.
 *
 * The same view used to be reachable only as /shop?sale=true, which robots.txt
 * blocks along with every other filter permutation, so the site's own "Sale" nav
 * link could never rank. This route renders the identical deals view (the shop
 * page with `sale=true` forced) at a static URL; /shop?sale=true still works and
 * canonicalizes here.
 */

// Force the sale view while preserving any extra filters (?category=, ?saleType=).
function withSale(params: Record<string, string>): Promise<Record<string, string>> {
  return Promise.resolve({ ...params, sale: 'true' });
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}): Promise<Metadata> {
  return shopMetadata({ searchParams: withSale(await searchParams) });
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return <><SeoContextBlock
    heading="Drinks deals and discounts in Nigeria"
    paragraphs={[
      'Find current deals on wines, spirits, champagne, beer and other drinks when you buy online from DrinksHarbour.',
      'Browse discounted bottles and order authentic drinks for delivery in Abuja and across Nigeria while stocks last.',
    ]}
    links={[
      { href: '/shop', label: 'Browse all drinks' },
      { href: '/categories', label: 'Shop by category' },
      { href: '/shipping-info', label: 'Check delivery information' },
    ]}
  />{await ShopPage({ searchParams: withSale(await searchParams) })}</>;
}
