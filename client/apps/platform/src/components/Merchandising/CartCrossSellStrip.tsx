// client/apps/platform/src/components/Merchandising/CartCrossSellStrip.tsx
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { gtagEvent, viewItemListEvent, type GTagItem } from '@/lib/gtag';
import { useCart, getEffectiveUnitPrice, type CartItem } from '@/context/CartContext';
import { cardPrice, useMerchandising, type MerchandisingProduct } from './useMerchandising';
import type { ProductType } from '@/types/product.types';

interface CartLine {
  _id?: string;
  id?: string;
  quantity: number;
}

/** The cart's "primary" product drives the recommendation: highest line value. */
export const pickPrimaryLine = <T extends CartLine>(items: T[]): T | undefined =>
  items.reduce<T | undefined>((best, item) => {
    const value = getEffectiveUnitPrice(item as never) * (item.quantity || 1);
    const bestValue = best
      ? getEffectiveUnitPrice(best as never) * (best.quantity || 1)
      : -1;
    return value > bestValue ? item : best;
  }, undefined);

export const excludable = (ids: string[], cartIds: string[]): string[] => {
  const inCart = new Set(cartIds);
  return ids.filter((id) => !inCart.has(id));
};

/** "Goes well with what's in your cart" — hides itself when empty (spec §UI). */
const CartCrossSellStrip: React.FC = () => {
  // useCart() keeps the lines under `cartState.cartArray`; the test double and
  // historical call sites expose `cartArray` directly. Accept both shapes.
  const cart = useCart() as unknown as {
    cartState?: { cartArray: CartItem[] };
    cartArray?: CartItem[];
    addToCart: (product: ProductType) => void;
  };
  const cartArray = cart.cartState?.cartArray ?? cart.cartArray ?? [];
  const { addToCart } = cart;

  const primary = pickPrimaryLine(cartArray);
  const { data } = useMerchandising(primary?._id ?? primary?.id, 'cart');

  // Hook-order discipline: all hooks run before the hide-when-empty early
  // returns below, so `suggestions` lives in a memo over the same inputs.
  const suggestions = useMemo(() => {
    if (!cartArray.length || !data) return [] as MerchandisingProduct[];
    const cartIds = cartArray.map((i) => (i as { _id?: string })._id).filter(Boolean) as string[];
    return excludable(
      data.crossSells.map((p) => p._id),
      cartIds
    )
      .map((id) => data.crossSells.find((p) => p._id === id))
      .filter((p): p is MerchandisingProduct => !!p && cardPrice(p) !== null)
      .slice(0, 4);
  }, [cartArray, data]);

  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current || suggestions.length === 0) return;
    viewedRef.current = true;
    viewItemListEvent({
      item_list_id: 'cart_cross_sell',
      item_list_name: 'Goes well with your cart',
      items: suggestions.map((p) => ({
        item_id: p.slug,
        item_name: p.name,
      })) as GTagItem[],
    });
  }, [suggestions]);

  if (!cartArray.length || !data) return null;

  if (suggestions.length === 0) return null;
  const fmt = (n: number) => `₦${n.toLocaleString('en-NG')}`;

  return (
    <section aria-label="Goes well with your cart" className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <h2 className="text-base font-semibold text-gray-900">Goes well with what&apos;s in your cart</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {suggestions.map((p) => (
          <div key={p._id} className="flex flex-col items-start gap-2 rounded-xl bg-gray-50 p-3">
            <Image
              src={p.images?.[0]?.url ?? '/placeholder.svg'}
              alt={p.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-lg object-cover"
            />
            <Link href={`/product/${p.slug}`} className="text-sm font-medium text-gray-900 hover:underline">
              {p.name}
            </Link>
            <span className="text-sm font-semibold text-gray-900">{fmt(cardPrice(p) as number)}</span>
            <button
              type="button"
              onClick={() => {
                addToCart(p as unknown as ProductType);
                gtagEvent('add_to_cart_merchandising', {
                  item_list_id: 'cart_cross_sell',
                  sources: [p.source ?? 'unknown'],
                });
              }}
              className="mt-auto w-full rounded-full border border-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-900 transition hover:bg-gray-900 hover:text-white"
            >
              Quick add
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CartCrossSellStrip;
