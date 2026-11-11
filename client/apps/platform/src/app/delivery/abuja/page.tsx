import { ELSEWHERE_DELIVERY_WINDOW } from '@/lib/deliveryCopy';
import { withSocialMetadata } from '@/lib/socialMetadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { publicSiteOrigin } from '@/lib/publicSiteOrigin';

const BASE_URL = publicSiteOrigin();

export const metadata: Metadata = withSocialMetadata({
  title: 'Drinks Delivery in Abuja | Same-Day Options',
  description: 'Buy drinks online in Abuja. Compare wine, whisky and beer, check same-day FCT options, delivery fees and bottle details before placing your order.',
  alternates: { canonical: `${BASE_URL}/delivery/abuja`, languages: { 'en-NG': `${BASE_URL}/delivery/abuja`, 'x-default': `${BASE_URL}/delivery/abuja` } },
  openGraph: { type: 'website', url: `${BASE_URL}/delivery/abuja`, title: 'Drinks Delivery in Abuja | DrinksHarbour', description: 'Compare drinks and check same-day FCT delivery options, fees and order timing before payment.' },
});

export default function AbujaDeliveryPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
        <Link href="/" className="underline">Home</Link> / Abuja delivery
      </nav>
      <h1 className="text-4xl font-black text-gray-900">Drinks delivery in Abuja</h1>
      <p className="mt-5 text-lg leading-8 text-gray-600">Buy wines, spirits, beers and non-alcoholic drinks online in Abuja. Compare bottle details and seller prices, with same-day FCT options subject to your address, order timing and available stock.</p>
      <h2 className="mt-10 text-2xl font-bold">Same-day FCT delivery</h2>
      <p className="mt-3 leading-7 text-gray-600">The published FCT zone includes Abuja, Gwagwalada, Kuje, Bwari and Kubwa. Same-day delivery has a noon cutoff. Confirm the available service for your exact address and order before payment. Fees and delivery options are shown at checkout.</p>
      <p className="mt-3 leading-7 text-gray-600">Delivery elsewhere in Nigeria takes {ELSEWHERE_DELIVERY_WINDOW}. See <Link href="/shipping-info" className="underline">nationwide delivery areas and fees</Link>.</p>
      <h2 className="mt-8 text-2xl font-bold">Buying for an event or your home bar?</h2>
      <p className="mt-3 leading-7 text-gray-600">Compare the same bottle size and quantity across seller offers. Large orders need a receiving plan and may have carton-handling charges. For a fixed event deadline, contact support before placing the order.</p>
      <nav aria-label="Shop drinks for Abuja" className="mt-5 flex flex-wrap gap-4 font-semibold text-red-800 underline"><Link href="/shop?category=tequila">Buy tequila for Abuja delivery</Link><Link href="/shop?category=gin">Compare gin bottles</Link><Link href="/occasions/weddings">Wedding drinks planning</Link><Link href="/bulk-drinks">Bulk & case buying</Link><Link href="/authenticity-guarantee">Authenticity & bottle checks</Link></nav>
      <p className="mt-3 leading-7 text-gray-600">Alcoholic orders require valid ID and delivery to an adult aged 18 or over.</p>
      <div className="mt-8 flex flex-wrap gap-4"><Link href="/shop" className="rounded-full bg-red-700 px-6 py-3 font-bold text-white">Shop drinks online</Link><Link href="/shipping-info" className="rounded-full border border-gray-300 px-6 py-3 font-bold text-gray-800">See delivery fees</Link></div>
    </main>
  );
}
