import Image from 'next/image';
import Link from 'next/link';
import { PiArrowDown, PiArrowUpRight } from 'react-icons/pi';
import { fraunces } from '@/app/fonts';
import type { CommercialPage } from '@/lib/commercialPages';
import { money, offerHref, offerIdentity, type Offer } from '@/components/Merchandising/offers';
import BottleThumbnail from '@/components/Weddings/BottleThumbnail';

export const partyHeroImage = '/images/party-drinks-abuja.webp';

export const partyCollections = [
  { href: '/shop?category=beer', name: 'Beer & cases', detail: 'Compare bottles, cans and packs for the cooler.' },
  { href: '/shop?category=gin', name: 'Gin for cocktails', detail: 'Pick a spirit and add the mixers your recipe calls for.' },
  { href: '/shop?category=non-alcoholic', name: 'Soft drinks & mixers', detail: 'Stock the table with alcohol-free options.' },
  { href: '/shop?category=wine', name: 'Wine for the table', detail: 'Browse red, white and rosé for dinner.' },
];

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';

export function PartyStorefrontHero({ page }: { page: CommercialPage }) {
  return <header className="bg-[#171b32] text-[#fff8ed]">
    <div className="mx-auto grid max-w-7xl items-stretch lg:grid-cols-2">
      <div className="px-5 pb-10 pt-8 sm:px-8 lg:pb-16 lg:pr-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-[#e0ddef]">
          <Link href="/" className={`underline underline-offset-4 ${focus}`}>Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/occasions" className={`underline underline-offset-4 ${focus}`}>Occasions</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page.label}</span>
        </nav>
        <h1 className={`${fraunces.className} mt-8 max-w-xl text-[clamp(2.7rem,5.2vw,4.5rem)] font-medium leading-[1.05] tracking-tight lg:mt-12`}>{page.heading}</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-[#e0ddef] sm:text-lg">{page.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#shop-party-drinks" className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-[#f4c782] px-5 py-3 text-sm font-bold text-[#171b32] hover:bg-[#ffe2b4] focus-visible:outline-[#f4c782] ${focus}`}>
            Shop party drinks <PiArrowDown aria-hidden />
          </a>
          <a href="#occasion-planner" className={`inline-flex min-h-12 items-center gap-2 rounded-full border border-[#958da8] px-5 py-3 text-sm font-bold hover:bg-white/10 ${focus}`}>
            Send your party brief <PiArrowUpRight aria-hidden />
          </a>
        </div>
      </div>
      <div className="relative aspect-[3/2] lg:aspect-auto">
        <Image src={partyHeroImage} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" preload />
      </div>
    </div>
  </header>;
}

export function PartyStorefrontShopping({ offers }: { offers: Offer[] }) {
  return <section id="shop-party-drinks" className="scroll-mt-28 border-b border-[#e9d9c2] bg-[#fff8ed]" aria-labelledby="shop-party-title">
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      <h2 id="shop-party-title" className={`${fraunces.className} text-3xl font-medium text-[#171b32] sm:text-4xl`}>Shop drinks for your party</h2>
      <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#e1ceb3] bg-[#e1ceb3] sm:grid-cols-2 lg:grid-cols-4">
        {partyCollections.map(({ href, name, detail }) => <li key={href}>
          <Link href={href} className="flex h-full flex-col gap-2 bg-[#fffcf7] p-5 text-[#171b32] hover:bg-[#f8ebd7] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4">
            <span className="flex justify-between gap-2 font-bold">{name}<PiArrowUpRight aria-hidden className="mt-1 shrink-0" /></span>
            <span className="text-sm leading-6 text-stone-700">{detail}</span>
          </Link>
        </li>)}
      </ul>
      {offers.length > 0 && <section className="mt-8" aria-labelledby="party-catalogue-picks">
        <h3 id="party-catalogue-picks" className="font-semibold text-[#171b32]">From the catalogue</h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {offers.map(offer => <li key={offerIdentity(offer)}>
            <Link href={offerHref(offer)} className={`flex h-full items-center gap-3 rounded-xl border border-[#e1ceb3] bg-[#fffcf7] p-4 text-[#171b32] hover:bg-[#f8ebd7] ${focus}`}>
              <BottleThumbnail src={offer.product.primaryImage?.url || offer.product.images?.[0]?.url} />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{offer.product.name}</span>
                <span className="mt-1 block text-xs text-stone-700">{offer.size.displayName || offer.size.size} · {offer.seller.tenant.name}</span>
                <span className="mt-1 block text-sm font-bold">{money(offer.price)}</span>
              </span>
            </Link>
          </li>)}
        </ul>
        <p className="mt-3 text-sm text-stone-700">Prices are for the listed size. Confirm available quantities and delivery charges before paying.</p>
      </section>}
      <div className="mt-9 max-w-2xl border-t border-[#e1ceb3] pt-7">
        <h3 className="font-bold text-[#171b32]">Hosting in Abuja?</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">Check <Link href="/delivery/abuja" className={`font-semibold underline underline-offset-4 ${focus}`}>Abuja delivery areas and timing</Link>. For a large order or a fixed deadline, send the team your guest count, budget, address and party date so we can check availability.</p>
      </div>
    </div>
  </section>;
}
