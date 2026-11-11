import { ELSEWHERE_DELIVERY_WINDOW } from '@/lib/deliveryCopy';
import Link from 'next/link';
import type { CommercialPage } from '@/lib/commercialPages';
import EnquiryLink from '@/components/CommerceGuides/EnquiryLink';

export default function WeddingHelp({ page }: { page: CommercialPage }) {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2347048004020';
  const message = 'Hi DrinksHarbour, I have a question about wedding drinks. Please help me check bottle choices, stock, pricing and delivery for my venue.';
  return <>
    <section className="border-y border-gray-200 bg-white" aria-labelledby="wedding-details"><div className="mx-auto max-w-7xl px-5 py-12 sm:px-8"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c1d1d]">Before the big day</p><h2 id="wedding-details" className="mt-3 text-3xl font-bold tracking-tight">A little planning goes a long way.</h2><div className="mt-8 grid gap-8 md:grid-cols-3">{page.sections.map(section => <section key={section.heading} className="border-t-2 border-rose-100 pt-5"><h3 className="text-lg font-bold text-[#351014]">{section.heading}</h3><p className="mt-3 text-sm leading-7 text-gray-600">{section.text}</p></section>)}</div></div></section>
    <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_1.5fr]" aria-labelledby="wedding-questions">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c1d1d]">Good to know</p><h2 id="wedding-questions" className="mt-3 text-2xl font-bold tracking-tight">The wedding questions.</h2><p className="mt-3 max-w-sm text-sm leading-7 text-gray-600">Already have a bottle list? Share exact names, sizes and quantities in your brief, or ask a quick question.</p><EnquiryLink type="weddings" label="Ask a wedding question" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} /><Link href="/contact" className="mt-4 block text-xs font-semibold text-[#7c1d1d] underline underline-offset-4">Use the contact form</Link></div>
      <div className="divide-y divide-gray-200 border-y border-gray-200">
        <details className="py-5"><summary className="cursor-pointer text-sm font-semibold">Does this create a wedding package or reserve stock?</summary><p className="mt-3 text-sm leading-7 text-gray-600">It prepares an enquiry for our team. It does not reserve bottles, create an order or book delivery. Confirm the exact seller offers, quantities and full checkout total before paying.</p></details>
        <details className="py-5"><summary className="cursor-pointer text-sm font-semibold">Can you deliver to my wedding venue?</summary><p className="mt-3 text-sm leading-7 text-gray-600">Share the city, venue and preferred date so the team can check available options. Same-day delivery is available for eligible Abuja orders. Delivery elsewhere in Nigeria takes {ELSEWHERE_DELIVERY_WINDOW}. Agree a receiving contact and venue access before placing the order.</p></details>
        <details className="py-5"><summary className="cursor-pointer text-sm font-semibold">Are chilling, ice and glassware included?</summary><p className="mt-3 text-sm leading-7 text-gray-600">Those services, catering and bar staff are not automatically included. Confirm each requirement separately with your venue, caterer or the team before purchase.</p></details>
        <details className="py-5"><summary className="cursor-pointer text-sm font-semibold">Can I plan a fully non-alcoholic celebration?</summary><p className="mt-3 text-sm leading-7 text-gray-600">Yes. Select non-alcoholic drinks and describe your preferences. Check each product’s exact label and ABV when browsing; alcoholic drinks are for adults aged 18 and over.</p></details>
      </div>
    </section>
    <footer className="border-t border-gray-200 bg-white"><nav aria-label="Wedding ordering help" className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-4 px-5 py-8 text-xs font-semibold text-[#7c1d1d] underline underline-offset-4 sm:px-8"><Link href="/shipping-info">Delivery fees & timings</Link><Link href="/delivery/abuja">Abuja delivery</Link><Link href="/delivery/lagos">Lagos delivery</Link><Link href="/authenticity-guarantee">Bottle checks & support</Link><Link href="/occasions">More occasions</Link></nav></footer>
  </>;
}
