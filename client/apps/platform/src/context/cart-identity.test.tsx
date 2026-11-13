// The rule this file exists to protect: ONE purchasable offer
// (selectedSubProductId + selectedSizeId) is ONE cart line.
//
// Identity scheme (2026-11-13): `productId-size-vendor` plus a color slot
// ONLY when the line genuinely carries a colour. The platform is a beverage
// marketplace — for drinks the Size row IS the variant, colour is display
// metadata, and the old always-present `-default` colour slot (plus call
// sites synthesizing "colorName · optionName" labels) drifted identical
// offers into duplicate lines. Fashion tenant storefronts keep per-colour
// lines via the conditional slot.
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
    cartItemId: 'prod1-75cl-Wyn City',
    quantity: 1,
    selectedSize: '75cl',
    selectedColor: '',
    selectedVendor: 'Wyn City',
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
      color: '',
      vendor: 'Wyn City',
      vendorId: 'tenant1',
      quantity: 1,
      sizeId: 'size1',
      subProductId: 'sub1',
      ...over,
    },
  }) as any;

describe('cart line identity', () => {
  it('beverage adds carry no colour slot in the id', () => {
    const next = cartReducer({ cartArray: [] }, add());
    expect(next.cartArray[0].cartItemId).toBe('prod1-75cl-Wyn City');
  });

  it('fashion lines with a real colour keep the colour slot', () => {
    const next = cartReducer({ cartArray: [] }, add({ size: 'M', color: 'Emerald' }));
    expect(next.cartArray[0].cartItemId).toBe('prod1-M-Wyn City-Emerald');
  });

  it('two fashion colours are separate lines; two identical colour adds merge', () => {
    // A colour variant is its own Size row — same sizeId ⇒ same colourName.
    let state = { cartArray: [] as CartItem[] };
    state = cartReducer(state, add({ size: 'M', color: 'Emerald', sizeId: 'size-emerald' }));
    state = cartReducer(state, add({ size: 'M', color: 'Ruby', sizeId: 'size-ruby' }));
    expect(state.cartArray).toHaveLength(2);
    state = cartReducer(state, add({ size: 'M', color: 'Emerald', sizeId: 'size-emerald' }));
    expect(state.cartArray).toHaveLength(2);
    expect(state.cartArray.find(i => i.cartItemId === 'prod1-M-Wyn City-Emerald')?.quantity).toBe(2);
  });

  it('merges an add whose cosmetic id string drifted from the stored line (same offer)', () => {
    // Defense-in-depth for the drift that motivated the offer fallback: a
    // stored server line and an incoming add whose id strings differ for any
    // reason (legacy `-default` tails, vendor-name drift) but which carry the
    // same subProductId+sizeId are ONE offer.
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-Wyn City-default' })] };
    const next = cartReducer(state, add({ color: 'Greenlabel · Brut', size: '75cl' }));
    expect(next.cartArray).toHaveLength(1);
    expect(next.cartArray[0].quantity).toBe(2);
    // The surviving line adopts the incoming id so the next lookup hits.
    expect(next.cartArray[0].cartItemId).toBe('prod1-75cl-Wyn City-Greenlabel · Brut');
  });

  it('still separates genuinely different offers (different size string)', () => {
    // Different display size ⇒ different legacy id ⇒ separate lines. (Two size
    // rows sharing one display size string have merged under the string id
    // since before the offer fallback — legacy behaviour, unchanged here.)
    const state = { cartArray: [line({ selectedSizeId: 'size1' })] };
    const next = cartReducer(state, add({ size: '1L', sizeId: 'size2' }));
    expect(next.cartArray).toHaveLength(2);
  });

  it('still separates different subproducts (two sellers, same sizeId string)', () => {
    const state = { cartArray: [line({ selectedSubProductId: 'sub1' })] };
    const next = cartReducer(state, add({ subProductId: 'sub9', vendor: 'Other Seller', vendorId: 'tenant9' }));
    expect(next.cartArray).toHaveLength(2);
  });

  it('does not collapse the gift-packaging SKU into a drink line', () => {
    const state = { cartArray: [line({ selectedSubProductId: 'sub1' })] };
    const next = cartReducer(state, add({ subProductId: 'sub-gift', vendor: 'Gift Wrap Co', vendorId: 'tenant-gift' }));
    expect(next.cartArray).toHaveLength(2);
  });

  it('legacy lines without size/sub ids keep the id-only behaviour', () => {
    const state = { cartArray: [line({ cartItemId: 'prod1-75cl-Wyn City', selectedSizeId: '' as any, selectedSubProductId: '' as any })] };
    const next = cartReducer(state, add({ sizeId: '', subProductId: '' }));
    expect(next.cartArray).toHaveLength(1);
    expect(next.cartArray[0].quantity).toBe(2);
  });

  it('collapses drift-duplicated lines already in a stored cart on load', () => {
    const polluted = [
      line({ cartItemId: 'prod1-75cl-Wyn City', quantity: 3 }),
      line({ cartItemId: 'prod1-75cl-Wyn City-default', quantity: 2 }),
      line({ cartItemId: 'other-line', selectedSubProductId: 'sub2', selectedSizeId: 'size9', quantity: 1 }),
    ];
    const next = cartReducer({ cartArray: polluted }, { type: 'LOAD_CART', payload: polluted } as any);
    expect(next.cartArray).toHaveLength(2);
    const merged = next.cartArray.find(i => i.selectedSubProductId === 'sub1');
    expect(merged?.quantity).toBe(5);
  });

  it('load dedupe keeps the first line and never resumses identical payloads', () => {
    const clean = [line({ quantity: 2 })];
    const once = cartReducer({ cartArray: clean }, { type: 'LOAD_CART', payload: clean } as any);
    expect(once.cartArray).toHaveLength(1);
    expect(once.cartArray[0].quantity).toBe(2);
  });
});
