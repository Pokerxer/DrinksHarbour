'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import { gtagEvent } from '@/lib/gtag';
import { readOfferProduct } from './catalogue';
import { offerIdentity, productId, purchasableOffers, type Offer } from './offers';

export function useAddSuggestedOffers() {
  const { cartState, addToCart } = useCart();
  const { location, revision } = useShoppingLocation();
  const request = useRef<AbortController | null>(null);
  const cart = useRef(cartState.cartArray);
  cart.current = cartState.cartArray;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [offerRevision, refreshOffers] = useState(0);

  useEffect(() => () => request.current?.abort(), [revision]);

  async function add(offers: Offer[], source: string) {
    if (request.current || offers.length === 0) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage('');
    try {
      const checked = await Promise.all(offers.map(async offer => {
        const product = await readOfferProduct(offer.product.slug, { location, signal: controller.signal });
        const current = product && purchasableOffers(product).find(row => offerIdentity(row) === offerIdentity(offer));
        if (!current || current.price !== offer.price) throw new Error('Offer changed');
        return current;
      }));
      if (controller.signal.aborted) return;
      if (checked.some(offer => cart.current.some(item => (item.selectedProductId || productId(item)) === productId(offer.product)))) {
        setMessage('An item is already in your cart.');
        refreshOffers(value => value + 1);
        return;
      }
      for (const { product, seller, size, price } of checked) {
        // This offer identifies the exact size even when a seller has two
        // variants with the same display size. Cart pricing reads this listing.
        const selectedProduct = { ...product, price, availableAt: [{ ...seller, sizes: [size] }] };
        addToCart(selectedProduct, size.size, [size.colorName, size.optionName].filter(Boolean).join(' · '),
          seller.tenant.name, seller.tenant._id, 1, size._id, seller._id, size.displayName);
      }
      gtagEvent('merchandising_add', {
        source, value: checked.reduce((sum, offer) => sum + offer.price, 0), currency: 'NGN',
        items: checked.map(offer => ({ item_id: productId(offer.product), item_variant: offer.size._id, offer_id: offerIdentity(offer), price: offer.price, quantity: 1 })),
      });
      setMessage(checked.length === 1 ? 'Added to your cart.' : 'Selected items added to your cart.');
    } catch {
      if (!controller.signal.aborted) {
        setMessage('The price or stock changed. Check the updated offers before adding again.');
        refreshOffers(value => value + 1);
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return { add, busy, message, offerRevision };
}
