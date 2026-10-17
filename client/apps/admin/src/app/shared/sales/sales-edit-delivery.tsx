'use client';
import Link from 'next/link';
import type { SalesOrder } from '@/services/salesOrder.service';
import { routes } from '@/config/routes';
import { canDeliverSale, deliveryLines } from './sales-edit-policy';
import { outstanding, fmtDate } from './sales-helpers';
import {
  fulfillmentLabel,
  fulfillmentUnits,
  warehouseName,
  personName,
} from './sales-fulfillment-view';

export default function SalesEditDelivery({
  so,
  disabled,
}: {
  so: SalesOrder;
  disabled: boolean;
}) {
  if (so.docType !== 'order') return null;
  const lines = deliveryLines(so);
  return (
    <section
      aria-label="Delivery"
      className="mb-3 space-y-3 rounded-xl border border-gray-200 bg-white p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Delivery</h2>
        {canDeliverSale(so) && !disabled && (
          <Link
            href={routes.eCommerce.salesFulfillDetails(so._id)}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
          >
            Deliver remaining items
          </Link>
        )}
      </div>
      <p className="text-xs text-gray-600">
        Selling quantities by line. Returned goods remain part of delivered
        quantities; replacement deliveries require a new order.
      </p>
      <div className="overflow-x-auto">
        <table
          aria-label="Delivery quantities"
          className="w-full text-left text-xs"
        >
          <thead>
            <tr className="border-b">
              <th className="py-2">Product</th>
              <th>Ordered</th>
              <th>Delivered</th>
              <th>Remaining</th>
              {Boolean(so.reservationVersion) && <><th>Reserved</th><th>Waiting</th></>}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line._id} className="border-b border-gray-100">
                <th className="py-2 font-medium">
                  {line.name || line.description || line.sku || 'Product'}
                </th>
                <td>{line.quantity}</td>
                <td>{line.fulfilledQty || 0}</td>
                <td>{outstanding(line)}</td>
                {Boolean(so.reservationVersion) && <>
                  <td>{line.reservedQty || 0}
                    {(line.reservations || []).map(hold=><div key={hold.warehouseId} className="text-gray-500">{hold.warehouseName || 'Reservation location'}: {hold.quantity}</div>)}
                  </td>
                  <td>{so.orderStatus === 'cancelled' ? 0 : line.waitingQty ?? Math.max(0,outstanding(line)-(line.reservedQty || 0))}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!(so.fulfillments || []).length ? (
        <p className="text-xs text-gray-500">No deliveries recorded.</p>
      ) : (
        <details>
          <summary className="cursor-pointer text-xs font-semibold">
            Delivery history ({so.fulfillments.length})
          </summary>
          <ul className="divide-y divide-gray-100">
            {so.fulfillments.map((row, index) => (
              <li key={row._id} className="py-2 text-xs">
                <span className="font-semibold">
                  {fulfillmentLabel(row, index)}
                </span>
                <p className="mt-1 text-gray-600">
                  {[
                    fmtDate(row.at),
                    `${fulfillmentUnits(row)} selling units`,
                    warehouseName(row.warehouseId),
                    personName(row.by),
                    row.status,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {so.orderStatus === 'draft' && (
        <p className="text-xs text-gray-600">
          Confirm the order before delivering goods.
        </p>
      )}
      {so.orderStatus === 'cancelled' && (
        <p className="text-xs text-gray-600">
          Cancelled orders cannot be delivered.
        </p>
      )}
    </section>
  );
}
