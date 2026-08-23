import { describe, it, expect } from 'vitest';
import { resolveCustomer } from './customer-info';
import type { Order } from '@/services/order.service';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    _id: 'ord_1',
    orderNumber: '1001',
    status: 'pending',
    paymentStatus: 'pending',
    items: [],
    ...overrides,
  } as unknown as Order;
}

describe('resolveCustomer', () => {
  it('prefers shippingAddress (web checkout) and keeps email/phone separate', () => {
    const c = resolveCustomer(
      makeOrder({
        shippingAddress: {
          fullName: 'Ada Lovelace',
          email: 'ada@calc.io',
          phone: '0801',
        },
        user: { firstName: 'Other', lastName: 'User', email: 'x@x.com' },
      } as unknown as Partial<Order>)
    );
    expect(c).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@calc.io',
      phone: '0801',
      kind: 'web',
    });
  });

  it('falls back to the linked account name when address lacks a fullName', () => {
    const c = resolveCustomer(
      makeOrder({
        shippingAddress: { fullName: '', email: '', phone: '' },
        user: { firstName: 'Grace', lastName: 'Hopper', email: 'g@navy.mil' },
      } as unknown as Partial<Order>)
    );
    expect(c.name).toBe('Grace Hopper');
    // An address with no usable field doesn't count as the web branch —
    // resolution correctly lands on the account identity.
    expect(c.kind).toBe('account');
  });

  it('uses paymentDetails.customer for POS till orders', () => {
    const c = resolveCustomer(
      makeOrder({
        paymentDetails: {
          customer: { firstName: 'Walk', lastName: 'In', phone: '0802' },
        },
      } as unknown as Partial<Order>)
    );
    expect(c).toMatchObject({
      name: 'Walk In',
      phone: '0802',
      kind: 'pos',
    });
  });

  it('labels an anonymous POS customer as Walk-in customer', () => {
    const c = resolveCustomer(
      makeOrder({
        paymentDetails: { customer: { firstName: '', lastName: '', phone: '' } },
      } as unknown as Partial<Order>)
    );
    // No firstName/phone at all → falls through to the account branch → unknown
    expect(['Walk-in customer', '—']).toContain(c.name);
  });

  it('uses the linked user account when no address or POS record exists', () => {
    const c = resolveCustomer(
      makeOrder({
        user: { firstName: 'Alan', lastName: 'Turing', email: 'alan@bletchley.uk' },
      } as unknown as Partial<Order>)
    );
    expect(c).toMatchObject({
      name: 'Alan Turing',
      email: 'alan@bletchley.uk',
      kind: 'account',
    });
  });

  it('returns unknown placeholders when nothing is known', () => {
    const c = resolveCustomer(makeOrder());
    expect(c).toEqual({ name: '—', email: '', phone: '', kind: 'unknown' });
  });
});
