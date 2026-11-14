import { writeFileSync, mkdirSync } from 'node:fs';
import { pdfPageStreams } from './pdf-test-content';
import { expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import { buildStockDoc } from '../stock-print';
import { buildPricelistDoc } from '../pricelist-print';
import { renderDocument, renderDocuments } from '../pdf-render';
import { TEMPLATES, resolveTemplate } from './registry';
import { COLLECTION_IDS } from './layout-collection';

const stock: StockRow = {
  _id: 'row-1',
  warehouseId: 'wh-1',
  warehouseName: 'North Annex',
  subProductId: 'product-1',
  productName: 'Reserve Cabernet',
  sku: 'SKU-42',
  sizeId: 'size-1',
  sizeName: '750 ml',
  currentQuantity: 20,
  reservedQuantity: 3,
  costPrice: 12550,
  sellingPrice: 7500000.25,
  minStockLevel: 5,
  earliestExpiry: null,
  valuationMethod: 'fifo',
  valuationSource: 'mixed',
  estimatedQuantity: 2,
};

const labels = [
  'Retail',
  'Trade',
  'Wholesale',
  'Distribution',
  'Corporate',
  'Event',
  'Case',
  'Pallet',
  'Online',
  'Export',
  'Partner',
  'Contract',
];
const pricelist = buildPricelistDoc([stock], null, {
  title: 'Customer Price List',
  businessName: 'Harbour House',
  groupByCategory: true,
  showSku: true,
  showAvailability: true,
  priceColumns: labels.map((label) => ({
    label,
    pricelist: null,
    mode: 'unit',
  })),
  taxNote: 'Prices include applicable tax.',
});
const valuation = buildStockDoc(
  [stock],
  'Inventory valuation',
  true,
  'Harbour House'
);
const report = buildStockDoc(
  [stock],
  'Stock availability',
  false,
  'Harbour House'
);

it.each(TEMPLATES)(
  '$name preserves wide price lists and inventory exports',
  ({ id }) => {
    const pages = pdfPageStreams(
      renderDocument({ ...pricelist, templateId: id }).output()
    );
    expect(pages.length).toBeGreaterThan(1);
    const tablePages = pages.filter((page) => page.includes('(Product)'));
    expect(tablePages.length).toBeGreaterThan(1);
    for (const page of tablePages) {
      expect(page).toContain('(SKU-42)');
      expect(page).toContain('(750 ml)');
    }
    const priceContent = pages.join('\n');
    for (const label of labels) expect(priceContent).toContain(`(${label})`);
    expect(priceContent.match(/7,500,000\.25/g)).toHaveLength(labels.length);
    expect(priceContent).toContain('Prices include applicable tax.');

    const valuationContent = pdfPageStreams(
      renderDocument({ ...valuation, templateId: id }).output()
    ).join('\n');
    for (const value of [
      'North',
      'Annex',
      'SKU-42',
      'FIFO',
      '12,550.00',
      '251,000.00',
    ])
      expect(valuationContent).toContain(value);
    const stockContent = pdfPageStreams(
      renderDocument({ ...report, templateId: id }).output()
    ).join('\n');
    expect(stockContent).toContain('North');
    expect(stockContent).toContain('Annex');
    expect(stockContent).not.toContain('12,550.00');
  }
);

it('restarts page numbers and retains family defaults in a mixed export', () => {
  const preferences = {
    defaultTemplate: 'compact',
    families: { pricelist: 'panorama', stock: 'field-report' },
  };
  const docs = [pricelist, valuation].map((model) => ({
    ...model,
    templateId: resolveTemplate(preferences, model.kind),
  }));
  const combined = renderDocuments(docs);
  const content = pdfPageStreams(combined.output()).join('\n');
  expect(content).toContain('CUSTOMER PRICE LIST');
  expect(content).toContain('INVENTORY VALUATION');
  expect(content.match(/Page 1 of /g)).toHaveLength(2);
});

it('writes representative wide exports for visual review', () => {
  if (!process.env.DOCUMENT_TEMPLATE_REVIEW) return;
  const folder = '/tmp/document-template-preview/cross-document';
  mkdirSync(folder, { recursive: true });
  for (const templateId of COLLECTION_IDS) {
    for (const model of [pricelist, valuation, report]) {
      const pdf = renderDocument({ ...model, templateId });
      writeFileSync(
        `${folder}/${templateId}-${model.fileName}`,
        Buffer.from(pdf.output('arraybuffer'))
      );
    }
  }
});
