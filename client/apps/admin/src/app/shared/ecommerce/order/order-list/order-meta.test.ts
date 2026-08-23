import { describe, it, expect } from 'vitest';
import { customerOf } from './order-meta';
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

describe('customerOf', () => {
  it('prefers shippingAddress (web checkout) over everything else', () => {
    const c = customerOf(
      makeOrder({
        shippingAddress: { fullName: 'Ada Lovelace', email: '', phone: '' },
        user: { firstName: 'Ignored', lastName: 'User', email: 'x@x.com' },
      } as unknown as Partial<Order>)
    );
    expect(c.name).toBe('Ada Lovelace');
  });

  it('falls back to paymentDetails.customer for POS till orders', () => {
    const c = customerOf(
      makeOrder({
        paymentDetails: { customer: { firstName: 'Walk', lastName: 'In', phone: '080' } },
      } as unknown as Partial<Order>)
    );
    expect(c.name).toBe('Walk In');
    expect(c.contact).toBe('080');
  });

  it('labels an unnamed POS customer as Walk-in customer', () => {
    const c = customerOf(
      makeOrder({
        paymentDetails: { customer: { firstName: '', lastName: '', phone: '' } },
      } as unknown as Partial<Order>)
    );
    expect(c.name).toBe('—');
  });

  it('uses the linked user account when no address or POS record exists', () => {
    const c = customerOf(
      makeOrder({
        user: { firstName: 'Grace', lastName: 'Hopper', email: 'grace@navy.mil' },
      } as unknown as Partial<Order>)
    );
    expect(c.name).toBe('Grace Hopper');
    expect(c.contact).toBe('grace@navy.mil');
  });

  it('returns em-dash placeholders when nothing is known', () => {
    const c = customerOf(makeOrder());
    expect(c.name).toBe('—');
    expect(c.contact).toBe('');
  });
});
