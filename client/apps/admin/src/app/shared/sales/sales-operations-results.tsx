import Link from 'next/link';
import type { SalesOrder } from '@/services/salesOrder.service';
import { routes } from '@/config/routes';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { ORDER_STATUS_BADGE, orderStatusLabel } from './sales-helpers';
import {
  operationsQuantity,
  operationsWarehouse,
  type OperationsKind,
} from './sales-operations-helpers';

export default function SalesOperationsResults({
  orders,
  kind,
  filtered,
}: {
  orders: SalesOrder[];
  kind: OperationsKind;
  filtered: boolean;
}) {
  if (!orders.length)
    return (
      <div className="px-4 py-10 text-center">
        <h2 className="font-lexend text-sm font-semibold text-gray-900">
          {filtered
            ? 'No matching orders'
            : kind === 'fulfill'
              ? 'Nothing awaiting fulfillment'
              : 'No sales returns yet'}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {filtered
            ? 'Change your search or clear the filters.'
            : kind === 'fulfill'
              ? 'Confirmed orders with remaining delivery quantities appear here.'
              : 'Recorded goods returns from Sales and POS appear here.'}
        </p>
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">
          {kind === 'fulfill' ? 'Delivery queue' : 'Returned goods'}
        </caption>
        <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
          <tr>
            {[
              'Order',
              'Customer',
              'Order warehouse',
              'Order status',
              kind === 'fulfill' ? 'To deliver (qty)' : 'Returned qty',
              'Order value',
              'Review',
            ].map((label, i) => (
              <th
                key={label}
                scope="col"
                className={`px-3 py-2 font-medium ${i >= 4 ? 'text-right' : ''}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => (
            <tr key={order._id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono font-medium">
                <Link
                  className="text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  href={routes.eCommerce.salesDetails(order._id)}
                >
                  {order.soNumber}
                </Link>
              </td>
              <td className="max-w-44 break-words px-3 py-2 text-gray-700">
                {order.customerSnapshot?.name || 'Walk-in customer'}
              </td>
              <td className="max-w-40 break-words px-3 py-2 text-gray-600">
                {operationsWarehouse(order).name}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-xs ${ORDER_STATUS_BADGE[order.orderStatus || 'confirmed']}`}
                >
                  {orderStatusLabel(order.orderStatus)}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {operationsQuantity(order, kind).toLocaleString('en-NG')}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {fmtCur(order.total, order.currency)}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={
                    kind === 'fulfill'
                      ? routes.eCommerce.salesFulfillDetails(order._id)
                      : routes.eCommerce.salesReturnDetails(order._id)
                  }
                  className="inline-flex min-h-9 items-center whitespace-nowrap rounded-md border border-gray-200 px-3 text-xs font-semibold text-brand hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  {kind === 'fulfill' ? 'Review delivery' : 'Review return'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
