import { describe, expect, test } from 'vitest';
import {
  CART_EXPIRY_DAYS,
  applyValidationTo,
  cartCount,
  cartItemId,
  cartReducer,
  cartTotal,
  effectiveUnitPrice,
  isCartExpired,
  storageKeyFor,
  toCartLine,
  toServerItems,
} from './cart-core.ts';

/**
 * The pure half of the web's `CartContext.tsx` (742 lines). Everything here is
 * transcribed from it; the React provider, AsyncStorage and the network live in
 * their own files so that all of this is exercised in vitest's `node`
 * environment.
 */

const PRODUCT = {
  _id: 'prod1',
  slug: 'lagavulin-16',
  name: 'Lagavulin 16',
  primaryImage: { url: 'https://cdn/lag.jpg' },
  availableAt: [
    {
      _id: 'sub1',
      tenant: { _id: 'ten1', name: 'Wyn City' },
      sizes: [
        { _id: 'size70', size: '70cl', stock: 8, pricing: { websitePrice: 52000 } },
        {
          _id: 'size100',
          size: '100cl',
          stock: 4,
          pricing: { websitePrice: 70000, packUnitPrice: 66000, packThreshold: 6 },
        },
      ],
    },
  ],
};

const line = (over = {}) => ({
  cartItemId: 'prod1-70cl-Wyn City-default',
  productId: 'prod1',
  slug: 'lagavulin-16',
  name: 'Lagavulin 16',
  imageUrl: 'https://cdn/lag.jpg',
  subProductId: 'sub1',
  sizeId: 'size70',
  tenantId: 'ten1',
  vendorName: 'Wyn City',
  size: '70cl',
  quantity: 1,
  price: 52000,
  packUnitPrice: null,
  packThreshold: null,
  addedAt: 1000,
  ...over,
});

describe('cartItemId', () => {
  test('is the web\'s four-part key, so the same bottle collapses to one line', () => {
    expect(cartItemId('prod1', '70cl', 'Wyn City', '')).toBe('prod1-70cl-Wyn City-default');
  });

  test('substitutes "default" for every empty part, as the web does', () => {
    expect(cartItemId('prod1', '', '', '')).toBe('prod1-default-default-default');
  });

  test('a different size is a DIFFERENT line', () => {
    expect(cartItemId('prod1', '70cl', 'V', '')).not.toBe(cartItemId('prod1', '100cl', 'V', ''));
  });

  test('the same bottle from a different tenant is a different line', () => {
    expect(cartItemId('prod1', '70cl', 'A', '')).not.toBe(cartItemId('prod1', '70cl', 'B', ''));
  });
});

describe('storageKeyFor', () => {
  test('is per identity — a shared device must never show one user another\'s cart', () => {
    expect(storageKeyFor('u1')).toBe('drinksharbour_cart:u1');
    expect(storageKeyFor(null)).toBe('drinksharbour_cart:guest');
  });
});

describe('toCartLine', () => {
  test('resolves vendor, size and BOTH ids from one availableAt entry', () => {
    // The pairing rule: a subProductId without its sizeId reads as "Out of
    // Stock" at validation. commerce-core owns that rule for both apps.
    const result = toCartLine(PRODUCT, { size: '70cl', quantity: 2, now: 1000 });

    expect(result).toEqual(line({ quantity: 2 }));
  });

  test('carries pack pricing when the chosen size has it', () => {
    const result = toCartLine(PRODUCT, { size: '100cl', quantity: 1, now: 1000 });

    expect(result.packUnitPrice).toBe(66000);
    expect(result.packThreshold).toBe(6);
  });

  test('falls back to the first in-stock size when none is asked for', () => {
    expect(toCartLine(PRODUCT, { now: 1000 }).size).toBe('70cl');
  });

  test('is null for a product no tenant stocks — better no line than a broken one', () => {
    expect(toCartLine({ _id: 'p', name: 'x', availableAt: [] }, { now: 1 })).toBeNull();
    expect(toCartLine({ _id: 'p', name: 'x' }, { now: 1 })).toBeNull();
  });

  test('defaults quantity to 1', () => {
    expect(toCartLine(PRODUCT, { now: 1000 }).quantity).toBe(1);
  });
});

describe('effectiveUnitPrice', () => {
  test('is the ordinary price below the pack threshold', () => {
    expect(effectiveUnitPrice(line({ price: 70000, packUnitPrice: 66000, packThreshold: 6, quantity: 5 })))
      .toBe(70000);
  });

  test('becomes the pack price AT the threshold', () => {
    expect(effectiveUnitPrice(line({ price: 70000, packUnitPrice: 66000, packThreshold: 6, quantity: 6 })))
      .toBe(66000);
  });

  test('ignores a pack price with no threshold', () => {
    expect(effectiveUnitPrice(line({ price: 70000, packUnitPrice: 66000, packThreshold: null, quantity: 99 })))
      .toBe(70000);
  });
});

