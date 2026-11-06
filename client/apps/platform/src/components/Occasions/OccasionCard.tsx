import Link from 'next/link';
import { PiWineBold, PiBuildingsBold, PiConfettiBold, PiGiftBold, PiArrowUpRightBold, PiCheckBold } from 'react-icons/pi';
import type { OccasionCardData } from './data';

type GuideLink = { href: string; label: string };

const treatments = {
  weddings: { Icon: PiWineBold, surface: 'bg-rose-50', ink: 'text-[#7c1d1d]', detail: 'The toast · The meal · The celebration' },
  corporate: { Icon: PiBuildingsBold, surface: 'bg-emerald-50', ink: 'text-[#163a30]', detail: 'Team moments · Receptions · Client gifts' },
  'house-parties': { Icon: PiConfettiBold, surface: 'bg-amber-50', ink: 'text-amber-900', detail: 'Dinner tables · Cocktail nights · Catch-ups' },
  gifting: { Icon: PiGiftBold, surface: 'bg-violet-50', ink: 'text-violet-900', detail: 'Birthdays · Thank-yous · Just because' },
};

export default function OccasionCard({ card, guides, selected, onPlan }: { card: OccasionCardData; guides?: GuideLink[]; selected: boolean; onPlan: () => void }) {
  const { Icon, surface, ink, detail } = treatments[card.id];
  return <article className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-colors ${selected ? 'border-[#7c1d1d] ring-1 ring-[#7c1d1d]' : 'border-gray-200 hover:border-gray-400'}`}>
    <div className={`flex items-center justify-between gap-3 px-5 py-5 ${surface} ${ink}`}>
      <Icon className="h-9 w-9 shrink-0" aria-hidden="true" />
      <p className="max-w-[11rem] text-right text-[10px] font-semibold uppercase leading-5 tracking-wider">{detail}</p>
    </div>
    <div className="flex flex-1 flex-col p-5">
      <p className={`text-[10px] font-bold uppercase tracking-wider ${ink}`}>{card.eyebrow}</p>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-gray-950">{card.label}</h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">{card.description}</p>
      {guides?.length ? <div className="mt-3 flex flex-wrap gap-2">{guides.map(guide => <Link key={guide.href} href={guide.href} className="rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">{guide.label}</Link>)}</div> : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-gray-100 pt-4">
        <Link href={`/occasions/${card.id}`} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-gray-700 underline-offset-4 hover:underline">Read the guide <PiArrowUpRightBold aria-hidden="true" /></Link>
        <button type="button" onClick={onPlan} aria-label={`Plan ${card.label}`} aria-pressed={selected} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#7c1d1d] px-4 py-2 text-xs font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">{selected ? <><PiCheckBold aria-hidden="true" />Selected</> : 'Plan this occasion'}</button>
      </div>
    </div>
  </article>;
}
