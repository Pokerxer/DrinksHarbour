// The rule this file exists to protect: ONE purchasable offer
// (selectedSubProductId + selectedSizeId) is ONE cart line. The legacy
// cartItemId string (productId-size-vendor-color) is cosmetic — the ~10
// add-to-cart call sites build it from different inputs (Product Detail and
// merchandising send the joined "colorName · optionName", cards send '',
// the server persists colorName only), so identical offers drifted into
// DUPLICATE lines in the cart — the 2026-11-13 /platform duplication report.
import { describe, expect, it } from 'vitest';
import { cartReducer, type CartItem } from './CartContext';

const product = {
  _id: 'prod1',
  name: 'Sunblessed Vinho Branco',
  slug: 'sunblessed-vinho-branco',
  price: 12200,
} as any;

const line = (over: Partial<CartItem> = {}): CartItem =>
  ({
    ...product,
    cartItemId: 'prod1-75cl-Greenlabel-default',
    quantity: 1,
    selectedSize: '75cl',
    selectedColor: 'Greenlabel',
    selectedVendor: 'Greenlabel',
    selectedVendorId: 'tenant1',
    selectedSizeId: 'size1',
    selectedSubProductId: 'sub1',
    selectedProductId: 'prod1',
    price: 12200,
    addedAt: 1,
    ...over,
  }) as CartItem;

const add = (over: Record<string, unknown> = {}) =>
  ({
    type: 'ADD_TO_CART',
    payload: {
      product,
      size: '75cl',
      color: 'Greenlabel',
      vendor: 'Greenlabel',
      vendorId: 'tenant1',
      quantity: 1,
      sizeId: 'size1',
      subProductId: 'sub1',
      ...over,
    },
  }) as any;

describe('cart line identity', () => {
  it('merges an add whose cosmetic id string drifted from the stored line (same offer)', () => {
    // The persisted line was written by the server scheme ("colorName" only);
    // the incoming add carries the joined "colorName · optionName" the detail
    // page sends — same subProductId+sizeId, different cartItemId.
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-Greenlabel-default', selectedColor: 'Greenlabel' })] };
    const next = cartReducer(state, add({ color: 'Greenlabel · Brut', size: '75cl' }));
    expect(next.cartArray).toHaveLength(1);
    expect(next.cartArray[0].quantity).toBe(2);
    // The surviving line adopts the incoming (canonical, client-side) id —
    // `pid-size-vendor-color` with THIS add path's strings — so the next
    // id-based lookup for THIS add path hits.
    expect(next.cartArray[0].cartItemId).toBe('prod1-75cl-Greenlabel-Greenlabel · Brut');
  });

  it('merges an add whose size label drifted (raw code vs displayName)', () => {
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-Greenlabel-default' })] };
    const next = cartReducer(state, add({ size: '750ml' }));
    expect(next.cartArray).toHaveLength(1);
    expect(next.cartArray[0].quantity).toBe(2);
  });

  it('still separates genuinely different offers (different sizeId)', () => {
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-Greenlabel-default', selectedSizeId: 'size1' })] };
    const next = cartReducer(state, add({ sizeId: 'size2', subProductId: 'sub1' }));
    expect(next.cartArray).toHaveLength(2);
  });

  it('still separates different subproducts (two sellers, same sizeId string)', () => {
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-SellerA-default', selectedSubProductId: 'sub1', selectedSizeId: 'size1' })] };
    const next = cartReducer(state, add({ subProductId: 'sub9', sizeId: 'size1' }));
    expect(next.cartArray).toHaveLength(2);
  });

  it('does not collapse the gift-packaging flag into a different product line', () => {
    // Gift packaging is its own SKU (own subProductId) — a drink line and the
    // packaging line must stay separate even when other fields match.
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-SellerA-default', selectedSubProductId: 'sub1' })] };
    const next = cartReducer(state, add({ subProductId: 'sub-gift', sizeId: 'size1' }));
    expect(next.cartArray).toHaveLength(2);
  });

  it('legacy lines without size/sub ids keep the id-only behaviour', () => {
    // Stored id must equal what generateCartItemId produces for the incoming
    // add (pid-size-vendor-color with the add's strings) for the legacy path
    // to merge.
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-Greenlabel-Greenlabel', selectedSizeId: '' as any, selectedSubProductId: '' as any })] };
    const next = cartReducer(state, add({ sizeId: '', subProductId: '' }));
    expect(next.cartArray).toHaveLength(1);
    expect(next.cartArray[0].quantity).toBe(2);
  });

  it('collapses drift-duplicated lines already in a stored cart on load', () => {
    // A cart saved while the bug was live contains BOTH schemes for one offer.
    const polluted = [
      line({ cartItemId: 'prod1-75cl-Greenlabel-default', quantity: 3, price: 12200 }),
      line({ cartItemId: 'prod1-75cl-Greenlabel · Brut-Greenlabel-default', quantity: 2, selectedColor: 'Greenlabel · Brut' }),
      line({ cartItemId: 'other-line', selectedSubProductId: 'sub2', selectedSizeId: 'size9', quantity: 1 }),
    ];
    const next = cartReducer({ cartArray: polluted }, { type: 'LOAD_CART', payload: polluted } as any);
    expect(next.cartArray).toHaveLength(2);
    const merged = next.cartArray.find(i => i.selectedSubProductId === 'sub1');
    expect(merged?.quantity).toBe(5);
  });

  it('load dedupe keeps the first line (fresh server pricing) and never resumses identical payloads', () => {
    const clean = [line({ quantity: 2 })];
    const once = cartReducer({ cartArray: clean }, { type: 'LOAD_CART', payload: clean } as any);
    expect(once.cartArray).toHaveLength(1);
    expect(once.cartArray[0].quantity).toBe(2);
  });
});
