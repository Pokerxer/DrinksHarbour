import { describe, it, expect } from 'vitest';
import { toCSV } from './csv-export';
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

describe('toCSV', () => {
  it('emits a header row plus one row per order with CRLF line endings', () => {
    const csv = toCSV([makeOrder(), makeOrder({ orderNumber: '1002' })]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Order Number');
    expect(lines[1]).toContain('1001');
    expect(lines[2]).toContain('1002');
  });

  it('quotes and doubles quotes in values containing commas (RFC-4180)', () => {
    const csv = toCSV([
      makeOrder({ items: [], shippingAddress: undefined } as Partial<Order>),
    ]);
    // customerOf falls back to '—' — no comma, no quotes expected
    expect(csv.split('\r\n')[1]).not.toContain('"');

    const withComma = toCSV([
      makeOrder({
        user: {
          firstName: 'Ada, the',
          lastName: 'Lovelace',
          email: 'ada@example.com',
        },
      } as Partial<Order>),
    ]);
    const row = withComma.split('\r\n')[1];
    expect(row).toContain('"Ada, the Lovelace"');
  });

  it('escapes embedded newlines so a row never spills into two lines', () => {
    const csv = toCSV([
      makeOrder({
        shippingAddress: {
          fullName: 'Line\nBreak',
          email: '',
          phone: '',
        },
      } as unknown as Partial<Order>),
    ]);
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('"Line\nBreak"');
  });

  it('sums item quantities for the Items column', () => {
    const csv = toCSV([
      makeOrder({
        items: [
          { quantity: 2 },
          { quantity: 3 },
        ],
      } as unknown as Order),
    ]);
    const row = csv.split('\r\n')[1].split(',');
    const itemsIdx = csv
      .split('\r\n')[0]
      .split(',')
      .indexOf('Items');
    expect(Number(row[itemsIdx])).toBe(5);
  });

  it('defaults source to web and currency to NGN when absent', () => {
    const row = toCSV([makeOrder()]).split('\r\n')[1];
    expect(row).toContain(',web,');
    expect(row).toContain(',NGN,');
  });
});
