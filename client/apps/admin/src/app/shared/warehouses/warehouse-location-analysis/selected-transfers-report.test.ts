import { expect, it } from 'vitest';
import type {
  StockTransfer,
  TransferItem,
} from '@/services/stockTransfer.service';
import { buildSelectedTransfersReport } from './selected-transfers-report';
import { renderDocument } from '@/utils/print/pdf-render';

const item = (patch: Partial<TransferItem> = {}): TransferItem => ({
  subProductId: 'wine',
  subProductName: 'Wine',
  sku: 'W1',
  sizeId: 'small',
  sizeName: '750 ml',
  quantity: 5,
  transferredQty: 5,
  costPrice: 100,
  ...patch,
});
const transfer = (
  id: string,
  items: TransferItem[],
  patch: Partial<StockTransfer> = {}
): StockTransfer => ({
  _id: id,
  transferNumber: id,
  sourceWarehouse: 'here',
  destinationWarehouse: 'there',
  status: 'completed',
  currency: 'NGN',
  total: 500,
  items,
  ...patch,
});

it('combines products across selected documents and weights prices after returns', () => {
  const report = buildSelectedTransfersReport(
    [
      transfer('T1', [item({ returnedQty: 2 })], { total: 300 }),
      transfer('T2', [item({ quantity: 2, costPrice: 200 })], { total: 420 }),
    ],
    'here'
  );
  expect(report.table.rows).toHaveLength(1);
  expect(report.table.rows[0].map((c) => c.text)).toEqual([
    'Wine',
    '750 ml / W1',
    'NGN',
    '5',
    '140.00',
    '700.00',
    '0.00',
  ]);
  expect(report.totals).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: 'NGN product value before adjustments',
        value: 'NGN 700.00',
      }),
      expect.objectContaining({
        label: 'NGN transfer total after returns',
        value: 'NGN 720.00',
      }),
    ])
  );
});

// ── DRI-17 variant identity ───────────────────────────────────────────────────
// Rows keyed by exact Size id stay distinct when two sizes share a base name
// ('m'), and their "Size / SKU" label composes the full identity via the
// shared size-variant-label util. Legacy sizeName-only items keep the verified
// '750 ml / W1' output byte-identically (asserted by the test above).

it('keeps colour sibling sizes distinct with full identity labels', () => {
  const report = buildSelectedTransfersReport(
    [
      transfer('T1', [
        item({ sizeId: 'sz-emerald', sizeName: 'm', colorName: 'Emerald', sku: 'W1' }),
      ]),
      transfer('T2', [
        item({ sizeId: 'sz-ivory', sizeName: 'm', colorName: 'Ivory', sku: 'W2' }),
      ]),
      transfer('T3', [
        item({ sizeId: 'sz-legacy', sizeName: '750 ml', sku: 'W3' }),
      ]),
    ],
    'here'
  );
  const labels = report.table.rows.map((r) => r[1].text);
  expect(labels.sort()).toEqual(['750 ml / W3', 'm · Emerald / W1', 'm · Ivory / W2']);
});

it('combines line taxes after discounts and returns, keeping currency totals separate', () => {
  const report = buildSelectedTransfersReport(
    [
      transfer(
        'T1',
        [item({ quantity: 5, returnedQty: 2, discountRate: 10, taxRate: 7.5 })],
        { total: 290.25 }
      ),
      transfer('T2', [item({ quantity: 2, costPrice: 200, taxRate: 5 })], {
        total: 420,
      }),
      transfer('T3', [item({ taxRate: 10 })], { currency: 'USD', total: 550 }),
    ],
    'here'
  );
  const taxIndex = report.table.columns.findIndex(
    (column) => column.label === 'Tax'
  );
  expect(taxIndex).toBeGreaterThan(-1);
  expect(
    report.table.rows.find((row) => row[2].text === 'NGN')?.[taxIndex].text
  ).toBe('40.25');
  expect(
    report.table.rows.find((row) => row[2].text === 'USD')?.[taxIndex].text
  ).toBe('50.00');
  expect(report.totals).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: 'NGN tax after returns',
        value: 'NGN 40.25',
      }),
      expect.objectContaining({
        label: 'USD tax after returns',
        value: 'USD 50.00',
      }),
      expect.objectContaining({
        label: 'NGN transfer total after returns',
        value: 'NGN 710.25',
      }),
    ])
  );
});

