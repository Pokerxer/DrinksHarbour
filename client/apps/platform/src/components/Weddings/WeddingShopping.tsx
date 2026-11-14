import Link from 'next/link';
import { PiArrowUpRight } from 'react-icons/pi';
import { fraunces } from '@/app/fonts';
import { money, offerHref, offerIdentity, type Offer } from '@/components/Merchandising/offers';
import BottleThumbnail from './BottleThumbnail';

export const weddingCollections = [
  { href: '/shop?category=champagne', name: 'Champagne & sparkling wine', detail: 'For the first toast.' },
  { href: '/shop?category=wine', name: 'Wedding wines', detail: 'Red, white and rosé for the reception meal.' },
  { href: '/shop?category=beer', name: 'Beer & cases', detail: 'Compare packs for the reception bar.' },
  { href: '/shop?category=non-alcoholic', name: 'Non-alcoholic drinks', detail: 'Soft drinks and options for an alcohol-free toast.' },
];

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17392e]';

export default function WeddingShopping({ offers }: { offers: Offer[] }) {
  return <section id="shop-wedding-drinks" className="scroll-mt-28 border-b border-[#d5dbd1] bg-white" aria-labelledby="shop-wedding-drinks-title">
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      <h2 id="shop-wedding-drinks-title" className={`${fraunces.className} text-3xl font-medium text-[#17392e] sm:text-4xl`}>Shop drinks for your reception</h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {weddingCollections.map(({ href, name, detail }) => <li key={href}>
          <Link href={href} className={`flex h-full flex-col gap-2 rounded-xl border border-[#d5dbd1] bg-[#f6f5ed] p-5 hover:bg-[#eef2e9] ${focus}`}>
            <span className="flex justify-between gap-2 font-bold text-[#17392e]">{name}<PiArrowUpRight aria-hidden className="mt-1 shrink-0" /></span>
            <span className="text-sm leading-6 text-stone-700">{detail}</span>
          </Link>
        </li>)}
      </ul>
      {offers.length > 0 && <section className="mt-8" aria-labelledby="wedding-catalogue-picks">
        <h3 id="wedding-catalogue-picks" className="font-semibold text-[#17392e]">Bottles from the catalogue</h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {offers.map(offer => <li key={offerIdentity(offer)}>
            <Link href={offerHref(offer)} className={`flex h-full items-center gap-3 rounded-xl border border-[#d5dbd1] p-4 hover:bg-[#f6f5ed] ${focus}`}>
              <BottleThumbnail src={offer.product.primaryImage?.url || offer.product.images?.[0]?.url} />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#17392e]">{offer.product.name}</span>
                <span className="mt-1 block text-xs text-stone-700">{offer.size.displayName || offer.size.size} · {offer.seller.tenant.name}</span>
                <span className="mt-1 block text-sm font-bold text-[#17392e]">{money(offer.price)}</span>
              </span>
            </Link>
          </li>)}
        </ul>
        <p className="mt-3 text-sm text-stone-700">Prices are for the listed size. Ask the team to confirm reception quantities and delivery to your venue.</p>
      </section>}
      <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-[#d5dbd1] pt-7">
        <div>
          <h3 className="font-bold text-[#17392e]">Ordering for a guest list?</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-700">Send your guest count, budget, date and venue so we can check what’s available. Read our <Link href="/bulk-drinks" className={`font-semibold underline underline-offset-4 ${focus}`}>bulk drinks guide</Link> for case orders.</p>
        </div>
        <a href="#wedding-list" className={`inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#17392e] underline underline-offset-4 ${focus}`}>Build your drinks list <PiArrowUpRight aria-hidden /></a>
      </div>
    </div>
  </section>;
}
