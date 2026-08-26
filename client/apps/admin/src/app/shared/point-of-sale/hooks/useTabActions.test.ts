import { describe, expect, it } from 'vitest';
import {
  findHeldTab,
  tabToRecallCart,
  type HeldOrderWithCart,
} from './useTabActions';

function held(over: Partial<HeldOrderWithCart> = {}): HeldOrderWithCart {
  return {
    _id: 'tab-1',
    orderNumber: 'H-1',
    itemCount: 2,
    customer: 'Walk-in Customer',
    note: '',
    createdAt: '2026-08-26T10:00:00Z',
    ...over,
  };
}

describe('findHeldTab', () => {
  const orders = [held({ _id: 'a' }), held({ _id: 'b' })];

  it('locates the hold backing a table tab', () => {
    expect(findHeldTab(orders, 'b')?._id).toBe('b');
  });

  it('answers undefined for an unknown or absent tab id', () => {
    expect(findHeldTab(orders, 'nope')).toBeUndefined();
    expect(findHeldTab(orders, null)).toBeUndefined();
    expect(findHeldTab(orders, undefined)).toBeUndefined();
  });
});

describe('tabToRecallCart', () => {
  it('maps the snapshot with defaults for missing customer fields', () => {
    const cart = tabToRecallCart({
      cartItems: [{ subProductId: 'sp1', productId: 'p1', quantity: 2 }],
      discountType: 'fixed',
      discountValue: 500,
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.customer).toEqual({
      firstName: 'Walk-in',
      lastName: 'Customer',
      email: '',
      phone: '',
    });
    expect(cart.note).toBe('');
    expect(cart.discountType).toBe('fixed');
    expect(cart.discountValue).toBe(500);
    expect(cart.pricelistId).toBeNull();
  });

  it('falls back to percent/0 when the snapshot has no discount', () => {
    const cart = tabToRecallCart({});
    expect(cart.discountType).toBe('percent');
    expect(cart.discountValue).toBe(0);
    expect(cart.items).toEqual([]);
  });

  it('passes partial customer fields through instead of clobbering them', () => {
    const cart = tabToRecallCart({
      customer: { firstName: 'Ada', phone: '080' },
    });
    expect(cart.customer.firstName).toBe('Ada');
    expect(cart.customer.lastName).toBe('Customer');
    expect(cart.customer.phone).toBe('080');
  });
});
