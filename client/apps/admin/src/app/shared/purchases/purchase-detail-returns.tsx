import Link from 'next/link';
import { routes } from '@/config/routes';
import type { VendorReturn } from '@/services/vendorReturn.service';
import { fmtAmount } from './types';

export default function PurchaseDetailReturns({
  returns,
  currency,
}: {
  returns: VendorReturn[];
  currency: string;
}) {
  if (returns.length === 0) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Returns ({returns.length})
        </h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
              Return #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
              Date
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Items
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Total
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
              Status
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
              Refund
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {returns.map((r) => {
            const statusColor: Record<string, string> = {
              draft: 'bg-gray-100 text-gray-600',
              confirmed: 'bg-blue-100 text-blue-700',
              requested: 'bg-amber-100 text-amber-700',
              shipped: 'bg-indigo-100 text-indigo-700',
              in_transit: 'bg-purple-100 text-purple-700',
              received: 'bg-green-100 text-green-700',
              refunded: 'bg-emerald-100 text-emerald-700',
              rejected: 'bg-red-100 text-red-700',
              cancelled: 'bg-gray-100 text-gray-500',
            };
            return (
              <tr key={r._id}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {r.returnNumber}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {r.returnDate
                    ? new Date(r.returnDate).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {r.items.reduce((s, i) => s + i.quantity, 0)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {r.currency} {fmtAmount(r.totalAmount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusColor[r.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {r.refundStatus && r.refundStatus !== 'none' ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        r.refundStatus === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : r.refundStatus === 'processing'
                            ? 'bg-blue-100 text-blue-700'
                            : r.refundStatus === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {r.refundStatus}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={routes.eCommerce.vendorReturnDetails(r._id)}
                    className="text-xs font-medium text-[#b20202] hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50">
            <td
              colSpan={3}
              className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
            >
              Total Returned
            </td>
            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
              {currency}{' '}
              {fmtAmount(returns.reduce((s, r) => s + r.totalAmount, 0))}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
