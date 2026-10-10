import { expect, it } from 'vitest';
import type {
  InsightLine,
  SupplierOffer,
} from '@/services/notificationInsights.service';
import {
  restockRows,
  selectRestockLines,
  matchesRestockStatus,
} from './restock-rules';
const offer = {
  offerId: 'slow',
  vendorName: 'Slow',
  packagingQty: 6,
  minQuantity: 1,
  maxQuantity: null,
  quantity: 12,
  urgency: 'normal',
  daysOfCover: 20,
} as SupplierOffer;
const line = {
  key: 'p:s:w',
  productName: 'Wine',
  sizeName: '75cl',
  warehouseName: 'Main',
  warehouseId: 'w',
  selected: offer,
  alternatives: [
    offer,
    {
      ...offer,
      offerId: 'fast',
      vendorName: 'Fast',
      urgency: 'urgent',
      daysOfCover: 2,
    },
  ],
  units30: 30,
} as InsightLine;
it('supplier edits drive urgency and order-ready filtering without mutating server lines', () => {
  const edited = restockRows([line], {
    'p:s:w': { offerId: 'fast', quantity: 18 },
  })[0];
  expect(edited.selected?.offerId).toBe('fast');
  expect(edited.urgency).toBe('urgent');
  expect(matchesRestockStatus(edited, 'ready')).toBe(true);
  expect(line.selected?.offerId).toBe('slow');
});
it('normal, monitor and unknown priorities match server order and transfer outflow breaks ties', () => {
  const rows = [
    { ...line, key: 'unknown', urgency: 'unknown', daysOfCover: null },
    { ...line, key: 'monitor', urgency: 'monitor', daysOfCover: null },
    {
      ...line,
      key: 'slow',
      urgency: 'normal',
      daysOfCover: 20,
      demandUnits30: 5,
    },
    {
      ...line,
      key: 'fast',
      urgency: 'normal',
      daysOfCover: 20,
      demandUnits30: 50,
    },
  ];
  expect(
    selectRestockLines(rows, '', 'all', 'priority').map((r) => r.key)
  ).toEqual(['fast', 'slow', 'monitor', 'unknown']);
});
it('invalid manual quantities need review; exclusions differ from covered stock', () => {
  const [invalid] = restockRows([line], {
    'p:s:w': { offerId: 'slow', quantity: 7 },
  });
  expect(matchesRestockStatus(invalid, 'manual')).toBe(true);
  expect(matchesRestockStatus(invalid, 'ready')).toBe(false);
  const [excluded] = restockRows([line], {
    'p:s:w': { offerId: 'slow', quantity: 0 },
  });
  expect(matchesRestockStatus(excluded, 'excluded')).toBe(true);
  expect(matchesRestockStatus(excluded, 'covered')).toBe(false);
  expect(
    matchesRestockStatus(
      { ...line, selected: { ...offer, quantity: 0 } },
      'covered'
    )
  ).toBe(true);
});
it('missing selected currency is distinct from missing supplier terms', () => {
  const unmatched = { ...line, selected: null };
  expect(matchesRestockStatus(unmatched, 'supplier')).toBe(true);
  expect(matchesRestockStatus(unmatched, 'missingSupplier')).toBe(false);
});
it('selected date sales sorting retains unknowns rather than replacing them with monthly sales', () => {
  const rows = [
    { ...line, key: 'unknown', periodUnits: null },
    { ...line, key: 'known', periodUnits: 5 },
  ];
  expect(
    selectRestockLines(rows, '', 'all', 'sales').map((r) => r.key)
  ).toEqual(['known', 'unknown']);
});
it('a zero later order with a pre-delivery shortage is review work, not covered stock', () => {
  const row = {
    ...line,
    selected: {
      ...offer,
      quantity: 0,
      replenishment: { shortfallBeforeDelivery: 7 },
    },
  } as InsightLine;
  expect(matchesRestockStatus(row, 'covered')).toBe(false);
  expect(matchesRestockStatus(row, 'manual')).toBe(true);
});
