import Link from 'next/link';
import { PiArrowUpRight, PiChampagne, PiConfetti, PiGift } from 'react-icons/pi';

const occasions = [
  {
    href: '/occasions/gifting', heading: 'Send a drinks gift in Abuja', action: 'Send a gift', Icon: PiGift,
    detail: 'Champagne, whisky, wine and non-alcoholic gifts with a personal message.',
  },
  {
    href: '/occasions/weddings', heading: 'Wedding drinks in Abuja', action: 'Shop wedding drinks', Icon: PiChampagne,
    detail: 'Shop for your reception or send us your guest count and drinks list.',
  },
  {
    href: '/occasions/house-parties', heading: 'Party drinks in Abuja', action: 'Shop party drinks', Icon: PiConfetti,
    detail: 'Beer, wine and mixers for birthdays and house parties.',
  },
];

export default function OccasionHomeLinks() {
  return <section className="border-y border-[#dec6b6] bg-[#fff8ec]" aria-label="Drinks for gifts, weddings and parties">
    <div className="container mx-auto grid divide-y divide-[#dec6b6] px-5 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
      {occasions.map(({ href, heading, action, Icon, detail }) => <div key={href} className="flex flex-wrap items-center justify-between gap-3 py-5 lg:px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f2dfd7] text-[#7c1d1d]"><Icon size={24} aria-hidden /></span>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#351014]">{heading}</h2>
            <p className="mt-1 text-sm text-stone-700">{detail}</p>
          </div>
        </div>
        <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#571419] px-5 text-sm font-bold text-white hover:bg-[#351014] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#571419]">
          {action} <PiArrowUpRight aria-hidden />
        </Link>
      </div>)}
    </div>
  </section>;
}
