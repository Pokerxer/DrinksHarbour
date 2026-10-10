import Link from 'next/link';
import type { TransferFollowUp } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
export default function WarehouseTransferStatus({
  transfer,
  outgoing = false,
  manage,
}: {
  transfer: TransferFollowUp;
  outgoing?: boolean;
  manage: boolean;
}) {
  const action =
    transfer.status === 'pending_approval'
      ? 'Review approval'
      : transfer.status === 'confirmed'
        ? 'Review dispatch'
        : transfer.status === 'partially_received'
          ? 'Review remaining receipt'
          : 'Review arrival / receipt';
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-xs font-bold text-gray-800">
        {transfer.reference} ·{' '}
        {outgoing
          ? `This warehouse → ${transfer.destinationWarehouseName || 'Destination warehouse'}`
          : `${transfer.sourceWarehouseName} → this warehouse`}{' '}
        · {units(transfer.quantity)} units
      </p>
      <p className="mt-1 text-xs capitalize text-gray-600">
        {transfer.status.replaceAll('_', ' ')} ·{' '}
        {transfer.followUpReason || 'Review transfer status'}
      </p>
      <p className="mt-1 text-xs text-amber-800">
        {transfer.status === 'pending_approval'
          ? 'Approval is pending. These units are not committed supply.'
          : outgoing
            ? 'Keep unreceived units reserved for this transfer. Confirm dispatch and destination receipt.'
            : 'Arrival unconfirmed. Pending goods are not available stock and do not clear the shortage alert.'}
      </p>
      {manage && (
        <Link
          className="mt-2 inline-block text-xs font-bold text-blue-800 hover:underline"
          href={`/purchases/transfers/${transfer.transferId}`}
        >
          {action} →
        </Link>
      )}
    </div>
  );
}
