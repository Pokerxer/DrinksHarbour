import Image from 'next/image';
import Link from 'next/link';
import { PiArrowUpRight, PiGift, PiMapPin, PiNotePencil } from 'react-icons/pi';
import type { CommercialPage } from '@/lib/commercialPages';
import { money, offerHref, offerIdentity, type Offer } from '@/components/Merchandising/offers';
import BottleThumbnail from '@/components/Weddings/BottleThumbnail';
import { giftCollections } from './giftCatalogue';

export const giftHeroImage = '/images/drinks-gifting-abuja.webp';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';

export function GiftStorefrontHero({ page }: { page: CommercialPage }) {
  return <header className="bg-[#351014] text-[#fff8ec]">
    <div className="container mx-auto grid items-stretch lg:grid-cols-[1fr_1fr]">
      <div className="px-5 pb-12 pt-7 sm:px-10 sm:pb-16 lg:pr-12">
        <nav aria-label="Breadcrumb" className="mb-10 text-sm text-[#eed9d0]">
          <Link href="/" className={`underline underline-offset-4 ${focus}`}>Home</Link>
          {' / '}
          <Link href="/occasions" className={`underline underline-offset-4 ${focus}`}>Occasions</Link>
          {' / '}<span aria-current="page">{page.label}</span>
        </nav>
        <h1 className="max-w-xl font-serif text-5xl font-semibold leading-[1.04] sm:text-6xl">{page.heading}</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#eed9d0] sm:text-lg">{page.intro}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href="#shop-gifts" className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-[#f5dfb9] px-6 text-sm font-bold text-[#351014] hover:bg-white ${focus}`}>
            Shop gifts <PiArrowUpRight aria-hidden />
          </a>
          <a href="#occasion-chat" className={`inline-flex min-h-12 items-center font-semibold underline underline-offset-4 ${focus}`}>Request a custom gift</a>
        </div>
      </div>
      <div className="relative aspect-[3/2] lg:aspect-auto">
        <Image src={giftHeroImage} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" preload className="object-cover" />
      </div>
    </div>
  </header>;
}

export function GiftStorefrontShopping({ offers }: { offers: Offer[] }) {
  return <div className="bg-[#fff8ec]">
    <div className="container mx-auto px-5 py-12 sm:px-10">
      <section id="shop-gifts" aria-labelledby="gift-collections" className="scroll-mt-28">
        <h2 id="gift-collections" className="font-serif text-3xl font-semibold text-[#351014] sm:text-4xl">Find their kind of gift</h2>
        <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#dec6b6] bg-[#dec6b6] sm:grid-cols-2 xl:grid-cols-4">
          {giftCollections.map(({ href, name, detail }) => <li key={href} className="bg-[#fffcf7]">
            <Link href={href} className="flex h-full flex-col px-5 py-6 hover:bg-[#f5e8df] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#7c1d1d]">
              <span className="flex items-start justify-between gap-2 text-lg font-bold text-[#571419]">{name}<PiArrowUpRight aria-hidden className="mt-1 shrink-0" /></span>
              <span className="mt-2 text-sm leading-6 text-stone-700">{detail}</span>
            </Link>
          </li>)}
        </ul>
      </section>
      {offers.length > 0 && <section className="mt-10" aria-labelledby="gift-bottle-suggestions">
        <h2 id="gift-bottle-suggestions" className="font-serif text-2xl font-semibold text-[#351014]">Bottles to send as a gift</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {offers.map(offer => <li key={offerIdentity(offer)}>
            <Link href={offerHref(offer)} className={`flex h-full items-center gap-3 rounded-xl border border-[#dec6b6] bg-[#fffcf7] p-4 hover:bg-[#f5e8df] ${focus}`}>
              <BottleThumbnail src={offer.product.primaryImage?.url || offer.product.images?.[0]?.url} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#571419]">{offer.product.name}</p>
                <p className="mt-1 text-xs text-stone-700">{offer.size.displayName || offer.size.size} · {offer.seller.tenant.name}</p>
                <p className="mt-1 text-sm font-bold text-[#351014]">{money(offer.price)}</p>
              </div>
            </Link>
          </li>)}
        </ul>
        <p className="mt-3 text-xs text-stone-700">Bottle prices shown. Gift packaging and delivery are priced separately.</p>
      </section>}
      <section className="mt-12 border-t border-[#dec6b6] pt-9" aria-labelledby="how-to-send-gift">
        <h2 id="how-to-send-gift" className="font-serif text-3xl font-semibold text-[#351014]">How to send a gift</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          <li><PiGift size={24} aria-hidden className="text-[#7c1d1d]" /><h3 className="mt-2 font-bold">Choose a drink</h3><p className="mt-1 text-sm leading-6 text-stone-700">Pick the bottle, size and seller, then select Send as a gift.</p></li>
          <li><PiNotePencil size={24} aria-hidden className="text-[#7c1d1d]" /><h3 className="mt-2 font-bold">Make it personal</h3><p className="mt-1 text-sm leading-6 text-stone-700">Add a note and choose gift packaging when available. Enter the recipient’s contact and delivery address at checkout.</p></li>
          <li><PiMapPin size={24} aria-hidden className="text-[#7c1d1d]" /><h3 className="mt-2 font-bold">Check delivery and pay</h3><p className="mt-1 text-sm leading-6 text-stone-700">Review the delivery fee and total. You can request a date and the team will confirm the timing.</p></li>
        </ol>
      </section>
      <GiftDeliveryQuestions />
    </div>
  </div>;
}

function GiftDeliveryQuestions() {
  return <section className="mt-10 border-t border-[#dec6b6] pt-9" aria-labelledby="gift-delivery-questions">
    <h2 id="gift-delivery-questions" className="font-serif text-3xl font-semibold text-[#351014]">Gift delivery in Abuja</h2>
    <div className="mt-3 max-w-3xl divide-y divide-[#dec6b6] text-sm leading-6">
      <details className="py-3">
        <summary className={`cursor-pointer font-semibold ${focus}`}>Can I send a drink directly to someone?</summary>
        <p className="mt-2">Yes. Use their address and phone for the handover and your own contact details for order updates. An adult aged 18 or over must receive alcoholic gifts.</p>
      </details>
      <details className="py-3">
        <summary className={`cursor-pointer font-semibold ${focus}`}>Can I choose the delivery date?</summary>
        <p className="mt-2">Request a date from tomorrow onward. The team confirms the timing. For a fixed deadline, check with us before paying. See <Link href="/delivery/abuja" className="font-semibold text-[#7c1d1d] underline">Abuja delivery areas and timing</Link>.</p>
      </details>
      <details className="py-3">
        <summary className={`cursor-pointer font-semibold ${focus}`}>Can you put together a hamper or a corporate gift order?</summary>
        <p className="mt-2"><a href="#occasion-chat" className="font-semibold text-[#7c1d1d] underline">Send us your gift brief</a> with your budget, delivery area and date. You can also read our <Link href="/occasions/gifting/hampers" className="font-semibold text-[#7c1d1d] underline">drinks hamper guide</Link> or <Link href="/occasions/gifting/corporate-gifts" className="font-semibold text-[#7c1d1d] underline">corporate drinks gifting guide</Link>.</p>
      </details>
    </div>
  </section>;
}
