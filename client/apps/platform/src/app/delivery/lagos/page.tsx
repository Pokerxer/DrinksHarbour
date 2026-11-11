import { ELSEWHERE_DELIVERY_WINDOW } from '@/lib/deliveryCopy';
import { withSocialMetadata } from '@/lib/socialMetadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { publicSiteOrigin } from '@/lib/publicSiteOrigin';

const BASE_URL = publicSiteOrigin();
const DESCRIPTION = `Buy wine, champagne, spirits and more online for delivery to Lagos in ${ELSEWHERE_DELIVERY_WINDOW}. Check delivery fees before payment.`;

export const metadata: Metadata = withSocialMetadata({
  title: 'Drinks Delivery in Lagos | Order Online',
  description: DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/delivery/lagos`, languages: { 'en-NG': `${BASE_URL}/delivery/lagos`, 'x-default': `${BASE_URL}/delivery/lagos` } },
  openGraph: { type: 'website', url: `${BASE_URL}/delivery/lagos`, title: 'Drinks Delivery in Lagos | DrinksHarbour', description: DESCRIPTION },
});

export default function LagosDeliveryPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500"><Link href="/" className="underline">Home</Link> / Lagos delivery</nav>
      <h1 className="text-4xl font-black text-gray-900">Drinks delivery in Lagos</h1>
      <p className="mt-5 text-lg leading-8 text-gray-600">Shop authentic wines, spirits, beers and non-alcoholic drinks online and arrange delivery to Lagos for your home bar, event or gift.</p>
      <h2 className="mt-10 text-2xl font-bold">Delivery to Lagos in {ELSEWHERE_DELIVERY_WINDOW}</h2>
      <p className="mt-3 leading-7 text-gray-600">Lagos is in our Southwest delivery zone. See <Link href="/shipping-info" className="underline">nationwide delivery areas and fees</Link> and check your exact delivery fee at checkout.</p>
      <p className="mt-3 leading-7 text-gray-600">For a wedding, reception or gift with a fixed deadline, ask support to confirm the delivery date before paying.</p>
      <h2 className="mt-8 text-2xl font-bold">Champagne, wine and event orders for Lagos</h2>
      <p className="mt-3 leading-7 text-gray-600">Match the label, bottle size and pack count when comparing seller prices. Allow time to receive and check your bottles before an event, and confirm packaging separately for gifts. Stock and delivery fees can affect the complete order cost.</p>
      <nav aria-label="Shop drinks for Lagos" className="mt-5 flex flex-wrap gap-4 font-semibold text-red-800 underline"><Link href="/shop?category=champagne">Champagne for Lagos delivery</Link><Link href="/shop?category=wine">Compare wine bottles</Link><Link href="/occasions/corporate">Corporate event drinks</Link><Link href="/occasions/gifting">Plan a drinks gift</Link><Link href="/authenticity-guarantee">Authenticity & bottle checks</Link></nav>
      <p className="mt-3 leading-7 text-gray-600">Alcoholic orders require valid ID and delivery to an adult aged 18 or over.</p>
      <div className="mt-8 flex flex-wrap gap-4"><Link href="/shop" className="rounded-full bg-red-700 px-6 py-3 font-bold text-white">Shop drinks online</Link><Link href="/shipping-info" className="rounded-full border border-gray-300 px-6 py-3 font-bold text-gray-800">See delivery fees</Link></div>
    </main>
  );
}
