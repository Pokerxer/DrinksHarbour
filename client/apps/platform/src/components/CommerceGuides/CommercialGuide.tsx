import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CommercialPage } from '@/lib/commercialPages';
import { getOccasionPage } from '@/lib/commercialPages';
import EnquiryLink from './EnquiryLink';

function slugifySection(slug: string, index: number) {
  return `section-${slug}-${index + 1}`;
}
import GuideStructuredData from './GuideStructuredData';

export default function CommercialGuide({ page, hero, collectionItems, body, below, children }: { page: CommercialPage; hero?: ReactNode; collectionItems?: { name: string; url: string }[]; body?: ReactNode; below?: ReactNode; children?: ReactNode }) {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2347048004020';
  const message = `Hi DrinksHarbour, I would like to enquire about ${page.label.toLowerCase()}. I can share my bottle list, quantities, delivery city, budget and required date. Please confirm stock, pricing and delivery options.`;
  // Subpages sit two levels under /occasions: keep the parent occasion link so
  // the visible breadcrumb matches the structured-data depth.
  const occasion = getOccasionPage(page.slug);
  const isOccasionSubpage = Boolean(occasion && page.path !== occasion.path);
  return (
    <article className="bg-[#fcfaf8] text-gray-900">
      <GuideStructuredData path={page.path} name={page.heading} description={page.description} collectionItems={collectionItems} />
      {hero ?? <header className="border-b border-rose-100 bg-[#f7efeb]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(53,16,20,0.05) 0px, rgba(53,16,20,0.05) 1px, transparent 1px, transparent 9px)' }}>
        <div className="container mx-auto px-4 py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-600"><Link href="/" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1d1d]">Home</Link> / {page.slug !== 'bulk' && <><Link href="/occasions" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1d1d]">Occasions</Link> / </>}{isOccasionSubpage && <><Link href={occasion!.path} className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1d1d]">{occasion!.label}</Link> / </>}{page.label}</nav>
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#7c1d1d]"><span className="h-px w-8 bg-[#d5b26b]" aria-hidden="true" />DrinksHarbour · Plan your order</p>
          <h1 className="mt-4 max-w-4xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">{page.heading}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700">{page.intro}</p>
          <nav aria-label="Browse drinks for this occasion" className="mt-7 flex flex-wrap gap-3">{page.shelves.map(link => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] hover:bg-[#fff8ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">{link.label}</Link>)}</nav>
        </div>
      </header>}
      {children}
      <div className="container mx-auto grid items-start gap-10 px-4 py-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">{body ?? (
          <>
            {page.facts?.length ? <nav aria-label="Quick facts" className="flex flex-wrap gap-2">{page.facts.map(fact => <span key={fact} className="inline-flex min-h-9 items-center rounded-full border border-[#d5b26b]/50 bg-[#fff8ec] px-4 py-2 text-xs font-semibold text-[#351014]">{fact}</span>)}</nav> : null}
            {page.sections.length > 2 && <nav aria-label="On this page" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#7c1d1d]"><span className="text-gray-500 font-normal">On this page:</span>{page.sections.map((section, index) => <a key={section.heading} href={`#${slugifySection(page.slug, index)}`} className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">{section.heading}</a>)}</nav>}
            {page.sections.map((section, index) => <section key={section.heading} id={slugifySection(page.slug, index)} className="scroll-mt-28 border-t border-gray-200 pt-8 first:border-t-0 first:pt-0">
              <h2 className="text-2xl font-bold">{section.heading}</h2><p className="mt-3 leading-7 text-gray-700">{section.text}</p>
            </section>)}
          </>
        )}</div>
        <aside className="rounded-2xl border border-gray-200 bg-white p-6 lg:sticky lg:top-28" aria-labelledby="order-brief">
          <h2 id="order-brief" className="text-xl font-bold">Your order brief</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">Have these details ready so support can check your requirements.</p>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-6">{page.checklist.map(item => <li key={item}>{item}</li>)}</ul>
          <EnquiryLink type={page.slug} href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} />
          <p className="mt-3 text-xs leading-5 text-gray-600">Opens WhatsApp with a draft. Send it there to contact us. Stock, packaging and delivery are subject to confirmation.</p>
          <Link href="/contact" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#7c1d1d] underline">Use the contact form instead</Link>
        </aside>
      </div>
      {below && <div className="border-t border-gray-100 bg-white/50 py-10"><div className="container mx-auto px-4">{below}</div></div>}
      <footer className="container mx-auto border-t border-gray-200 px-4 py-8">
        <h2 className="text-xl font-bold">Before you order</h2>
        <p className="mt-3 max-w-3xl leading-7 text-gray-700">Compare like-for-like bottle sizes and quantities. Check current stock and checkout totals. Alcoholic orders are for adults aged 18 and over.</p>
        <nav aria-label="Ordering help" className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#7c1d1d] underline underline-offset-4">
          <Link href="/shipping-info">Delivery fees & timings</Link><Link href="/delivery/abuja">Abuja delivery</Link><Link href="/delivery/lagos">Lagos delivery</Link><Link href="/authenticity-guarantee">Authenticity & bottle checks</Link><Link href="/returns">Returns policy</Link><Link href="/occasions">More occasions</Link>
        </nav>
      </footer>
    </article>
  );
}
