import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

export const metadata: Metadata = {
  title: 'Drinks Delivery in Lagos | Order Online',
  description: 'Buy authentic wine, whisky, spirits, beer and non-alcoholic drinks online in Lagos. DrinksHarbour delivers from Abuja with transparent nationwide delivery fees.',
  alternates: { canonical: `${BASE_URL}/delivery/lagos`, languages: { 'en-NG': `${BASE_URL}/delivery/lagos`, 'x-default': `${BASE_URL}/delivery/lagos` } },
  openGraph: { type: 'website', url: `${BASE_URL}/delivery/lagos`, title: 'Drinks Delivery in Lagos | DrinksHarbour', description: 'Shop authentic drinks online in Lagos with transparent delivery fees and age verification.' },
};

export default function LagosDeliveryPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500"><Link href="/" className="underline">Home</Link> / Lagos delivery</nav>
      <h1 className="text-4xl font-black text-gray-900">Drinks delivery in Lagos</h1>
      <p className="mt-5 text-lg leading-8 text-gray-600">Shop authentic wines, spirits, beers and non-alcoholic drinks online and arrange delivery to Lagos for your home bar, event or gift.</p>
      <h2 className="mt-10 text-2xl font-bold">Nationwide delivery from Abuja</h2>
      <p className="mt-3 leading-7 text-gray-600">Lagos is covered by DrinksHarbour's Southwest delivery zone. Exact fees, carton handling and the estimated 2–3 business-day window are shown at checkout.</p>
      <p className="mt-3 leading-7 text-gray-600">Alcoholic orders require valid ID and delivery to an adult aged 18 or over.</p>
      <div className="mt-8 flex flex-wrap gap-4"><Link href="/shop" className="rounded-full bg-red-700 px-6 py-3 font-bold text-white">Shop drinks online</Link><Link href="/shipping-info" className="rounded-full border border-gray-300 px-6 py-3 font-bold text-gray-800">See delivery fees</Link></div>
    </main>
  );
}
