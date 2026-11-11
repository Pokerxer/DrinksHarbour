import { NATIONWIDE_DELIVERY_PROMISE } from '@/lib/deliveryCopy';
import Link from 'next/link';

/** Server-rendered context and browsing links; no scroll or JavaScript required. */
export default function MarketplaceIntro() {
  return (
    <section aria-labelledby="delivery-heading" className="bg-white py-8">
      <div className="container mx-auto space-y-4 px-3">
        <h2 id="delivery-heading" className="text-2xl font-semibold">Shop wines, spirits and more online</h2>
        <p className="max-w-3xl leading-7 text-gray-700">
          DrinksHarbour is a Nigerian online beverage marketplace. Shop for your home bar,
          a gift or your next gathering. Compare bottles, sizes and prices from verified sellers
          and order for delivery anywhere in Nigeria.
        </p>
        <p className="max-w-3xl leading-7 text-gray-700">
          {NATIONWIDE_DELIVERY_PROMISE} Check delivery areas, order cutoffs and
          fees before checkout. Alcohol is for adults aged 18 and over.
        </p>
        <p className="max-w-3xl leading-7 text-gray-700">
          Compare the selected seller and bottle details before buying. Read our
          authenticity and bottle-check guidance and contact support if a product
          or delivered bottle raises a concern.
        </p>
        <nav aria-label="Explore drinks and delivery" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold underline underline-offset-4">
          <Link href="/categories">Browse drink categories</Link>
          <Link href="/brands">Explore drinks brands</Link>
          <Link href="/shop">Browse all drinks</Link>
          <Link href="/shipping-info">Nationwide delivery times and fees</Link>
          <Link href="/delivery/abuja">Same-day delivery in Abuja</Link>
          <Link href="/blog">Drinks guides and tasting notes</Link>
          <Link href="/authenticity-guarantee">Authenticity and bottle checks</Link>
          <Link href="/occasions">Plan drinks for an occasion</Link>
        </nav>
      </div>
    </section>
  );
}
