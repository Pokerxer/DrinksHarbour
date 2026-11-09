// app/shared/purchases/stock-transfer-lines.test.ts
// Pure line-list behaviour for the stock-transfer create/edit form:
// presentation lines ("Add a section"/"Add a note") and the save-payload
// mapping that keeps them out of money and stock movement.
import { describe, expect, it } from 'vitest';
import {
  appendTransferScannedLines,
  transferPayloadLines,
  type TransferLine,
} from './stock-transfer-lines';

const product = (over: Partial<TransferLine> = {}): TransferLine => ({
  lineType: 'product',
  subProductId: 'sp-1',
  subProductName: 'Hennessy',
  sku: 'SKU-1',
  quantity: 10,
  costPrice: 100,
  discountRate: 0,
  taxRate: 0,
  packSize: 12,
  costSourcePrice: 100,
  wholesalePrice: 0,
  ...over,
});

const blank = (): TransferLine => ({
  lineType: 'product',
  subProductId: '',
  subProductName: '',
  sku: '',
  quantity: 1,
  costPrice: 0,
  discountRate: 0,
  taxRate: 0,
  packSize: 1,
  costSourcePrice: 0,
  wholesalePrice: 0,
});

const blankPresentation = (type: 'section' | 'note'): TransferLine => ({
  lineType: type,
  subProductId: '',
  subProductName: '',
  sku: '',
  quantity: 0,
  costPrice: 0,
  discountRate: 0,
  taxRate: 0,
  packSize: 1,
  costSourcePrice: 0,
  wholesalePrice: 0,
  ...(type === 'section' ? { name: '' } : { description: '' }),
});

describe('appendTransferScannedLines', () => {
  it('replaces a trailing untouched blank and appends', () => {
    const next = appendTransferScannedLines([blank()], [
      { subProductId: 'sp-2', subProductName: 'Beer', sku: 'B-1', quantity: 5, packSize: 12, unitPrice: 900, taxRate: 7.5 },
    ], blank);
    expect(next).toHaveLength(1);
    expect(next[0].subProductName).toBe('Beer');
  });

  it('never deletes a presentation line while dropping blanks', () => {
    const section = {
      ...blankPresentation('section'),
      name: 'Beer crates',
    };
    const next = appendTransferScannedLines([section], [
      { subProductId: 'sp-2', subProductName: 'Beer', sku: 'B-1', quantity: 5, packSize: 12, unitPrice: 900, taxRate: 7.5 },
    ], blank);
    expect(next).toHaveLength(2);
    expect(next[0].lineType).toBe('section');
    expect(next[1].subProductName).toBe('Beer');
  });

  it('fills presentation defaults for fields the draft does not set', () => {
    const next = appendTransferScannedLines([], [
      { subProductId: 'sp-2', subProductName: 'Beer', sku: 'B-1', quantity: 5, packSize: 12, unitPrice: 900, taxRate: 7.5 },
    ], blank);
    expect(next[0].discountRate).toBe(0);
    expect(next[0].costSourcePrice).toBe(900);
  });
});

describe('transferPayloadLines', () => {
  it('keeps the product wire shape', () => {
    const out = transferPayloadLines([product({ quantity: 10, costPrice: 100, discountRate: 5, taxRate: 2 })]);
    expect(out[0]).toMatchObject({
      lineType: 'product',
      subProductId: 'sp-1',
      subProductName: 'Hennessy',
      quantity: 10,
      costPrice: 100,
      discountRate: 5,
      taxRate: 2,
      packSize: 12,
    });
  });

  it('zeroes section/note lines and strips catalog references', () => {
    const out = transferPayloadLines([
      { ...blankPresentation('section'), name: 'Beer crates' },
      { ...blankPresentation('note'), description: 'Seal crates' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      lineType: 'section',
      name: 'Beer crates',
      quantity: 0,
      costPrice: 0,
      packSize: 1,
    });
    expect('subProductId' in out[0]).toBe(false);
    expect(out[1]).toMatchObject({
      lineType: 'note',
      description: 'Seal crates',
      quantity: 0,
    });
  });

  it('drops empty presentation rows and unsaved products, keeps order', () => {
    const out = transferPayloadLines([
      blank(),
      { ...blankPresentation('section'), name: undefined },
      { ...blankPresentation('note'), description: ' ' },
      { ...blankPresentation('section'), name: 'Bottles' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Bottles');
  });
});
