// Facade for the printed purchase documents. Builders in ./print/* turn each
// server record into a DocumentModel; renderDocument() produces the real
// branded PDF. print* helpers save the file directly — no browser print dialog.
import { COMPANY } from './print/print-shared';
import { renderDocument } from './print/pdf-render';
import type { DocumentModel } from './print/doc-model';

export { COMPANY };

export type { DocumentModel } from './print/doc-model';

export {
  buildBillInvoice,
} from './print/bill-print';
export {
  buildPOInvoice,
} from './print/po-print';
export {
  buildRFQInvoice,
} from './print/rfq-print';
export {
  buildTransferInvoice,
} from './print/transfer-print';
export {
  buildReturnInvoice,
} from './print/return-print';

import {
  buildBillInvoice as _bill,
} from './print/bill-print';
import {
  buildPOInvoice as _po,
} from './print/po-print';
import {
  buildRFQInvoice as _rfq,
} from './print/rfq-print';
import {
  buildTransferInvoice as _transfer,
} from './print/transfer-print';
import {
  buildReturnInvoice as _return,
} from './print/return-print';

function downloadPdf(model: DocumentModel): void {
  const doc = renderDocument(model);
  // doc.save triggers the browser download; in non-browser environments it is
  // a no-op, so fall back to opening the blob (keeps SSR/tests safe).
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

export function printBillInvoice(
  bill: Parameters<typeof _bill>[0],
  companyName: string
): void {
  downloadPdf(_bill(bill, companyName));
}

export function printPOInvoice(
  po: Parameters<typeof _po>[0],
  companyName: string
): void {
  downloadPdf(_po(po, companyName));
}

export function printRFQInvoice(
  po: Parameters<typeof _rfq>[0],
  companyName: string
): void {
  downloadPdf(_rfq(po, companyName));
}

export function printTransferInvoice(
  transfer: Parameters<typeof _transfer>[0],
  companyName: string
): void {
  downloadPdf(_transfer(transfer, companyName));
}

export function printReturnInvoice(
  ret: Parameters<typeof _return>[0],
  companyName: string
): void {
  downloadPdf(_return(ret, companyName));
}
