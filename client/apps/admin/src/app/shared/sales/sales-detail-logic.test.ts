// Logic that keeps the /sales/[id] detail pages honest.
//
// The server never expires a quotation automatically — 'expired' appears in
// its enum but nothing sets it — so a sent quote past its validUntil read as
// "Sent" forever and nobody was warned before accepting stale prices. The
// expiry state must therefore be derived where it is shown.
//
// The same page hid fulfilment behind a single "Partial" pill: an operator
// could not see whether 2 of 200 units or 198 of 200 had shipped. The
// progress numbers below are the fix, and these tests pin their math.

import { describe, expect, test } from 'vitest';
import type { SalesLineItem } from '@/services/salesOrder.service';
import {
  quoteExpiry,
  fulfilmentProgress,
  canCancelOrder,
} from './sales-detail-logic';

describe('quoteExpiry', () => {
  const now = new Date('2026-08-23T12:00:00Z');

  test('a sent quote past its validUntil reads as expired', () => {
    const r = quoteExpiry('2026-08-20T00:00:00Z', 'sent', now);
    expect(r.state).toBe('expired');
  });

  test('expiry applies to drafts too — a draft has a shelf life as well', () => {
    expect(quoteExpiry('2026-08-01T00:00:00Z', 'draft', now).state).toBe(
      'expired'
    );
  });

  test('terminal states are never flagged by a stale date', () => {
    // converted/rejected/expired tell their own story; re-flagging them from
    // validUntil would relabel a finished decision as a live problem.
    expect(quoteExpiry('2026-08-01T00:00:00Z', 'converted', now).state).toBe(
      'ok'
    );
    expect(quoteExpiry('2026-08-01T00:00:00Z', 'rejected', now).state).toBe(
      'ok'
    );
  });

  test('a deadline within a week is "soon" with days left', () => {
    const r = quoteExpiry('2026-08-27T00:00:00Z', 'sent', now);
    expect(r.state).toBe('soon');
    expect(r.daysLeft).toBe(4);
  });

  test('today itself is still soon, not expired', () => {
    // The deadline is midnight-to-midnight; a customer promised "the 23rd"
    // has the whole day.
    const r = quoteExpiry('2026-08-23T00:00:00Z', 'sent', now);
    expect(r.state).toBe('soon');
    expect(r.daysLeft).toBe(0);
  });

  test('beyond a week there is nothing to say', () => {
    expect(quoteExpiry('2026-09-15T00:00:00Z', 'sent', now)).toEqual({
      state: 'ok',
      daysLeft: null,
    });
  });

  test('no validUntil means no opinion', () => {
    expect(quoteExpiry(undefined, 'sent', now).state).toBe('ok');
    expect(quoteExpiry('', 'sent', now).daysLeft).toBeNull();
  });
});

describe('fulfilmentProgress', () => {
  function line(qty: number, fulfilled = 0): SalesLineItem {
    return {
      _id: Math.random().toString(),
      lineType: 'product',
      name: 'x',
      quantity: qty,
      unitPrice: 0,
      discount: 0,
      lineTotal: 0,
      fulfilledQty: fulfilled,
      postedQty: 0,
      returnedQty: 0,
    };
  }

  test('sums ordered vs delivered across product lines', () => {
    const p = fulfilmentProgress([line(10, 4), line(6, 6)]);
    expect(p).toEqual({ ordered: 16, delivered: 10, pct: 63 });
  });

  test('sections and notes carry no units', () => {
    const section = {
      ...line(99),
      lineType: 'section' as const,
      name: 'Section',
    };
    const note = { ...line(99), lineType: 'note' as const, name: 'Note' };
    expect(fulfilmentProgress([section, line(5, 5), note])).toEqual({
      ordered: 5,
      delivered: 5,
      pct: 100,
    });
  });

  test('delivered never exceeds what was ordered', () => {
    // Over-shipment is a stock anomaly, not extra demand; a 120% bar would
    // lie about headroom that does not exist.
    expect(fulfilmentProgress([line(10, 14)]).pct).toBe(100);
  });

  test('an empty order divides nothing', () => {
    expect(fulfilmentProgress([])).toEqual({
      ordered: 0,
      delivered: 0,
      pct: 0,
    });
  });
});

describe('canCancelOrder', () => {
  test('live orders can be cancelled', () => {
    for (const s of ['draft', 'confirmed', 'partially_fulfilled']) {
      expect(canCancelOrder(s)).toBe(true);
    }
  });

  test('finished or already-cancelled orders cannot', () => {
    for (const s of ['fulfilled', 'cancelled']) {
      expect(canCancelOrder(s)).toBe(false);
    }
  });

  test('an order with no status yet is still cancellable', () => {
    // A missing orderStatus means never confirmed — same rule the status
    // badge uses ('draft', not unknown).
    expect(canCancelOrder(undefined)).toBe(true);
  });
});