describe('cartReducer', () => {
  const state = { lines: [line()] };

  test('ADD merges into an existing line rather than duplicating it', () => {
    const next = cartReducer(state, { type: 'ADD', line: line({ quantity: 2, addedAt: 2000 }) });

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0].quantity).toBe(3);
    expect(next.lines[0].addedAt).toBe(2000);
  });

  test('ADD appends a genuinely different line', () => {
    const other = line({ cartItemId: 'prod1-100cl-Wyn City-default', size: '100cl' });

    expect(cartReducer(state, { type: 'ADD', line: other }).lines).toHaveLength(2);
  });

  test('REMOVE drops the line', () => {
    expect(cartReducer(state, { type: 'REMOVE', cartItemId: line().cartItemId }).lines).toEqual([]);
  });

  test('SET_QUANTITY updates it', () => {
    const next = cartReducer(state, { type: 'SET_QUANTITY', cartItemId: line().cartItemId, quantity: 4 });

    expect(next.lines[0].quantity).toBe(4);
  });

  test('SET_QUANTITY to zero removes the line instead of keeping an empty one', () => {
    const next = cartReducer(state, { type: 'SET_QUANTITY', cartItemId: line().cartItemId, quantity: 0 });

    expect(next.lines).toEqual([]);
  });

  test('LOAD returns the SAME state object when the cart is unchanged', () => {
    // Identity matters: the mirror effect keys off `lines`, and a new array on
    // every hydrate would write to storage in a loop.
    const next = cartReducer(state, { type: 'LOAD', lines: [line()] });

    expect(next).toBe(state);
  });

  test('LOAD replaces the cart when it differs', () => {
    const next = cartReducer(state, { type: 'LOAD', lines: [line({ quantity: 9 })] });

    expect(next.lines[0].quantity).toBe(9);
  });

  test('CLEAR empties it', () => {
    expect(cartReducer(state, { type: 'CLEAR' }).lines).toEqual([]);
  });

  test('never mutates the state it was given', () => {
    const original = { lines: [line()] };
    cartReducer(original, { type: 'ADD', line: line({ quantity: 5 }) });

    expect(original.lines[0].quantity).toBe(1);
  });
});

describe('cartTotal and cartCount', () => {
  test('the total is pack-aware', () => {
    const lines = [
      line({ price: 52000, quantity: 2 }),
      line({ cartItemId: 'b', price: 70000, packUnitPrice: 66000, packThreshold: 6, quantity: 6 }),
    ];

    expect(cartTotal(lines)).toBe(52000 * 2 + 66000 * 6);
  });

  test('the count is units, not lines — that is what the badge shows', () => {
    expect(cartCount([line({ quantity: 2 }), line({ cartItemId: 'b', quantity: 3 })])).toBe(5);
  });

  test('an empty cart is 0 and 0, never NaN', () => {
    expect(cartTotal([])).toBe(0);
    expect(cartCount([])).toBe(0);
  });
});

describe('toServerItems', () => {
  test('maps a line onto the payload /api/cart/save expects', () => {
    expect(toServerItems([line({ quantity: 2 })])).toEqual([
      {
        productId: 'prod1',
        subProductId: 'sub1',
        sizeId: 'size70',
        tenantId: 'ten1',
        size: '70cl',
        vendor: 'Wyn City',
        color: '',
        quantity: 2,
        price: 52000,
      },
    ]);
  });

  test('drops lines missing either id — the server cannot price them', () => {
    expect(toServerItems([line({ subProductId: '' }), line({ sizeId: '' })])).toEqual([]);
  });
});

describe('applyValidationTo', () => {
  // Field names verified against a live POST /api/cart/validate on 2026-08-19:
  // the verdict carries BOTH `baseUnitPrice` and `currentPrice`.
  const key = 'sub1-size70';

  test('drops a line the server says is gone', () => {
    const verdict = { [key]: { subProductId: 'sub1', sizeId: 'size70', available: false, currentPrice: 0 } };

    expect(applyValidationTo([line()], verdict)).toEqual([]);
  });

  test('takes baseUnitPrice, NOT currentPrice, when both are present', () => {
    // currentPrice can already have the pack rate applied. Storing it as the
    // line's base price would let effectiveUnitPrice discount it a SECOND time
    // — the shopper would be quoted below what the server will charge.
    const verdict = {
      [key]: {
        subProductId: 'sub1', sizeId: 'size70', available: true,
        baseUnitPrice: 74100, currentPrice: 72500,
        packUnitPrice: 72500, packThreshold: 6, maxQuantity: 10,
      },
    };

    const [updated] = applyValidationTo([line({ quantity: 6 })], verdict);

    expect(updated.price).toBe(74100);
    expect(updated.packUnitPrice).toBe(72500);
    // and the pack rate is applied exactly once
    expect(effectiveUnitPrice(updated)).toBe(72500);
  });

  test('falls back to currentPrice when there is no baseUnitPrice', () => {
    const verdict = {
      [key]: { subProductId: 'sub1', sizeId: 'size70', available: true, currentPrice: 60000 },
    };

    expect(applyValidationTo([line()], verdict)[0].price).toBe(60000);
  });

  test('keeps the existing price when the server quotes nothing usable', () => {
    const verdict = {
      [key]: { subProductId: 'sub1', sizeId: 'size70', available: true, currentPrice: 0 },
    };

    expect(applyValidationTo([line()], verdict)[0].price).toBe(52000);
  });

  test('caps the quantity at maxQuantity but never raises it', () => {
    const verdict = {
      [key]: { subProductId: 'sub1', sizeId: 'size70', available: true, currentPrice: 52000, maxQuantity: 3 },
    };

    expect(applyValidationTo([line({ quantity: 9 })], verdict)[0].quantity).toBe(3);
    expect(applyValidationTo([line({ quantity: 2 })], verdict)[0].quantity).toBe(2);
  });

  test('leaves a line the server said nothing about completely alone', () => {
    const original = line();

    expect(applyValidationTo([original], {})).toEqual([original]);
  });
});

describe('isCartExpired', () => {
  const day = 24 * 60 * 60 * 1000;

  test('a cart younger than the window is kept', () => {
    expect(isCartExpired(0, 6 * day)).toBe(false);
  });

  test('a cart older than the window is dropped', () => {
    expect(isCartExpired(0, (CART_EXPIRY_DAYS + 1) * day)).toBe(true);
  });

  test('a missing savedAt is treated as expired, not as brand new', () => {
    expect(isCartExpired(0, Date.now())).toBe(true);
  });
});
