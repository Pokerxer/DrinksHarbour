import { describe, expect, it, vi } from 'vitest';
import {
  salesLine,
  salesStatus,
  pageNumbers,
  loadHistory,
} from './history-data';
describe('product history', () => {
  it('aggregates every matching size without including other products', () => {
    expect(
      salesLine(
        {
          items: [
            { subproduct: 'p', quantity: 2, priceAtPurchase: 10 },
            { subproduct: { _id: 'p' }, quantity: 3, itemSubtotal: 45 },
            { subproduct: 'other', quantity: 99 },
          ],
        },
        'p'
      )
    ).toMatchObject({ quantity: 5, itemSubtotal: 65, priceAtPurchase: 13 });
  });
  it('does not call unpaid orders paid', () => {
    expect(salesStatus({ paymentStatus: 'pending' })).toBe('Pending');
    expect(salesStatus({ paymentStatus: 'paid' })).toBe('Paid');
    expect(salesStatus({ paymentStatus: 'refunded' })).toBe('Refunded');
  });
  it('keeps pagination unique and within bounds', () => {
    for (const page of [1, 2, 5, 19, 20]) {
      const pages = pageNumbers(page, 20);
      expect(new Set(pages).size).toBe(pages.length);
      expect(pages.every((p) => p >= 1 && p <= 20)).toBe(true);
      expect(pages).toContain(page);
    }
  });
  it('loads subsequent sales pages and deduplicates records', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { orders: [{ _id: 'a' }], pagination: { pages: 2 } },
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              orders: [{ _id: 'a' }, { _id: 'b' }],
              pagination: { pages: 2 },
            },
          })
        )
      );
    expect(
      await loadHistory(
        'http://localhost/api/orders',
        'token',
        new AbortController().signal,
        fetcher
      )
    ).toHaveLength(2);
    expect(fetcher.mock.calls[1][0]).toContain('page=2');
  });
  it('rejects failed pages instead of reporting partial totals', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, message: 'Unavailable' }),
          { status: 503 }
        )
      );
    await expect(
      loadHistory(
        'http://localhost/api/purchase-orders',
        'token',
        new AbortController().signal,
        fetcher
      )
    ).rejects.toThrow('Unavailable');
  });
});

import { matchesChoices } from './history-data';
it('combines alternative statuses without requiring contradictory statuses', () => {
  expect(
    matchesChoices(new Set(['confirmed', 'received']), {
      confirmed: false,
      received: true,
      draft: false,
    })
  ).toBe(true);
  expect(
    matchesChoices(new Set(['confirmed']), { confirmed: false, received: true })
  ).toBe(false);
});
it('loads purchase pagination from the top-level response', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ _id: 'a' }],
          pagination: { totalPages: 2 },
        })
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ _id: 'b' }],
          pagination: { totalPages: 2 },
        })
      )
    );
  expect(
    await loadHistory(
      'http://localhost/api/purchase-orders',
      'token',
      new AbortController().signal,
      fetcher
    )
  ).toHaveLength(2);
});
it('does not request history after cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = vi.fn();
  await expect(
    loadHistory(
      'http://localhost/api/orders',
      'token',
      controller.signal,
      fetcher
    )
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
