'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PiArrowRight, PiGift, PiWine } from 'react-icons/pi';
import type { ProductType } from '@/types/product.types';
import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import { useGiftPackaging } from '@/components/Checkout/CheckoutGiftSection';
import type { VendorSize } from '../Product/Detail/detail-types';
import { purchaseLimits } from '../Product/Detail/purchase-quantity';
import { gtagEvent } from '@/lib/gtag';
import { readOfferProduct } from './catalogue';
import OfferRow from './OfferRow';
import styles from './merchandising.module.css';
import { useOfferImpression } from './useOfferImpression';
import { money, offerHref, productId, purchasableOffers, type Offer } from './offers';

export function SizeUpgrade({ selected, sizes, unitPrice, onSelect }: {
  selected: VendorSize;
  sizes: VendorSize[];
  unitPrice: number;
  onSelect: (id: string) => void;
}) {
  const volume = selected.volumeMl ?? 0;
  const canCompare = volume > 0 && unitPrice > 0 && selected.currencySymbol === '₦';
  const next = canCompare ? sizes.filter(size => size._id !== selected._id &&
    (size.volumeMl ?? 0) > volume && size.price > unitPrice &&
    size.colorName === selected.colorName && size.optionName === selected.optionName &&
    size.currencySymbol === selected.currencySymbol && purchaseLimits(size).canBuy)
    .sort((a, b) => (a.volumeMl ?? 0) - (b.volumeMl ?? 0) || a.price - b.price)[0] : undefined;
  const ref = useOfferImpression<HTMLElement>('size_upgrade', next?._id);
  if (!next?.volumeMl) return null;
  return (
    <section ref={ref} aria-label="Larger bottle option" className={`${styles.panel} ${styles.reveal} space-y-3`}>
      <h3 className={styles.title}>Go up to {next.displayName || next.size}</h3>
      <dl className="grid grid-cols-2 divide-x divide-[#ead9df] rounded-xl border border-[#ead9df] bg-white">
        <div className="min-w-0 p-2.5">
          <dt className="text-xs text-gray-600">{selected.displayName || selected.size}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">{money(unitPrice * 100 / volume)} <span className="text-xs font-normal">/ 100 ml</span></dd>
        </div>
        <div className="min-w-0 p-2.5">
          <dt className="text-xs text-gray-600">{next.displayName || next.size}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[#781934]">{money(next.price * 100 / next.volumeMl)} <span className="text-xs font-normal">/ 100 ml</span></dd>
        </div>
      </dl>
      <button type="button" className={`${styles.button} w-full sm:w-auto`}
        onClick={() => {
          onSelect(next._id);
          gtagEvent('merchandising_select', { source: 'size_upgrade', offer_id: next._id });
        }}>Select size · {money(next.price - unitPrice)} more <PiArrowRight aria-hidden /></button>
    </section>
  );
}

function comparisonReason(current: ProductType, candidate: ProductType) {
  const currentAge = current.age ?? parseInt(current.ageStatement ?? '', 10);
  const nextAge = candidate.age ?? parseInt(candidate.ageStatement ?? '', 10);
  if (currentAge > 0 && nextAge > currentAge) return `${candidate.ageStatement || `${nextAge} years`} age statement`;
  if (candidate.caskType && current.caskType && candidate.caskType.toLowerCase() !== current.caskType.toLowerCase()) {
    return `Cask type: ${candidate.caskType}`;
  }
  if (candidate.style && current.style && candidate.style !== current.style) return `Style: ${candidate.style.replace(/_/g, ' ')}`;
  return null;
}

export function PremiumOffer({ product, related, sellerId, unitPrice, volume }: {
  product: ProductType;
  related: ProductType[];
  sellerId: string;
  unitPrice: number;
  volume?: number;
}) {
  const { location, revision } = useShoppingLocation();
  const [offer, setOffer] = useState<{ offer: Offer; reason: string } | null>(null);
  useEffect(() => {
    setOffer(null);
    if (!volume || unitPrice <= 0 || !product.type) return;
    const controller = new AbortController();
    const candidates = related.filter(candidate => productId(candidate) !== productId(product) &&
      candidate.slug && candidate.type === product.type &&
      (!candidate.priceRange || (candidate.priceRange.max > unitPrice && candidate.priceRange.min <= unitPrice * 1.5)),
    ).slice(0, 3);
    void Promise.all(candidates.map(candidate =>
      readOfferProduct(candidate.slug, { location, signal: controller.signal }).catch(() => null),
    )).then(products => {
      if (controller.signal.aborted) return;
      const matches = products.flatMap(candidate => {
        if (!candidate || candidate.type !== product.type ||
          (product.subType && candidate.subType && product.subType !== candidate.subType)) return [];
        const reason = comparisonReason(product, candidate);
        return reason ? purchasableOffers(candidate).filter(item =>
          item.volume === volume && item.price > unitPrice && item.price <= unitPrice * 1.5,
        ).map(offer => ({ offer, reason })) : [];
      });
      matches.sort((a, b) =>
        Number(b.offer.seller.tenant._id === sellerId) - Number(a.offer.seller.tenant._id === sellerId) ||
        a.offer.price - b.offer.price);
      setOffer(matches[0] ?? null);
    });
    return () => controller.abort();
  }, [product, related, sellerId, unitPrice, volume, location, revision]);

  if (!offer) return null;
  return (
    <section aria-label="A premium step up" className={`${styles.panel} space-y-3`}>
      <h3 className={`${styles.title} flex items-center gap-2`}><PiWine aria-hidden /> A premium step up</h3>
      <OfferRow offer={offer.offer} source="premium_step_up" detail={`${offer.reason} · ${money(offer.offer.price - unitPrice)} more per bottle`}>
        <Link href={offerHref(offer.offer)}
          className={styles.button}
          onClick={() => gtagEvent('merchandising_select', { source: 'premium_step_up' })}>View bottle <PiArrowRight aria-hidden /></Link>
      </OfferRow>
    </section>
  );
}

export function GiftOffer({ disabled, onGift }: { disabled: boolean; onGift: () => void }) {
  const packaging = useGiftPackaging();
  const ref = useOfferImpression<HTMLDivElement>('gift', 'product_gift');
  return (
    <div ref={ref} className={`${styles.panel} flex flex-wrap items-center justify-between gap-3`}>
      <div>
        <p className={`${styles.title} flex items-center gap-2`}><PiGift aria-hidden /> Sending a gift?</p>
        <p className="mt-1 text-xs text-gray-600">
          Write a personal note in your cart.
          {packaging.price !== null && ` Optional gift packaging costs ${money(packaging.price)}.`}
        </p>
      </div>
      <button type="button" disabled={disabled} onClick={onGift}
        className={styles.button}>Send as a gift</button>
    </div>
  );
}
