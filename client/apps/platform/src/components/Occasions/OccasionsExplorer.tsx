'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { PiPackageBold, PiArrowRightBold } from 'react-icons/pi';
import type { OccasionId } from '@/lib/occasionBrief';
import { getOccasionSubpages } from '@/lib/occasions';
import { occasionCards } from './data';
import OccasionCard from './OccasionCard';
import OccasionChatPlanner from './OccasionChatPlanner';

/** Short chip labels for guide links pulled from the lib/occasions registry. */
const GUIDE_LABELS: Record<string, string> = {
  cocktails: 'Cocktails',
  birthday: 'Birthday drinks',
  champagne: 'Toast champagne',
  'traditional-engagement': 'Traditional engagement',
  'client-gifts': 'Client gifts',
  'end-of-year-events': 'End-of-year events',
  hampers: 'Hampers',
  'corporate-gifts': 'Corporate gifts',
};

function subpageGuides(id: string) {
  return getOccasionSubpages(id).map(sub => ({ href: `/occasions/${id}/${sub.slug}`, label: GUIDE_LABELS[sub.slug] ?? sub.slug }));
}

export default function OccasionsExplorer() {
  const [occasion, setOccasion] = useState<OccasionId | ''>('');
  const plannerHeading = useRef<HTMLHeadingElement>(null);
  const selected = occasionCards.find(card => card.id === occasion);
  function plan(id: OccasionId) {
    setOccasion(id);
    plannerHeading.current?.focus({ preventScroll: true });
    plannerHeading.current?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  return <section id="occasion-explorer" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-12 sm:px-8 lg:py-16" aria-labelledby="choose-occasion">
    <div className="mb-8 max-w-2xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c1d1d]">Find your starting point</p>
      <h2 id="choose-occasion" className="mt-3 text-3xl font-bold tracking-tight text-gray-950">What are you planning?</h2>
      <p className="mt-3 leading-7 text-gray-600">Explore a guide or choose an occasion to start your brief. You can browse bottles now and ask about the details when you are ready.</p>
    </div>
    <div className="grid items-start gap-8 ">
      <div>
        <div className="grid gap-4 sm:grid-cols-2">{occasionCards.map(card => <OccasionCard key={card.id} card={card} guides={subpageGuides(card.id)} selected={occasion === card.id} onPlan={() => plan(card.id)} />)}</div>
        <div className="mt-5 rounded-2xl bg-[#163a30] p-6 text-white">
          <div className="flex items-start gap-4"><PiPackageBold className="mt-1 h-7 w-7 shrink-0 text-emerald-200" aria-hidden="true" /><div><h3 className="text-xl font-semibold">Buying by the case?</h3><p className="mt-2 text-sm leading-6 text-white/75">Compare pack counts and bottle sizes before comparing prices. Stock and quantity pricing depend on the selected seller.</p></div></div>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/bulk-drinks" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold underline underline-offset-4">Bulk buying guide <PiArrowRightBold aria-hidden="true" /></Link><button type="button" onClick={() => plan('bulk')} aria-pressed={occasion === 'bulk'} className="min-h-10 rounded-full border border-white/35 px-4 py-2 text-xs font-bold hover:bg-white/10">Plan a bulk order</button></div>
        </div>
        {selected && <nav aria-label={`Browse drinks for ${selected.label}`} className="mt-6 rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs font-semibold text-gray-700">A few places to start for {selected.label.toLowerCase()}</p><div className="mt-3 flex flex-wrap gap-2">{selected.shelves.map(link => <Link key={link.href} href={link.href} className="rounded-full border border-gray-200 px-4 py-2.5 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d]">{link.label} →</Link>)}</div></nav>}
      </div>

    </div>
    <OccasionChatPlanner occasion={occasion || 'general'} onOccasionChange={setOccasion} headingRef={plannerHeading} embedded />
  </section>;
}
