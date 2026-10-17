import type {
  CustomerReturn,
  ReturnIssuer,
} from '@/services/customerReturns.service';
import type { DocumentModel } from './doc-model';
const quantity = (value: number | null) =>
  value === null ? 'Unknown' : String(value);
export function buildCustomerReturn(
  rows: CustomerReturn[],
  issuer: ReturnIssuer,
  scope: string
): DocumentModel {
  const total = rows.reduce((sum, row) => sum + row.returned, 0);
  const unknown = rows.filter(
    (row) => row.stockEvidence === 'unverified'
  ).length;
  return {
    kind: 'return',
    companyName: issuer.name,
    head: issuer.address
      ? {
          address: issuer.address.street,
          city: [
            issuer.address.city,
            issuer.address.state,
            issuer.address.country,
          ]
            .filter(Boolean)
            .join(', '),
        }
      : {},
    department: 'Inventory',
    docTitle: 'Customer Return Note',
    number:
      rows.length === 1
        ? rows[0].reference || rows[0].sourceNumber
        : 'Customer returns',
    status: unknown ? 'REVIEW STOCK EVIDENCE' : 'RECORDED',
    parties: [],
    meta: [
      ['Scope', scope],
      ['Return lines', String(rows.length)],
    ],
    table: {
      columns: [
        { label: 'Product / reference' },
        { label: 'Returned', align: 'right' },
        { label: 'Restocked', align: 'right' },
        { label: 'Not restocked', align: 'right' },
      ],
      rows: rows.map((row) => [
        {
          text: row.product,
          sub: `${row.size} · ${row.sourceNumber} · ${row.destinations?.map((location) => location.name).join(', ') || row.warehouse?.name || 'Destination unavailable'}`,
        },
        { text: String(row.returned) },
        { text: quantity(row.restocked) },
        { text: quantity(row.notRestocked) },
      ]),
    },
    totals: [
      { label: 'Returned units', value: String(total), variant: 'grand' },
    ],
    sections: [
      {
        title: 'Stock disposition',
        body: `${unknown} line(s) have incomplete stock evidence. Unknown quantities are not zero. This document records returned goods; consult the original order for refund status.`,
      },
      ...rows.map((row) => ({
        title: row.reference || row.sourceNumber,
        body: [
          row.source === 'sales'
            ? 'Sales cumulative returned quantity'
            : 'POS return',
          row.date
            ? `Recorded: ${new Date(row.date).toLocaleDateString('en-GB')}`
            : 'Date unavailable',
          row.reason,
        ]
          .filter(Boolean)
          .join('\n'),
      })),
    ],
    signatures: [{ role: 'Received By' }],
    fileName: `Customer Returns ${rows.length === 1 ? (rows[0].reference || rows[0].sourceNumber).replace(/[^\w.-]/g, '-') : 'Page'}.pdf`,
  };
}