it('rounds discounted line taxes before combining and marks unknown taxable costs unavailable', () => {
  const report = buildSelectedTransfersReport(
    [
      transfer('T1', [item({ quantity: 1, costPrice: 0.05, taxRate: 10 })]),
      transfer('T2', [item({ quantity: 1, costPrice: 0.05, taxRate: 10 })]),
      transfer('T3', [item({ costPrice: undefined, taxRate: 5 })], {
        currency: 'USD',
      }),
    ],
    'here'
  );
  expect(report.totals).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: 'NGN tax after returns',
        value: 'NGN 0.02',
      }),
      expect.objectContaining({
        label: 'USD tax after returns',
        value: 'Unavailable',
      }),
    ])
  );
});

it('keeps currencies and sizes distinct, deduplicates documents and includes every product', () => {
  const first = transfer('T1', [
    item(),
    item({ subProductId: 'beer', subProductName: 'Beer' }),
  ]);
  const report = buildSelectedTransfersReport(
    [
      first,
      first,
      transfer('T2', [item({ sizeId: 'large', sizeName: '1 L' })]),
      transfer('T3', [item()], { currency: 'USD' }),
    ],
    'here'
  );
  expect(report.table.rows).toHaveLength(4);
  expect(report.meta).toContainEqual(['Selected transfers', '3']);
  expect(
    report.totals.filter((t) =>
      t.label.endsWith('transfer total after returns')
    )
  ).toHaveLength(2);
});

it('marks missing costs as unavailable and preserves explicit zero prices and totals', () => {
  const report = buildSelectedTransfersReport(
    [
      transfer('T1', [item({ costPrice: undefined })], { total: undefined }),
      transfer('T2', [item({ subProductId: 'free', costPrice: 0 })], {
        total: 0,
      }),
    ],
    'here'
  );
  expect(
    report.table.rows.find((row) => row[0].text === 'Wine')?.[4].text
  ).toBe('Unavailable');
  expect(
    report.table.rows.find((row) => row[0].text === 'Wine')?.[5].text
  ).toBe('Unavailable');
  expect(
    report.table.rows.find((row) => row[0].text === 'Wine')?.[3].text
  ).toBe('5');
  expect(report.table.rows.find((row) => row[0].text === 'Wine')).toBeTruthy();
  expect(
    report.totals.find(
      (t) => t.label === 'NGN product value before adjustments'
    )?.value
  ).toBe('Unavailable');
  expect(
    report.totals.find((t) => t.label === 'NGN transfer total after returns')
      ?.value
  ).toBe('Unavailable');
});

it('rejects unrelated transfers and an empty selection', () => {
  expect(() => buildSelectedTransfersReport([], 'here')).toThrow(
    'Select at least one transfer'
  );
  expect(() =>
    buildSelectedTransfersReport(
      [transfer('T1', [item()], { sourceWarehouse: 'other' })],
      'here'
    )
  ).toThrow('does not belong to this warehouse');
});

it('renders a real multipage PDF for a large combined selection', () => {
  const model = buildSelectedTransfersReport(
    [
      transfer(
        'T1',
        Array.from({ length: 120 }, (_, n) =>
          item({
            subProductId: `product-${n}`,
            subProductName: `Beverage ${n} with a long descriptive name`,
          })
        )
      ),
    ],
    'here'
  );
  const pdf = renderDocument(model);
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  expect(pdf.output().startsWith('%PDF-')).toBe(true);
  expect(model.table.rows).toHaveLength(120);
});
