// client/apps/platform/src/components/Product/Detail/BoughtTogether.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { gtagEvent, viewItemListEvent, type GTagItem } from '@/lib/gtag';
import { useCart } from '@/context/CartContext';
import { cardPrice, useMerchandising, type MerchandisingProduct } from '@/components/Merchandising/useMerchandising';
import type { ProductType } from '@/types/product.types';

interface BoughtTogetherProps {
  product: ProductType;
}

/** null when any component price is unknown — never show a wrong total. */
export const sumBundlePrice = (
  base: number | null,
  selected: MerchandisingProduct[]
): number | null => {
  if (base === null) return null;
  let total = base;
  for (const item of selected) {
    const price = cardPrice(item);
    if (price === null) return null;
    total += price;
  }
  return total;
};

/**
 * "Complete the purchase" bundle: the page product (always in) plus up to 2
 * complements from the bought-together tier, one add-to-cart CTA. Hides when
 * the payload can't form a bundle (spec §error handling).
 */
const BoughtTogether: React.FC<BoughtTogetherProps> = ({ product }) => {
  const { data } = useMerchandising(product?._id, 'pdp');
  const { addToCart } = useCart();
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});

  const complements = useMemo(
    () => (data?.boughtTogether ?? []).slice(0, 2) as MerchandisingProduct[],
    [data]
  );

  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current || complements.length === 0) return;
    viewedRef.current = true;
    viewItemListEvent({
      item_list_id: 'bought_together',
      item_list_name: 'Complete the purchase',
      items: [product, ...complements].map((p) => ({
        item_id: (p as { slug?: string }).slug,
        item_name: (p as { name?: string }).name,
      })) as GTagItem[],
    });
  }, [complements, product]);

  if (complements.length < 1) return null;

  const selected = complements.filter((c) => !unchecked[c._id]);
  const basePrice = cardPrice(product as unknown as MerchandisingProduct);
  const total = sumBundlePrice(basePrice, selected);
  const fmt = (n: number) => `₦${n.toLocaleString('en-NG')}`;

  const addSelected = () => {
    addToCart(product as ProductType);
    for (const item of selected) addToCart(item as unknown as ProductType);
    gtagEvent('add_to_cart_merchandising', {
      item_list_id: 'bought_together',
      sources: [...complements.map((c) => c.source ?? 'unknown'), 'pdp_product'],
    });
  };

  return (
    <section aria-label="Complete the purchase" className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900">Complete the purchase</h3>
      <p className="mt-1 text-sm text-gray-500">
        Customers who bought {product.name} often add these.
      </p>

      <ul className="mt-4 space-y-3">
        <li className="flex items-center gap-3">
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded bg-emerald-600 text-[11px] font-bold text-white">✓</span>
          <Image
            src={product.images?.[0]?.url ?? '/placeholder.svg'}
            alt={product.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-lg object-cover"
          />
          <Link href={`/product/${product.slug}`} className="text-sm font-medium text-gray-900 hover:underline">
            {product.name}
          </Link>
          <span className="ml-auto text-sm font-semibold text-gray-900">
            {basePrice !== null ? fmt(basePrice) : '—'}
          </span>
        </li>

        {complements.map((c) => (
          <li key={c._id} className="flex items-center gap-3">
            <input
              type="checkbox"
              aria-label={`Include ${c.name}`}
              checked={!unchecked[c._id]}
              onChange={() =>
                setUnchecked((prev) => ({ ...prev, [c._id]: !prev[c._id] }))
              }
              className="h-5 w-5 rounded border-gray-300 text-emerald-600"
            />
            <Image
              src={c.images?.[0]?.url ?? '/placeholder.svg'}
              alt={c.name}
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg object-cover"
            />
            <Link href={`/product/${c.slug}`} className="text-sm font-medium text-gray-900 hover:underline">
              {c.name}
            </Link>
            <span className="ml-auto text-sm font-semibold text-gray-900">
              {cardPrice(c) !== null ? fmt(cardPrice(c) as number) : '—'}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-sm text-gray-600">
          Total{' '}
          <strong className="text-base text-gray-900">
            {total !== null ? fmt(total) : 'varies by seller'}
          </strong>
        </span>
        <button
          type="button"
          onClick={addSelected}
          disabled={selected.length === 0}
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Add selected to cart
        </button>
      </div>
    </section>
  );
};

export default BoughtTogether;
