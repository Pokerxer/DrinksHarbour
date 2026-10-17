import type { OpenInvoice } from '@/services/arAp.service';
import PaymentStatusBadge from './payment-status-badge';
import { invoiceSettlementLabel } from './invoice-return-helpers';
export default function InvoicePaymentBadge({
  invoice,
}: {
  invoice: OpenInvoice;
}) {
  const label = invoiceSettlementLabel(invoice);
  if (label === 'Fully refunded' || label === 'Fully credited')
    return (
      <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-800">
        {label}
      </span>
    );
  return (
    <PaymentStatusBadge
      status={invoice.paymentStatus}
      closed={invoice.state === 'cancelled'}
    />
  );
}
