// app/shared/purchases/purchases-create-lines.test.ts
// Pure line-list behaviour for the purchases create form: presentation
// sections/notes ("Add a section"/"Add a note"), section running subtotals,
// and the save-payload mapping that keeps presentation lines out of money.
import { describe, expect, it } from 'vitest';
import {
  appendPresentationLine,
  catalogQtyMap,
  computeSectionSubtotals,
  purchasePayloadLines,
  catalogDraftFromSelection,
  derivePurchasePack,
  type PurchaseLine,
} from './purchases-create-lines';

const product = (over: Partial<PurchaseLine> = {}): PurchaseLine => ({
  lineType: 'product',
  subProductId: 'sp-1',
  productName: 'Hennessy',
  sku: 'SKU-1',
  quantity: 10,
  packSize: 12,
  packQty: 1,
  unitPrice: 100,
  packPrice: 1200,
  taxRate: 0,
  ...over,
});

const blankProduct = () =>
  product({ subProductId: '', productName: '', sku: '' });
const blankPresentation = (type: 'section' | 'note'): PurchaseLine => ({
  lineType: type,
  subProductId: '',
  productName: '',
  sku: '',
  quantity: 0,
  packSize: 1,
  packQty: 0,
  unitPrice: 0,
  packPrice: 0,
  taxRate: 0,
  ...(type === 'section' ? { name: '' } : { description: '' }),
});

describe('appendPresentationLine', () => {
  it('appends a section line', () => {
    const next = appendPresentationLine([product()], 'section', blankPresentation);
    expect(next[next.length - 1].lineType).toBe('section');
  });

  it('moves a trailing empty product row beneath the new presentation line', () => {
    // An empty product line is an unfinished row — it shouldn't be orphaned
    // above the new section/note, or the buyer's input gets pinned to the
    // wrong heading. Sales parity: keep the blank after the presentation line.
    const next = appendPresentationLine(
      [product(), blankProduct()],
      'note',
      blankPresentation,
    );
    expect(next).toHaveLength(3);
    expect(next[1].lineType).toBe('note');
    expect(next[2].lineType).toBe('product');
    expect(next[2].productName).toBe('');
  });
});

describe('computeSectionSubtotals', () => {
  it('sums product line subtotals belonging to each section', () => {
    const section = { ...blankPresentation('section'), name: 'Beer crates' };
    const lines = [
      product({ quantity: 1, unitPrice: 10 }), // before the first section: not attributed
      section,
      product({ subProductId: 'sp-2', quantity: 2, unitPrice: 10 }),
      product({ subProductId: 'sp-3', quantity: 3, unitPrice: 10 }),
    ];
    const map = computeSectionSubtotals(lines, subtotalOf);
    expect([...map.values()]).toEqual([50]);
    expect([...map.keys()]).toEqual([section]);
  });
});

function subtotalOf(item: PurchaseLine): number {
  return item.unitPrice * item.quantity;
}

describe('catalogQtyMap', () => {
  it('maps product lines (with sizes) to quantities and skips presentation lines', () => {
    const lines: PurchaseLine[] = [
      product({ subProductId: 'sp-1', sizeId: 'sz-1', quantity: 3 }),
      product({ subProductId: 'sp-2', quantity: 5 }),
      { ...blankPresentation('section'), name: 'Beer crates' },
    ];
    expect(catalogQtyMap(lines)).toEqual({
      'sp-1|sz-1': 3,
      'sp-2|': 5,
    });
  });
});

describe('purchasePayloadLines', () => {
  it('maps product lines to the legacy payload shape', () => {
    const out = purchasePayloadLines([product({ quantity: 10, unitPrice: 100 })]);
    expect(out[0]).toMatchObject({
      subProductId: 'sp-1',
      subProductName: 'Hennessy',
      unitCost: 100,
      packagingQty: 12,
      receivedQty: 0,
      totalCost: 1000,
      lineType: 'product',
    });
  });

  it('zeroes section and note lines and strips catalog references', () => {
    const out = purchasePayloadLines([
      blankPresentation('section'),
      blankPresentation('note'),
    ].map((l, i) =>
      i === 0 ? { ...l, name: 'Beer crates' } : { ...l, description: 'Deliver before Friday' },
    ));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      lineType: 'section',
      name: 'Beer crates',
      quantity: 0,
      unitCost: 0,
    });
    expect('subProductId' in out[0]).toBe(false);
    expect(out[1]).toMatchObject({
      lineType: 'note',
      description: 'Deliver before Friday',
      quantity: 0,
    });
  });

  it('drops presentation lines that are still empty and keeps order', () => {
    const lines = [
      product({ subProductId: 'sp-1' }),
      { ...blankPresentation('section'), name: undefined },
      { ...blankPresentation('note'), description: ' ' },
      { ...blankPresentation('section'), name: 'Bottles' },
    ];
    const out = purchasePayloadLines(lines);
    expect(out).toHaveLength(2);
    expect(out[0].subProductId).toBe('sp-1');
    expect(out[1].name).toBe('Bottles');
  });

  it('excludes unsaved product rows from the payload', () => {
    const out = purchasePayloadLines([product({ subProductId: '', productName: '' })]);
    expect(out).toHaveLength(0);
  });
});

describe('catalogDraftFromSelection', () => {
  it('builds a scanned-line-shaped purchase line priced at cost', () => {
    const draft = catalogDraftFromSelection({
      name: 'Hennessy XO – 350ml',
      sku: 'HN-XO-350',
      subProductId: 'sp-1',
      costPrice: 900,
      taxRate: 7.5,
      unitsPerPack: 12,
      sizeId: 'sz-350',
      sizeName: '350ml',
    }, 3);
    expect(draft).toMatchObject({
      subProductId: 'sp-1',
      productName: 'Hennessy XO – 350ml',
      sku: 'HN-XO-350',
      sizeId: 'sz-350',
      sizeName: '350ml',
      quantity: 3,
      packSize: 12,
      unitPrice: 900,
      taxRate: 7.5,
    });
  });

  it('never divides by a zero or missing units-per-pack', () => {
    const draft = catalogDraftFromSelection({
      name: 'Beer crate',
      sku: 'BC-1',
      subProductId: 'sp-2',
      costPrice: 5000,
      taxRate: 0,
      unitsPerPack: 0,
    }, 1);
    expect(draft.packSize).toBe(1);
  });
});

describe('derivePurchasePack', () => {
  it('derives packPrice/packQty exactly as updateItem does', () => {
    const next = derivePurchasePack({
      ...product({ quantity: 25, packSize: 12, unitPrice: 61_000 }),
    });
    expect(next.packPrice).toBe(61_000 * 12);
    // 25 units at 12 per pack is 3 packs — partial packs round up.
    expect(next.packQty).toBe(3);
  });
});
