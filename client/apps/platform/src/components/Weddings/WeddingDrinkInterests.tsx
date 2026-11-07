import Link from 'next/link';
import { PiChampagneBold, PiWineBold, PiBeerBottleBold, PiMartiniBold, PiDropBold, PiArrowUpRightBold } from 'react-icons/pi';
import { weddingDrinks, type WeddingDrinkId } from './data';

const icons = { toast: PiChampagneBold, wine: PiWineBold, beer: PiBeerBottleBold, spirits: PiMartiniBold, water: PiDropBold };

export default function WeddingDrinkInterests({ selected, toggle }: { selected: WeddingDrinkId[]; toggle: (id: WeddingDrinkId) => void }) {
  return <section aria-labelledby="drink-preferences-heading" className="rounded-2xl border border-rose-200 bg-white p-4 sm:p-6"><h3 id="drink-preferences-heading" className="text-xl font-bold text-[#351014]">Choose your drink categories</h3><p className="mt-2 text-sm leading-7 text-gray-600">Choose the categories your guests enjoy. Our team will use your preferences, drinks budget and guest count to prepare a suitable list.</p><div className="mt-5">
        <fieldset><legend className="mb-4 text-sm font-semibold text-gray-700">Choose one or more categories</legend>
          <div className="grid gap-3 sm:grid-cols-2">{weddingDrinks.map(drink => {
            const Icon = icons[drink.symbol], checked = selected.includes(drink.id);
            return <div key={drink.id} className={`rounded-xl border bg-white p-4 ${checked ? 'border-[#7c1d1d] ring-1 ring-[#7c1d1d]' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3"><Icon className="mt-1 h-5 w-5 shrink-0 text-[#7c1d1d]" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#7c1d1d]">{drink.moment}</p><label htmlFor={`wedding-${drink.id}`} className="mt-1 flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold text-gray-900">{drink.label}<input id={`wedding-${drink.id}`} type="checkbox" checked={checked} onChange={() => toggle(drink.id)} className="h-5 w-5 shrink-0 accent-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1d1d]" /></label><p className="mt-1 text-sm leading-6 text-gray-600">{drink.text}</p><Link href={drink.href} className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[#7c1d1d] underline underline-offset-4">{drink.link}<PiArrowUpRightBold aria-hidden="true" /></Link></div></div>
            </div>;
          })}</div>
        </fieldset>
        <p role="status" aria-live="polite" className="mt-4 text-xs font-semibold text-[#7c1d1d]">{selected.length ? `${selected.length} drink ${selected.length === 1 ? 'category' : 'categories'} included in your request.` : 'Choose categories for our team to plan, or search for specific bottles below.'}</p>
  </div></section>;
}
