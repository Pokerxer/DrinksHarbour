'use client';

import { PiTruck, PiPlus } from 'react-icons/pi';
import styles from './merchandising.module.css';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import { readOfferProduct, searchOffers } from './catalogue';
import { deliveryOpportunity, findLiveOffer, money, productId, type DeliveryQuote, type Offer } from './offers';
import OfferRow from './OfferRow';
import { useOfferImpression } from './useOfferImpression';
import { useAddSuggestedOffers } from './useAddSuggestedOffers';

export default function DeliveryTopUp({ quote, subtotal, sellerKey }: {
  quote: DeliveryQuote;
  subtotal: number;
  sellerKey: string;
}) {
  const { cartState } = useCart();
  const { location, revision } = useShoppingLocation();
  const { add, busy, message, offerRevision } = useAddSuggestedOffers();
  const [result, setResult] = useState<{ key: string; offer: Offer } | null>(null);
  const opportunity = deliveryOpportunity(quote, subtotal);
  const gap = opportunity?.gap ?? 0;
  const saving = opportunity?.saving ?? 0;
  const itemKey = useMemo(() => cartState.cartArray.map(item => item.selectedProductId || productId(item)).sort().join(','), [cartState.cartArray]);
  const key = [gap, saving, sellerKey, itemKey, revision, offerRevision].join('|');
  useEffect(() => {
    if (!gap || !sellerKey) return;
    const controller = new AbortController();
    const request = { location, signal: controller.signal };
    const sellers = sellerKey.split(',');
    const ids = itemKey.split(',');
    const filter = { requiredSeller: true, min: gap, max: gap + saving };
    const params = new URLSearchParams({
      minPrice: String(gap), maxPrice: String(gap + saving), sort: 'price_low',
    });
    if (sellers.length === 1) params.set('tenantId', sellers[0]);
    void searchOffers(params, request).then(async candidates => {
      const eligible = candidates.filter(product => !product.isGiftPackaging && !ids.includes(productId(product)));
      const offer = await findLiveOffer(eligible, sellers, slug => readOfferProduct(slug, request), controller.signal, filter);
      if (offer && !controller.signal.aborted) setResult({ key, offer });
    }).catch(() => {});
    return () => controller.abort();
  }, [gap, saving, sellerKey, itemKey, key, location]);
  const ref = useOfferImpression<HTMLElement>('delivery_savings', opportunity?.label);
  if (!opportunity) return null;
  const offer = result?.key === key ? result.offer : null;

  const progress = Math.min(100, Math.max(0, Math.round(100 * subtotal / (subtotal + gap))));
  return (
    <section ref={ref} aria-label="Delivery savings" className={`${styles.panel} ${styles.delivery} ${styles.reveal} space-y-3`}>
      <h3 className={`${styles.title} flex items-center gap-2`}><PiTruck aria-hidden /> Delivery savings</h3>
      <div className={styles.progress} role="progressbar" aria-label="Progress toward delivery savings" aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm font-semibold text-emerald-900">
        Add {money(gap)} to qualify for {opportunity.label}.
      </p>
      <p className="text-xs text-emerald-900">Save {money(saving)} on the current delivery quote.</p>
      {offer && (
        <OfferRow offer={offer} source="delivery_top_up">
          <button type="button" disabled={busy} className={styles.button} aria-label={`Add ${offer.product.name}`}
            onClick={() => void add([offer], 'delivery_top_up')}><PiPlus aria-hidden /> Add</button>
        </OfferRow>
      )}
      <p role="status" className="text-xs text-gray-600">{busy ? 'Checking price and stock…' : message}</p>
    </section>
  );
}
