// What a held order becomes when a cashier recalls it.
//
// The recall handler used to build its cart lines inline in JSX, reading five
// of the fields the server sends and dropping the rest, under a comment that
// said "skip price 0 placeholders; the grid re-prices them". It skipped
// nothing and re-priced nothing — that was a claim about code that did not
// exist, matching a claim on the server side about code that did not exist
// either. The result was a cart of ₦0.00 lines.
//
// The server half is fixed and tested (`server/__tests__/posHoldRecallRoundTrip.test.js`).
// This is the client half, extracted out of the component so it can be asserted
// on at all: admin vitest is `environment: 'node'` with no jsdom, so a mapping
// that lives inside JSX is untestable by construction — the same reason
// `pos-sales-order-lines.ts` exists.
//
// The failure mode is a plausible cart, not an error. So these assert field by
// field on the line that comes out.

import { describe, expect, test } from 'vitest';
import { recallCartToItems } from './pos-recall-cart-lines';
import type { POSRecallCart } from '../types';

const SP = '651111111111111111111111';
const PROD = '653333333333333333333333';
const SIZE = '652222222222222222222222';

function line(over: Partial<POSRecallCart['items'][0]> = {}) {
  return {
    subProductId: SP,
    productId: PROD,
    sizeId: SIZE,
    name: 'Hennessy VS',
    variant: '75cl',
    sku: 'SKU-1',
    price: 4000,
    quantity: 3,
    discount: 15,
    costPrice: 3000,
    ...over,
  };
}

function cart(over: Partial<POSRecallCart> = {}): POSRecallCart {
  return {
    items: [line()],
    customer: { firstName: 'Ada', lastName: 'Obi', email: '', phone: '' },
    note: 'back in 5',
    discountType: 'percent',
    discountValue: 0,
    ...over,
  } as POSRecallCart;
}

describe('recallCartToItems', () => {
  test('carries the held price and discount into the cart', () => {
    const [item] = recallCartToItems(cart());

    expect(item.price).toBe(4000);
    expect(item.discount).toBe(15);
  });

  test('carries the identity and display fields', () => {
    const [item] = recallCartToItems(cart());

    expect(item.subProductId).toBe(SP);
    expect(item.productId).toBe(PROD);
    expect(item.sizeId).toBe(SIZE);
    expect(item.name).toBe('Hennessy VS');
    expect(item.variant).toBe('75cl');
    expect(item.sku).toBe('SKU-1');
    expect(item.quantity).toBe(3);
  });

  test('carries costPrice, which markup_on_cost bundle pricing needs', () => {
    const [item] = recallCartToItems(cart());

    expect(item.costPrice).toBe(3000);
  });

  test('keeps a recalled combo grouped', () => {
    const comboRef = { comboId: 'c1', comboName: 'Party Pack', instanceId: 'abc123' };
    const [item] = recallCartToItems(cart({ items: [line({ comboRef })] }));

    expect(item.comboRef).toEqual(comboRef);
  });

  test('a line from a hold parked before the server fix does not become NaN', () => {
    // Legacy holds carry no price, discount or cost. Those must land as 0 — an
    // absent field multiplied by a quantity is NaN, and `formatCurrency` renders
    // NaN as the literal string "₦NaN" rather than failing.
    const legacy = {
      subProductId: SP,
      productId: PROD,
      name: 'Product',
      variant: '',
      sku: '',
      quantity: 2,
    };
    const [item] = recallCartToItems(cart({ items: [legacy] as never }));

    expect(item.price).toBe(0);
    expect(item.discount).toBe(0);
    expect(item.quantity).toBe(2);
    expect(Number.isFinite(item.price * item.quantity)).toBe(true);
  });

  test('a cart with no items maps to no lines', () => {
    expect(recallCartToItems(cart({ items: [] }))).toEqual([]);
    expect(recallCartToItems(undefined as never)).toEqual([]);
  });
});
