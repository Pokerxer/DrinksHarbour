import { it, expect } from 'vitest';
import {
  selectedGroups,
  prepareDraft,
  readDraft,
  validQuantity,
} from './order-draft';
import type {
  InsightLine,
  SupplierOffer,
} from '@/services/notificationInsights.service';
const offer = {
  offerId: 'o',
  vendorId: 'v',
  vendorName: 'Vendor',
  currency: 'NGN',
  unitPrice: 2000,
  packagingQty: 12,
  minQuantity: 1,
  maxQuantity: null,
  quantity: 36,
  packs: 3,
  estimatedCost: 72000,
  leadTimeDays: 7,
} as SupplierOffer;
const line = {
  key: 'p:s:w',
  subProductId: 'p',
  sizeId: 's',
  warehouseId: 'w',
  warehouseName: 'Main',
  productName: 'Drink',
  sku: 'D',
  sizeName: 'Bottle',
  selected: offer,
} as InsightLine;
it('selected order groups split destination and currency without duplicate demand', () => {
  const groups = selectedGroups(
    [line, { ...line, key: 'p:s:other', warehouseId: 'other' }],
    {}
  );
  expect(groups).toHaveLength(2);
  expect(groups[0].estimatedCost).toBe(72000);
});
it('manual quantities must respect pack and supplier bounds', () => {
  expect(validQuantity(30, offer)).toBe(false);
  expect(validQuantity(36, offer)).toBe(true);
  expect(validQuantity(0, offer)).toBe(true);
  expect(validQuantity(48, { ...offer, maxQuantity: 36 })).toBe(false);
});
it('purchase prefill is tenant/user scoped and expires', () => {
  const draft = prepareDraft(selectedGroups([line], {})[0], 'u:t', 1000);
  expect(draft.items[0].quantity).toBe(36);
  expect(readDraft(JSON.stringify(draft), 'u:other', 1100)).toBeNull();
  expect(readDraft(JSON.stringify(draft), 'u:t', 1000 + 600001)).toBeNull();
  expect(readDraft(JSON.stringify(draft), 'u:t', 1100)?.warehouseId).toBe('w');
});
it('groups ignore summary/missing destinations and do not double-count repeated rows', () => {
  const groups = selectedGroups(
    [
      line,
      line,
      { ...line, key: 'summary', summary: true },
      { ...line, key: 'unassigned', warehouseId: '' },
    ],
    {}
  );
  expect(groups).toHaveLength(1);
  expect(groups[0].lines).toHaveLength(1);
  expect(groups[0].estimatedCost).toBe(72000);
});
it('draft preparation rejects a group with mixed supplier or destination identity', () => {
  const group = selectedGroups([line], {})[0];
  expect(() => prepareDraft({ ...group, vendorId: 'other' }, 'u:t')).toThrow();
  expect(() =>
    prepareDraft(
      { ...group, lines: [{ ...group.lines[0], warehouseId: 'other' }] },
      'u:t'
    )
  ).toThrow();
});
it('stored drafts reject invalid pack math, prices and duplicate products', () => {
  const d = prepareDraft(selectedGroups([line], {})[0], 'u:t', 1000);
  for (const item of [
    { ...d.items[0], quantity: 35 },
    { ...d.items[0], packQty: 99 },
    { ...d.items[0], unitPrice: -1 },
    { ...d.items[0], subProductId: '' },
    { ...d.items[0], packPrice: 1 },
  ]) {
    expect(
      readDraft(JSON.stringify({ ...d, items: [item] }), 'u:t', 1100)
    ).toBeNull();
  }
  expect(
    readDraft(
      JSON.stringify({
        ...d,
        items: [d.items[0], { ...d.items[0], key: 'other' }],
      }),
      'u:t',
      1100
    )
  ).toBeNull();
});
