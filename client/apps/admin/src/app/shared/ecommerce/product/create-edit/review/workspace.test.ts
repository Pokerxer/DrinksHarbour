import { expect, it } from 'vitest';
import { inspectRows, filterRows, applyUnchangedSuggestions } from './workspace';
import { initialDrafts, reviewLines } from './pricing';
import type { ReviewListing } from './types';
const listing: ReviewListing = {
  _id: 'sp',
  status: 'pending',
  product: { platformMarkup: 15 },
  sizes: [
    {
      _id: 'a',
      size: '70cl',
      sku: 'GLEN-A',
      pricing: {
        costPrice: 1000,
        platformCostPrice: 1250,
        platformSellingPrice: 1500,
        platformMarkupPct: 15,
      },
    },
    {
      _id: 'b',
      size: '1 litre',
      sku: 'GLEN-B',
      pricing: {
        costPrice: 1000,
        platformCostPrice: 1250,
        platformSellingPrice: 1500,
        platformMarkupPct: 15,
      },
    },
  ],
};
const targets = { platform: '', tenant: '' };
it('tracks changed rows independently of invalid prices and filters by SKU, label and attention', () => {
  const lines = reviewLines(listing),
    drafts = initialDrafts(lines);
  drafts.a.normal = '1600';
  drafts.b.normal = 'bad';
  const rows = inspectRows(lines, drafts, listing, targets);
  expect(rows.filter((r) => r.changed)).toHaveLength(2);
  expect(rows[1].error).toMatch(/valid/);
  expect(filterRows(rows, 'glen-a', 'all').map((r) => r.line.id)).toEqual(['a']);
  expect(filterRows(rows, 'litre', 'attention').map((r) => r.line.id)).toEqual([
    'b',
  ]);
  expect(filterRows(rows, '', 'changed')).toHaveLength(2);
});
it('bulk suggestions preserve every manually edited row, do not mutate inputs and skip unmet tenant targets', () => {
  const lines = reviewLines(listing),
    drafts = initialDrafts(lines);
  drafts.a.normal = '1700';
  const result = applyUnchangedSuggestions(lines, drafts, listing, {
    platform: '20',
    tenant: '',
  });
  expect(result.a.normal).toBe('1700');
  expect(result.b.normal).toBe('1600');
  expect(drafts.b.normal).toBe('1500');
  expect(
    applyUnchangedSuggestions(lines, initialDrafts(lines), listing, {
      platform: '20',
      tenant: '30',
    })
  ).toEqual(initialDrafts(lines));
});
it('unchanged suspended packs are not blocking issues during a listing sale', () => {
  const sale: ReviewListing = {
    ...listing,
    isOnSale: true,
    saleType: 'percentage',
    saleDiscountValue: 20,
    sizes: [
      {
        ...listing.sizes![0],
        pricing: {
          ...listing.sizes![0].pricing,
          platformSellingPrice: 2000,
          packPlatformCostPrice: 1100,
          packUnitPrice: 1400,
        },
        unitsPerPack: 6,
      },
    ],
  };
  const lines = reviewLines(sale);
  expect(
    inspectRows(lines, initialDrafts(lines), sale, targets)[0].error
  ).toBeNull();
});
it('needs-attention includes pack-only margin shortfalls and bulk suggestions skip them', () => {
  const packed: ReviewListing = {
    ...listing,
    sizes: [
      {
        ...listing.sizes![0],
        unitsPerPack: 6,
        pricing: {
          ...listing.sizes![0].pricing,
          packPlatformCostPrice: 1100,
          packUnitPrice: 1300,
        },
      },
    ],
  };
  const lines = reviewLines(packed),
    drafts = initialDrafts(lines),
    target = { platform: '', tenant: '15' };
  const rows = inspectRows(lines, drafts, packed, target);
  expect(rows[0].normal.tenantTargetMet).toBe(true);
  expect(filterRows(rows, '', 'attention')).toHaveLength(1);
  expect(
    applyUnchangedSuggestions(lines, drafts, packed, {
      platform: '20',
      tenant: '15',
    })
  ).toEqual(drafts);
});
it('bulk operations preserve invalid manual inputs rather than replacing them', () => {
  const lines = reviewLines(listing),
    drafts = initialDrafts(lines);
  drafts.a.normal = '1500.5';
  expect(
    applyUnchangedSuggestions(lines, drafts, listing, { platform: '20', tenant: '' })
      .a.normal
  ).toBe('1500.5');
});
