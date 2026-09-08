import { describe, expect, it } from 'vitest';
import { TEMPLATES, resolveTemplate } from './registry';
import { renderDocument } from '../pdf-render';
import type { DocumentModel } from '../doc-model';
const model: DocumentModel = {
  kind: 'quotation',
  companyName: 'Tenant Trading',
  department: 'Sales',
  docTitle: 'Quotation',
  number: 'Q-42',
  parties: [{ heading: 'Customer', name: 'Ada Trading' }],
  meta: [['Date', '07 Sep 2026']],
  table: {
    columns: [{ label: 'Product' }, { label: 'Amount' }],
    rows: [[{ text: 'Sample beverage' }, { text: 'NGN 12,345.00' }]],
  },
  totals: [{ label: 'Total', value: 'NGN 12,345.00', variant: 'grand' }],
  sections: [],
  signatures: [],
  fileName: 'sample.pdf',
};
describe('template selection', () => {
  it('resolves override then family then tenant default, with safe fallback', () => {
    const preferences = { defaultTemplate: 'modern', families: { stock: 'ledger' } };
    expect(resolveTemplate(preferences, 'transfer')).toBe('ledger');
    expect(resolveTemplate(preferences, 'quotation')).toBe('modern');
    expect(resolveTemplate(preferences, 'return', 'atelier')).toBe('atelier');
    expect(resolveTemplate(undefined, 'bill')).toBe('classic');
    expect(resolveTemplate({ defaultTemplate: 'invalid' }, 'bill')).toBe('classic');
  });
  it('renders eight visually distinct documents without changing content', () => {
    expect(TEMPLATES).toHaveLength(8);
    const outputs = TEMPLATES.map((template) => {
      const doc = renderDocument({ ...model, templateId: template.id });
      const raw = doc.output();
      expect(raw).toContain(`/Subject (Quotation | ${template.name})`);
      return raw;
    });
    expect(new Set(outputs).size).toBe(8);
  });
  it.each([
    'stock',
    'invoice',
    'rfq',
    'po',
    'bill',
    'transfer',
    'return',
    'quotation',
    'proforma',
    'sales-order',
    'pricelist',
  ] as const)('paginates every style for %s', (kind) => {
    for (const template of TEMPLATES) {
      const doc = renderDocument({
        ...model,
        kind,
        templateId: template.id,
        table: {
          ...model.table,
          rows: Array.from({ length: 100 }, (_, i) => [
            { text: `Beverage ${i}` },
            { text: 'NGN 12,345.00' },
          ]),
        },
      });
      expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    }
  });
});
