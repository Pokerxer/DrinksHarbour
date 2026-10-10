import { it, expect } from 'vitest';
import {
  preparedPurchaseReference,
  arrivalEstimate,
} from './restock-preparation';
import type { RestockDraft } from '../notifications/vendor-orders/order-draft';
import type { SupplierOffer } from '@/services/notificationInsights.service';
const draft = {
  vendorId: 'v',
  currency: 'NGN',
  warehouseId: 'w',
  items: [
    { key: 'p:s:w', offerId: 'o', subProductId: 'p', sizeId: 's' },
    { key: 'q:s:w', offerId: 'x', subProductId: 'q', sizeId: 's' },
  ],
} as RestockDraft;
const offers = [
  {
    offerId: 'o',
    unitPrice: 100,
    packagingQty: 6,
    minQuantity: 6,
    maxQuantity: 24,
    leadTimeDays: 7,
  },
  {
    offerId: 'x',
    unitPrice: 200,
    packagingQty: 12,
    minQuantity: 12,
    maxQuantity: null,
    leadTimeDays: 10,
  },
] as SupplierOffer[];
const input = {
  vendorId: 'v',
  currency: 'NGN',
  warehouseId: 'w',
  items: [
    {
      subProductId: 'p',
      sizeId: 's',
      quantity: 18,
      unitPrice: 100,
      packSize: 6,
    },
  ],
};
it('removing a product retains valid edited quantities and sends only its matching plan reference', () => {
  expect(
    preparedPurchaseReference({ draft, offers, coverDays: 14 }, input)
  ).toEqual({ coverDays: 14, lines: [{ key: 'p:s:w', offerId: 'o' }] });
});
it('prepared purchases reject identity changes, duplicate variants, wrong prices and packs before save', () => {
  const prep = { draft, offers, coverDays: 14 };
  for (const patch of [
    { vendorId: 'other' },
    { warehouseId: 'other' },
    { currency: 'USD' },
    { items: [{ ...input.items[0], quantity: 19 }] },
    { items: [{ ...input.items[0], unitPrice: 1 }] },
    { items: [{ ...input.items[0], packSize: 1 }] },
    { items: [{ ...input.items[0], subProductId: 'other' }] },
    { items: [input.items[0], input.items[0]] },
  ])
    expect(() =>
      preparedPurchaseReference(prep, { ...input, ...patch })
    ).toThrow(/review|supplier|quantity|product|warehouse|currency/i);
});
it('estimated order arrival follows the slowest supplier line using Lagos dates', () => {
  expect(arrivalEstimate(offers, new Date('2026-10-09T23:30:00Z'))).toBe(
    '2026-10-20'
  );
  expect(
    arrivalEstimate(
      [{ ...offers[0], leadTimeDays: NaN }],
      new Date('2026-10-09T00:00:00Z')
    )
  ).toBe('');
});

it('an impossible arrival estimate stays unset for manual timing review', () => {
  expect(
    arrivalEstimate(
      [{ ...offers[0], leadTimeDays: 1e308 }],
      new Date('2026-10-09T00:00:00Z')
    )
  ).toBe('');
});
