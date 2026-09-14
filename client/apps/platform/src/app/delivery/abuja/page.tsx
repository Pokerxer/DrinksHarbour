import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

export const metadata: Metadata = {
  title: 'Drinks Delivery in Abuja | Same-Day Orders',
  description: 'Order authentic wine, whisky, spirits, beer and non-alcoholic drinks online in Abuja. DrinksHarbour offers same-day FCT delivery with age verification.',
  alternates: { canonical: `${BASE_URL}/delivery/abuja`, languages: { 'en-NG': `${BASE_URL}/delivery/abuja`, 'x-default': `${BASE_URL}/delivery/abuja` } },
  openGraph: { type: 'website', url: `${BASE_URL}/delivery/abuja`, title: 'Drinks Delivery in Abuja | DrinksHarbour', description: 'Shop authentic drinks online and get same-day delivery across Abuja and the FCT.' },
};

export default function AbujaDeliveryPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
        <Link href="/" className="underline">Home</Link> / Abuja delivery
      </nav>
      <h1 className="text-4xl font-black text-gray-900">Drinks delivery in Abuja</h1>
      <p className="mt-5 text-lg leading-8 text-gray-600">Order authentic wines, spirits, beers and non-alcoholic drinks online with same-day delivery across Abuja and the FCT.</p>
      <h2 className="mt-10 text-2xl font-bold">Same-day FCT delivery</h2>
      <p className="mt-3 leading-7 text-gray-600">Delivery is available to Abuja, Gwagwalada, Kuje, Bwari and Kubwa. Fees and the available delivery window are shown at checkout before payment.</p>
      <p className="mt-3 leading-7 text-gray-600">Alcoholic orders require valid ID and delivery to an adult aged 18 or over.</p>
      <div className="mt-8 flex flex-wrap gap-4"><Link href="/shop" className="rounded-full bg-red-700 px-6 py-3 font-bold text-white">Shop drinks online</Link><Link href="/shipping-info" className="rounded-full border border-gray-300 px-6 py-3 font-bold text-gray-800">See delivery fees</Link></div>
    </main>
  );
}
