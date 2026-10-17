import Link from 'next/link';
import type { PaymentDoc } from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';
const statuses: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partially paid',
  confirmed: 'Unpaid',
  overdue: 'Overdue',
  draft: 'Draft',
  cancelled: 'Cancelled',
};
export default function PaymentPurchaseContext({
  allocation,
  showBill = false,
}: {
  allocation: PaymentDoc['allocations'][number];
  showBill?: boolean;
}) {
  const bill = allocation.document;
  return (
    <div className="space-y-1 text-xs text-gray-500">
      {showBill &&
        (bill ? (
          <Link
            href={bill.href}
            className="font-medium text-gray-700 underline"
          >
            {bill.label}
          </Link>
        ) : (
          <span>Bill unavailable</span>
        ))}
      {allocation.purchaseOrder && (
        <Link href={allocation.purchaseOrder.href} className="block underline">
          {allocation.purchaseOrder.label}
        </Link>
      )}
      {bill?.status && (
        <p>Current bill: {statuses[bill.status] || bill.status}</p>
      )}
      {bill?.outstanding !== undefined && (
        <p className="tabular-nums">
          Outstanding · {fmtMoney(bill.outstanding)}
        </p>
      )}
    </div>
  );
}
