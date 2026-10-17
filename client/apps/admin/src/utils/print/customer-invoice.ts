import {
  creditReviewPending,
  invoiceSettlementLabel,
  returnLabel,
} from '@/app/shared/accounting/invoice-return-helpers';
import type { SavedInvoice } from '@/services/arAp.service';
import type { DocumentModel } from './doc-model';
import { requestDocumentExport } from './document-export';
import { fmtAmt, fmtDate } from './print-shared';
import { invoiceTotals } from '@/app/shared/accounting/invoice-detail-helpers';

/** Saved invoices use the same renderer/preferences/dialog as inventory exports. */
export function buildCustomerInvoice(invoice: SavedInvoice): DocumentModel {
  const issuer = invoice.detailContext?.issuer;
  const money = (amount?: number) => fmtAmt(amount, invoice.currency || 'NGN');
  const banks = issuer?.bankAccounts || [];
  return {
    kind: 'invoice',
    companyName: issuer?.name || 'DrinksHarbour',
    // An explicit head prevents a missing tenant address becoming platform PII.
    head: {
      address: issuer?.address?.street,
      city: [
        issuer?.address?.city,
        issuer?.address?.state,
        issuer?.address?.country,
      ]
        .filter(Boolean)
        .join(', '),
    },
    department: 'Accounting',
    docTitle: 'Customer Invoice',
    number: invoice.number,
    status:
      invoice.state === 'posted'
        ? invoiceSettlementLabel(invoice).toUpperCase()
        : invoice.state.toUpperCase(),
    watermark:
      invoice.state === 'posted' ? undefined : invoice.state.toUpperCase(),
    parties: [
      {
        heading: 'Bill To',
        name: invoice.customerSnapshot?.name || 'Walk-in customer',
        lines: [
          invoice.customerSnapshot?.phone,
          invoice.customerSnapshot?.email,
          [
            invoice.invoiceAddress?.street,
            invoice.invoiceAddress?.city,
            invoice.invoiceAddress?.state,
            invoice.invoiceAddress?.country,
          ]
            .filter(Boolean)
            .join(', '),
        ].filter((value): value is string => !!value),
      },
    ],
    meta: [
      ['Date', fmtDate(invoice.date)],
      ['Due date', fmtDate(invoice.dueDate)],
      ['Currency', invoice.currency],
      ['Source', invoice.sourceNumber || invoice.source],
    ],
    table: {
      columns: [
        { label: 'Description' },
        { label: 'Qty', align: 'right' },
        { label: 'Unit price', align: 'right' },
        { label: 'Amount', align: 'right' },
      ],
      rows: invoice.items.map((item) =>
        item.lineType === 'product'
          ? [
              {
                text: item.name,
                sub: [item.description, item.uom].filter(Boolean).join(' · '),
              },
              { text: String(item.quantity) },
              { text: money(item.unitPrice) },
              { text: money(item.lineTotal) },
            ]
          : [
              {
                text: item.description || item.name,
                strong: item.lineType === 'section',
              },
              { text: '' },
              { text: '' },
              { text: '' },
            ]
      ),
    },
    totals: invoiceTotals(invoice).map(([label, amount]) => ({
      label,
      value: money(amount),
      variant:
        label === 'Outstanding'
          ? 'grand'
          : label === 'Total'
            ? 'strong'
            : 'normal',
    })),
    sections: [
      ...(invoice.returnSummary && invoice.returnSummary.status !== 'none'
        ? [
            {
              title: 'Returned goods',
              body: [
                returnLabel(invoice),
                `Recorded returned units: ${invoice.returnSummary.recordedUnits} of ${invoice.returnSummary.soldUnits} invoiced units`,
                creditReviewPending(invoice)
                  ? 'Credit review pending'
                  : undefined,
                (invoice.refundedAmount || 0) > 0
                  ? `Verified refunds: ${money(invoice.refundedAmount)}`
                  : undefined,
                (invoice.creditNoteAmount || 0) > 0
                  ? `Posted credit notes: ${money(invoice.creditNoteAmount)}`
                  : undefined,
                'Original invoice details remain unchanged. Goods returns, credit notes and monetary refunds are separate records.',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ]
        : []),
      ...(invoice.state !== 'cancelled' && banks.length
        ? [
            {
              title: 'Payment Instructions',
              body:
                `Reference: ${invoice.number}\n` +
                banks
                  .map((account) =>
                    [
                      account.bankName,
                      account.accountNumber,
                      account.accountName,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  )
                  .join('\n'),
            },
          ]
        : []),
      ...(invoice.notes ? [{ title: 'Notes', body: invoice.notes }] : []),
      ...(invoice.terms ? [{ title: 'Terms', body: invoice.terms }] : []),
    ],
    signatures: [{ role: 'Prepared By' }, { role: 'Customer Acknowledgement' }],
    fileName: `Invoice ${invoice.number.replace(/[^\w.-]/g, '-')}.pdf`,
  };
}
export function printCustomerInvoice(invoice: SavedInvoice): void {
  requestDocumentExport(buildCustomerInvoice(invoice));
}
