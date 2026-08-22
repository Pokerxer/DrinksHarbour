// Facade for the printed purchase documents. The builders live in ./print/*
// (one module per document type) — import from here at call sites.
import { COMPANY } from './print/print-shared';

export function openPrint(html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=900,height=1100,scrollbars=yes');
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export { COMPANY };

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

export function printBillInvoice(
  bill: Parameters<typeof _bill>[0],
  companyName: string
): void {
  openPrint(_bill(bill, companyName));
}

export function printPOInvoice(
  po: Parameters<typeof _po>[0],
  companyName: string
): void {
  openPrint(_po(po, companyName));
}

export function printRFQInvoice(
  po: Parameters<typeof _rfq>[0],
  companyName: string
): void {
  openPrint(_rfq(po, companyName));
}

export function printTransferInvoice(
  transfer: Parameters<typeof _transfer>[0],
  companyName: string
): void {
  openPrint(_transfer(transfer, companyName));
}

export function printReturnInvoice(
  ret: Parameters<typeof _return>[0],
  companyName: string
): void {
  openPrint(_return(ret, companyName));
}
