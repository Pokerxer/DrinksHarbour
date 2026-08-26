import { describe, expect, it } from 'vitest';
import { reparkRequest, reparkSignature } from './useTabAutoRepark';
import type { CartTableBinding, POSCartItem } from '../types';

function item(over: Partial<POSCartItem> = {}): POSCartItem {
  return {
    subProductId: 'sp-1',
    productId: 'p-1',
    name: 'Beer',
    variant: '',
    sku: 'SKU1',
    price: 500,
    quantity: 2,
    discount: 0,
    stock: 10,
    ...over,
  };
}

const binding: CartTableBinding = {
  tableId: 'table-1',
  name: 'T1',
  guests: 3,
  heldOrderId: 'hold-9',
};

const baseState = {
  token: 'tok',
  items: [item()],
  customer: {
    customerId: 'cust-1',
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@x.ng',
    phone: '080',
  },
  note: 'no ice',
  discountType: 'percent' as const,
  discountValue: 10,
  binding,
};

describe('reparkRequest', () => {
  it('refuses to park without a token', () => {
    expect(reparkRequest({ ...baseState, token: undefined })).toBeNull();
  });

  it('refuses to park without a table binding', () => {
    expect(reparkRequest({ ...baseState, binding: null })).toBeNull();
  });

  it('refuses to park a legacy persisted binding with no held order id', () => {
    const legacy = { tableId: binding.tableId, name: binding.name };
    expect(
      reparkRequest({ ...baseState, binding: legacy as CartTableBinding })
    ).toBeNull();
  });

  it('refuses to park an empty cart over the tab', () => {
    expect(reparkRequest({ ...baseState, items: [] })).toBeNull();
  });

  it('mirrors the hold flow payload shape', () => {
    const req = reparkRequest(baseState);
    expect(req).toEqual({
      token: 'tok',
      heldOrderId: 'hold-9',
      body: {
        items: baseState.items,
        customer: {
          customerId: 'cust-1',
          firstName: 'Ada',
          lastName: 'Obi',
          email: 'ada@x.ng',
          phone: '080',
        },
        note: 'no ice',
        discountType: 'percent',
        discountValue: 10,
      },
    });
  });

  it('omits customerId for a walk-in customer', () => {
    const { customer, ...rest } = baseState;
    const req = reparkRequest({
      ...rest,
      customer: { ...customer, customerId: undefined },
    });
    expect(req?.body.customer).not.toHaveProperty('customerId');
  });
});

describe('reparkSignature', () => {
  it('is stable for unchanged cart state', () => {
    expect(reparkSignature(reparkRequest(baseState)!)).toBe(
      reparkSignature(reparkRequest(baseState)!)
    );
  });

  it('changes when quantities change', () => {
    const changed = { ...baseState, items: [item({ quantity: 3 })] };
    expect(reparkSignature(reparkRequest(changed)!)).not.toBe(
      reparkSignature(reparkRequest(baseState)!)
    );
  });

  it('changes when prices change', () => {
    const changed = { ...baseState, items: [item({ price: 600 })] };
    expect(reparkSignature(reparkRequest(changed)!)).not.toBe(
      reparkSignature(reparkRequest(baseState)!)
    );
  });

  it('changes when the note changes', () => {
    expect(
      reparkSignature(reparkRequest({ ...baseState, note: 'extra ice' })!)
    ).not.toBe(reparkSignature(reparkRequest(baseState)!));
  });

  it('changes when the discount changes', () => {
    expect(
      reparkSignature(reparkRequest({ ...baseState, discountValue: 20 })!)
    ).not.toBe(reparkSignature(reparkRequest(baseState)!));
  });

  it('changes when the parked held order changes', () => {
    const changed = {
      ...baseState,
      binding: { ...binding, heldOrderId: 'hold-10' },
    };
    expect(reparkSignature(reparkRequest(changed)!)).not.toBe(
      reparkSignature(reparkRequest(baseState)!)
    );
  });
});
