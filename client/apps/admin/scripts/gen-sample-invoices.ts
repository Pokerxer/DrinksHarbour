// One-off visual verification: build real PDFs from the actual builders and
// save them for inspection. Run: node --experimental-strip-types scripts/gen-sample-invoices.ts
import { writeFileSync } from 'node:fs';
import { buildRFQInvoice } from '../src/utils/print/rfq-print';
import { buildPOInvoice } from '../src/utils/print/po-print';
import { renderDocument } from '../src/utils/print/pdf-render';

const rfq = {
  _id: 'rfq-1',
  poNumber: 'RFQ-2026-0001',
  vendorName: 'Meads & Sons Distribution',
  vendorReference: 'MSD-4471',
  currency: 'NGN',
  status: 'draft',
  type: 'rfq',
  createdAt: '2026-08-01T10:00:00.000Z',
  expectedArrival: '2026-09-01T00:00:00.000Z',
  validUntil: '2026-08-31T00:00:00.000Z',
  termsConditions:
    'Quotes valid for 14 days. Delivery to Maitama store. All prices must be inclusive of VAT where applicable.',
  notes: 'Urgent restock before the Abuja weekend rush.',
  items: [
    { subProductId: 'sp-1', subProductName: 'Hennessy VS Cognac', sizeName: '70cl', sku: 'HNS-VS-070', quantity: 24, packagingQty: 6, packaging: 'case', receivedQty: 0 },
    { subProductId: 'sp-2', subProductName: 'Moet Imperial Brut', sizeName: '75cl', sku: 'MOE-IMP-075', quantity: 12, packagingQty: 6, packaging: 'case', receivedQty: 0 },
    { subProductId: 'sp-3', subProductName: 'Jameson Irish Whiskey', sizeName: '70cl', sku: 'JAM-IRW-070', quantity: 36, packagingQty: 12, packaging: 'case', receivedQty: 0 },
    { subProductId: 'sp-4', subProductName: 'Chivas Regal 12 Year', sizeName: '75cl', sku: 'CHV-12Y-075', quantity: 18, packagingQty: 6, packaging: 'case', receivedQty: 0 },
    { subProductId: 'sp-5', subProductName: 'Cloudy Bay Sauvignon Blanc', sizeName: '75cl', sku: 'CLB-SB-075', quantity: 48, packagingQty: 6, packaging: 'case', receivedQty: 0 },
    { subProductId: 'sp-6', subProductName: 'Heineken Lager', sizeName: '65cl', sku: 'HNK-LGR-065', quantity: 120, packagingQty: 24, packaging: 'crate', receivedQty: 0 },
  ],
} as any;

const po = {
  ...rfq,
  _id: 'po-1',
  poNumber: 'PO-2026-0100',
  type: 'po',
  status: 'partially_received',
  paymentTerms: 'Net 30',
  approvedByName: 'Ada Obi',
  warehouse: { _id: 'w1', name: 'Maitama Store', code: 'MTM' },
  isBackorder: true,
  originalPO: 'PO-2026-0088',
  confirmationDate: '2026-08-02T09:00:00.000Z',
  items: [
    { subProductId: 'sp-1', subProductName: 'Hennessy VS Cognac', sizeName: '70cl', sku: 'HNS-VS-070', uom: 'Units', quantity: 480, packagingQty: 6, packaging: 'case', receivedQty: 480, unitCost: 42000, taxRate: 7.5 },
    { subProductId: 'sp-2', subProductName: 'Moet Imperial Brut', sizeName: '75cl', sku: 'MOE-IMP-075', uom: 'Units', quantity: 240, packagingQty: 6, packaging: 'case', receivedQty: 96, returnedQty: 0, unitCost: 68500, taxRate: 7.5 },
    { subProductId: 'sp-3', subProductName: 'Jameson Irish Whiskey', sizeName: '70cl', sku: 'JAM-IRW-070', uom: 'Units', quantity: 600, packagingQty: 12, packaging: 'case', receivedQty: 0, unitCost: 18500, taxRate: 7.5 },
    { subProductId: 'sp-5', subProductName: 'Cloudy Bay Sauvignon Blanc', sizeName: '75cl', sku: 'CLB-SB-075', uom: 'Units', quantity: 96, packagingQty: 6, packaging: 'case', receivedQty: 60, unitCost: 32000, taxRate: 7.5 },
  ],
} as any;

const outDir = process.argv[2] ?? '/tmp/invoice-preview';
import { mkdirSync } from 'node:fs';
mkdirSync(outDir, { recursive: true });

for (const [name, model] of [
  ['sample-rfq', buildRFQInvoice(rfq, 'DrinksHarbour')],
  ['sample-po', buildPOInvoice(po, 'DrinksHarbour')],
] as const) {
  const doc = renderDocument(model);
  writeFileSync(`${outDir}/${name}.pdf`, Buffer.from(doc.output('arraybuffer')));
  console.log(`wrote ${outDir}/${name}.pdf — pages: ${doc.getNumberOfPages()}`);
}
