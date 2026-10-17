import type { OpenInvoice } from '@/services/arAp.service';
import { returnLabel } from './invoice-return-helpers';
export default function InvoiceReturnBadge({
  invoice,
}: {
  invoice: OpenInvoice;
}) {
  const label = returnLabel(invoice);
  if (!label) return null;
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${invoice.returnSummary?.needsReview ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}
    >
      {label}
    </span>
  );
}
