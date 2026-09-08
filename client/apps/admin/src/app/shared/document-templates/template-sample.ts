import type { DocumentModel } from '@/utils/print/doc-model';
import type { DocumentFamily } from '@/utils/print/templates/registry';
export function templateSample(
  family: DocumentFamily = 'sales',
  companyName = 'Harbour House'
): DocumentModel {
  const stock = family === 'stock',
    list = family === 'pricelist';
  return {
    kind: stock ? 'stock' : list ? 'pricelist' : family === 'purchases' ? 'po' : 'quotation',
    companyName,
    head: { city: 'Abuja, Nigeria', email: 'Sample contact details' },
    department: 'SAMPLE — Preview only',
    docTitle: stock
      ? 'Stock report'
      : list
        ? 'Price list'
        : family === 'purchases'
          ? 'Purchase order'
          : 'Quotation',
    number: 'SAMPLE-2026-042',
    status: 'draft',
    parties: list
      ? []
      : [
          { heading: 'Issued by', name: companyName },
          {
            heading: stock ? 'Location' : 'Prepared for',
            name: stock ? 'Maitama Store' : 'Sample customer',
          },
        ],
    meta: [
      ['Date', '07 Sep 2026'],
      ['Currency', 'NGN'],
      ['Reference', 'Preview only'],
    ],
    table: {
      columns: [
        { label: 'Beverage' },
        { label: stock ? 'On hand' : 'Quantity', align: 'right' },
        ...(!stock ? [{ label: list ? 'Retail price' : 'Amount', align: 'right' as const }] : []),
      ],
      rows: [
        ['Reserve Red Wine', '750 ml', '6', 'NGN 90,000.00'],
        ['Premium Sparkling Water', '330 ml', '24', 'NGN 36,000.00'],
        ['Single Malt Whisky', '700 ml', '2', 'NGN 140,000.00'],
      ].map(([name, size, qty, amount]) => [
        { text: name, sub: size },
        { text: qty },
        ...(!stock ? [{ text: amount }] : []),
      ]),
    },
    totals:
      stock || list
        ? []
        : [
            { label: 'Subtotal', value: 'NGN 266,000.00', variant: 'normal' },
            { label: 'VAT (7.5%)', value: 'NGN 19,950.00', variant: 'normal' },
            { label: 'Total', value: 'NGN 285,950.00', variant: 'grand' },
          ],
    sections: [
      {
        title: 'Sample document',
        body: 'This preview uses demonstration data. Your documents use your actual business details, products and prices.',
      },
    ],
    signatures: list ? [] : [{ role: 'Prepared by' }, { role: 'Approved by' }],
    fileName: 'template-sample.pdf',
  };
}
