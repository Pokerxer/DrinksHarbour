import { describe, it, expect } from 'vitest';
import { renderDocument, safeText } from './pdf-render';
import type { DocumentModel } from './doc-model';

const model: DocumentModel = {
  kind: 'rfq',
  companyName: 'DrinksHarbour',
  department: 'Purchase Department',
  docTitle: 'Request for Quotation',
  number: 'RFQ-2026-0001',
  status: 'draft',
  parties: [
    { heading: 'Quote To (Buyer)', name: 'DrinksHarbour' },
    { heading: 'Vendor / Supplier', name: 'Meads & Sons Distribution' },
  ],
  meta: [
    ['Currency', 'NGN'],
    ['RFQ Date', '01 Aug 2026'],
  ],
  table: {
    columns: [{ label: 'Product' }, { label: 'Qty', align: 'center' }],
    rows: [
      [
        { text: 'Hennessy VS Cognac – 70cl', sub: 'HNS-VS-070' },
        { text: '24' },
      ],
    ],
  },
  totals: [{ label: 'Items Total (1 line)', value: '', variant: 'grand' }],
  sections: [{ title: 'How to Respond', body: 'Quote before 31 Aug 2026.' }],
  signatures: [{ role: 'Requested by' }, { role: 'Vendor Quote & Stamp' }],
  fileName: 'Request for Quotation RFQ-2026-0001.pdf',
};

describe('renderDocument', () => {
  it('produces a real PDF document with metadata and at least one page', () => {
    const doc = renderDocument(model);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const bytes = doc.output('arraybuffer') as ArrayBuffer;
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // %PDF magic header — a real PDF, not a print-dialog page
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw).toContain('/Title (Request for Quotation RFQ-2026-0001)');
  });

  it('keeps every drawn string inside the built-in font encoding', () => {
    // jsPDF's Helvetica is WinAnsi-encoded: '✓' used to print as an apostrophe
    // and U+2212 MINUS as a double quote, on real vendor bills.
    expect(safeText('✓ Ada Obi')).toBe(' Ada Obi');
    expect(safeText('− NGN 2,000.00')).toBe('- NGN 2,000.00');
    expect(safeText('₦4,300')).toBe('NGN 4,300');
    // Latin-1 and the WinAnsi extras must survive untouched
    expect(safeText('Hennessy VS – 70cl · Ménage')).toBe(
      'Hennessy VS – 70cl · Ménage'
    );
    // Anything else is flagged rather than rendered as an unrelated glyph
    expect(safeText('北京')).toBe('??');
  });

  it('flows long tables across multiple pages', () => {
    const rows = Array.from({ length: 80 }, (_, i) => [
      { text: `Product ${i + 1}`, sub: `SKU-${i}` },
      { text: String(i + 1) },
    ]);
    const long = { ...model, table: { ...model.table, rows } };
    const doc = renderDocument(long);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
