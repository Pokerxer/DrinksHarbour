// Facade for the printed sales documents — mirrors ./purchaseInvoice.ts.
// buildSalesDoc turns a SalesOrder into a DocumentModel; renderDocument
// produces the real branded PDF. print* helpers save the file directly, with a
// blob-open fallback so non-browser environments stay safe.
import { renderDocument } from './print/pdf-render';
import type { DocumentModel } from './print/doc-model';
import {
  buildSalesDoc,
  type SalesDocVariant,
} from './print/so-print';
import type { SalesOrder } from '@/services/salesOrder.service';

export type { DocumentModel } from './print/doc-model';
export { buildSalesDoc, type SalesDocVariant } from './print/so-print';

function downloadPdf(model: DocumentModel): void {
  const doc = renderDocument(model);
  try {
    doc.save(model.fileName);
  } catch {
    const blob = new Blob([doc.output('arraybuffer')], {
      type: 'application/pdf',
    });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function printQuotation(so: SalesOrder, companyName: string): void {
  downloadPdf(buildSalesDoc(so, companyName, 'quotation'));
}

export function printProformaInvoice(
  so: SalesOrder,
  companyName: string
): void {
  downloadPdf(buildSalesDoc(so, companyName, 'proforma'));
}

export function printSalesInvoice(so: SalesOrder, companyName: string): void {
  downloadPdf(buildSalesDoc(so, companyName, 'sales-order'));
}
