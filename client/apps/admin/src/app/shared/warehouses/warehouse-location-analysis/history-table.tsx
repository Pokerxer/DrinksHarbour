import Link from 'next/link';
import { routes } from '@/config/routes';
import type { HistoryKind, HistoryRow } from '@/services/warehouseHistory.service';
export function historyLink(row: HistoryRow) {
  if (!row.documentId) return null;
  return row.documentType === 'purchase'
    ? routes.eCommerce.purchaseDetails(row.documentId)
    : row.documentType === 'transfer'
      ? routes.eCommerce.stockTransferDetails(row.documentId)
      : routes.warehouses.product(row.documentId);
}
export { movementQuantity } from './history-tools';
import { movementQuantity } from './history-tools';

function statusClass(status: string) {
  if (['received', 'completed', 'transfer_in', 'returned', 'paid'].includes(status))
    return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10';
  if (['cancelled', 'rejected', 'return_out'].includes(status))
    return 'bg-red-50 text-red-700 ring-red-600/10';
  if (['pending_approval', 'partially_received', 'in_transit', 'confirmed'].includes(status))
    return 'bg-amber-50 text-amber-700 ring-amber-600/10';
  return 'bg-gray-100 text-gray-600 ring-gray-500/10';
}
export default function HistoryTable({ rows, kind }: { rows: HistoryRow[]; kind: HistoryKind }) {
  const movements = kind === 'movements' || kind === 'transfer_movements';
  const cell = 'px-4 py-4 text-left';
  return (
    <div className="max-h-[640px] overflow-auto rounded-xl border border-[#ece4d6] bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="sticky top-0 z-10 bg-[#f8f5f0] text-xs font-semibold uppercase tracking-wide text-[#8b7a6b]">
          <tr>
            {[
              'Reference / Product',
              'Created',
              movements ? 'Movement type' : 'Status',
              movements
                ? 'Stock change'
                : kind === 'purchases'
                  ? 'Received here'
                  : 'Sent / Received',
              ...(movements
                ? [
                    ...(kind === 'transfer_movements' ? ['Transferred in', 'Transferred out'] : []),
                    'Balance before',
                    'Balance after',
                    'Recorded by',
                  ]
                : kind === 'purchases'
                  ? [
                      'Returned',
                      'Purchased after returns',
                      'Purchase value after returns',
                      'Order line total',
                    ]
                  : ['Transferred in', 'Transferred out', 'Returned', 'Document value']),
            ].map((label) => (
              <th scope="col" key={label} className={cell}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const href = historyLink(row);
            const stockChange = movementQuantity(row);
            const label = movements ? row.description : row.reference;
            return (
              <tr key={row.id} className="transition-colors hover:bg-[#fcfaf7]">
                <td className={cell}>
                  {href ? (
                    <Link className="font-semibold text-[#b20202] hover:underline" href={href}>
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    {movements ? row.reference : row.description}
                  </div>
                </td>
                <td className={`${cell} whitespace-nowrap`}>
                  <span className="block font-medium text-gray-700">
                    {new Date(row.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="mt-1 block text-xs text-gray-400">
                    {new Date(row.date).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </td>
                <td className={cell}>
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusClass(row.status)}`}
                  >
                    {row.status.replaceAll('_', ' ')}
                  </span>
                </td>
                <td
                  className={`${cell} font-semibold tabular-nums ${movements ? ((stockChange ?? 0) < 0 ? 'text-red-700' : (stockChange ?? 0) > 0 ? 'text-emerald-700' : 'text-gray-500') : 'text-gray-800'}`}
                >
                  {movements && (stockChange ?? 0) > 0 ? '+' : ''}
                  {(movements ? stockChange : row.quantity)?.toLocaleString() ?? '—'}
                  {movements && row.status === 'adjusted' && (
                    <div className="mt-1 text-xs font-normal text-gray-500">
                      Recount: {row.quantity.toLocaleString()}
                    </div>
                  )}
                </td>
                {movements ? (
                  <>
                    {kind === 'transfer_movements' && (
                      <>
                        <td className={`${cell} font-semibold tabular-nums`}>
                          {row.transferInQuantity?.toLocaleString() ?? '—'}
                        </td>
                        <td className={`${cell} font-semibold tabular-nums`}>
                          {row.transferOutQuantity?.toLocaleString() ?? '—'}
                        </td>
                      </>
                    )}
                    <td className={cell}>{row.balanceBefore?.toLocaleString() ?? '—'}</td>
                    <td className={cell}>{row.balanceAfter?.toLocaleString() ?? '—'}</td>
                    <td className={cell}>{row.actor}</td>
                  </>
                ) : (
                  <>
                    {kind === 'purchases' && (
                      <>
                        <td className={`${cell} tabular-nums`}>
                          {row.returned?.toLocaleString() ?? '—'}
                        </td>
                        <td className={`${cell} font-semibold tabular-nums`}>
                          {row.purchasedQuantity?.toLocaleString() ?? '—'}
                        </td>
                        <td className={`${cell} whitespace-nowrap tabular-nums`}>
                          {row.netPurchaseAmount === undefined
                            ? '—'
                            : `${row.currency || 'NGN'} ${row.netPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </td>
                      </>
                    )}
                    {kind === 'transfers' && (
                      <>
                        <td className={`${cell} font-semibold tabular-nums`}>
                          {row.transferInQuantity?.toLocaleString() ?? '—'}
                        </td>
                        <td className={`${cell} font-semibold tabular-nums`}>
                          {row.transferOutQuantity?.toLocaleString() ?? '—'}
                        </td>
                        <td className={cell}>{row.returned?.toLocaleString() ?? '0'}</td>
                      </>
                    )}
                    <td className={`${cell} whitespace-nowrap font-semibold tabular-nums`}>
                      {row.amount === undefined
                        ? '—'
                        : `${row.currency || 'NGN'} ${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
