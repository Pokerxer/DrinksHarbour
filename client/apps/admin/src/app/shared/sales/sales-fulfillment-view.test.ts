import { describe, it, expect } from 'vitest';
import {
  warehouseName,
  personName,
  fulfillmentLabel,
  fulfillmentUnits,
} from './sales-fulfillment-view';
import type { SalesOrderFulfillment } from '@/services/salesOrder.service';

const entry = (
  over: Partial<SalesOrderFulfillment> = {}
): SalesOrderFulfillment => ({
  _id: 'f1',
  items: [{ lineId: 'l1', qty: 3 }],
  status: 'reconciled',
  at: '2026-08-17T13:22:00.000Z',
  ...over,
});

describe('warehouseName', () => {
  it('reads the name off a populated warehouse', () => {
    expect(warehouseName({ _id: 'w1', name: 'Main Store' })).toBe('Main Store');
  });

  // An unpopulated ref is an id, and an id on screen is worse than nothing.
  it('returns null for a bare id', () => {
    expect(warehouseName('64ab19f3c2a4d5e6f7080911')).toBeNull();
  });

  it('returns null for missing, null, or a populated doc with no name', () => {
    expect(warehouseName(undefined)).toBeNull();
    expect(warehouseName(null)).toBeNull();
    expect(warehouseName({ _id: 'w1' })).toBeNull();
  });
});

describe('personName', () => {
  it('joins the two name parts', () => {
    expect(personName({ _id: 'u1', firstName: 'Ada', lastName: 'Nwosu' })).toBe(
      'Ada Nwosu'
    );
  });

  it('tolerates a missing half', () => {
    expect(personName({ _id: 'u1', firstName: 'Ada' })).toBe('Ada');
    expect(personName({ _id: 'u1', lastName: 'Nwosu' })).toBe('Nwosu');
  });

  it('returns null for a bare id, a nameless doc, or nothing', () => {
    expect(personName('64ab19f3c2a4d5e6f7080911')).toBeNull();
    expect(personName({ _id: 'u1' })).toBeNull();
    expect(personName(undefined)).toBeNull();
  });
});

describe('fulfillmentLabel', () => {
  // The receipt number is a real document reference someone can look up. The
  // WH/OUT string is a fallback built from the array index — it is not a
  // reference to anything, and it is only shown when there is no receipt.
  it('prefers the POS receipt number', () => {
    expect(fulfillmentLabel(entry({ ref: 'RCP-20260817-0004' }), 0)).toBe(
      'RCP-20260817-0004'
    );
  });

  it('falls back to a positional WH/OUT for a manual fulfilment', () => {
    expect(fulfillmentLabel(entry(), 0)).toBe('WH/OUT/00001');
    expect(fulfillmentLabel(entry(), 4)).toBe('WH/OUT/00005');
  });
});

describe('fulfillmentUnits', () => {
  it('sums the quantities across the entry lines', () => {
    expect(
      fulfillmentUnits(
        entry({
          items: [
            { lineId: 'a', qty: 3 },
            { lineId: 'b', qty: 7 },
          ],
        })
      )
    ).toBe(10);
  });

  it('is 0 for an entry with no items', () => {
    expect(fulfillmentUnits(entry({ items: [] }))).toBe(0);
    expect(fulfillmentUnits(entry({ items: undefined as never }))).toBe(0);
  });
});
