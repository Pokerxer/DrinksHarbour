// Facade for the printed sales documents — mirrors ./purchaseInvoice.ts.
// buildSalesDoc turns a SalesOrder into a DocumentModel; renderDocument
// produces the real branded PDF. print* helpers save the file directly, with a
// blob-open fallback so non-browser environments stay safe.
import { requestDocumentExport } from './print/document-export';
import type { DocumentModel } from './print/doc-model';
import {
  buildSalesDoc,
  type SalesDocVariant,
} from './print/so-print';
import type { SalesOrder } from '@/services/salesOrder.service';

export type { DocumentModel } from './print/doc-model';
export { buildSalesDoc, type SalesDocVariant } from './print/so-print';

function downloadPdf(model: DocumentModel): void {
  requestDocumentExport(model);
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
