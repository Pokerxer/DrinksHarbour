import Link from 'next/link';

export default function CommerceDiscovery() {
  return <section className="border-y border-gray-200 bg-white" aria-labelledby="occasion-shopping">
    <div className="container mx-auto px-4 py-10">
      <h2 id="occasion-shopping" className="font-serif text-3xl font-semibold">A bottle list for every occasion</h2>
      <p className="mt-3 max-w-3xl leading-7 text-gray-700">Compare drinks for your wedding, business event or next gathering. Check bottle sizes, seller prices and delivery options before ordering.</p>
      <nav aria-label="Shop drinks by occasion" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['/bulk-drinks', 'Bulk & case buying'], ['/occasions/weddings', 'Wedding drinks'], ['/occasions/corporate', 'Corporate events'], ['/occasions/gifting', 'Wine & spirits gifts']].map(([href, label]) => <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-xl border border-[#7c1d1d]/15 bg-[#fff8ec] px-5 py-4 font-semibold text-[#571419] hover:border-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">{label} →</Link>)}
      </nav>
      <p className="mt-6 text-sm leading-6 text-gray-700">Know your bottle: <Link href="/authenticity-guarantee" className="font-semibold text-[#7c1d1d] underline">authenticity and bottle-check guidance</Link>. Plan delivery with our <Link href="/delivery/abuja" className="font-semibold text-[#7c1d1d] underline">Abuja</Link> and <Link href="/delivery/lagos" className="font-semibold text-[#7c1d1d] underline">Lagos</Link> guides.</p>
    </div>
  </section>;
}
