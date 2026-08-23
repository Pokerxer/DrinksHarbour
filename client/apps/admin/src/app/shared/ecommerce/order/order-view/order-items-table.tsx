'use client';

import Image from 'next/image';
import { Title } from 'rizzui';
import { PiTicketBold } from 'react-icons/pi';
import type { Order } from '@/services/order.service';
import { formatCurrency } from './format';

/** Groups order items by vendor for the payout breakdown shown under the
 *  items table — what the platform owes each vendor on this order. */
export function groupVendors(order: Order) {
  const vendorMap = new Map<
    string,
    { name: string; revenue: number; payout: number; items: number }
  >();
  for (const item of order.items) {
    const id = item.tenant?._id ?? '__unknown__';
    const name = item.tenant?.name ?? 'Unknown Vendor';
    const prev = vendorMap.get(id) ?? { name, revenue: 0, payout: 0, items: 0 };
    vendorMap.set(id, {
      name,
      revenue: prev.revenue + (item.itemSubtotal ?? 0),
      payout: prev.payout + (item.tenantRevenueShare ?? 0),
      items: prev.items + item.quantity,
    });
  }
  return Array.from(vendorMap.values());
}

/** Items table + per-vendor revenue breakdown + totals block — the entire
 *  "left column top" of the order detail page. */
export default function OrderItemsTable({ order }: { order: Order }) {
  const vendors = groupVendors(order);

  return (
    <div className="pb-5">
      <Title
        as="h3"
        className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg"
      >
        Order Items
      </Title>
      <div className="overflow-x-auto rounded-lg border border-muted">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th scope="col" className="px-5 py-3 text-left">
                Product
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Unit Price
              </th>
              <th scope="col" className="px-5 py-3 text-center">
                Qty
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {order.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {item.product?.images?.[0]?.url ? (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                        <Image
                          src={item.product.images[0].url}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-md bg-gray-100" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.product?.name ?? '—'}
                      </p>
                      {item.subproduct?.name && (
                        <p className="text-xs text-gray-500">
                          {item.subproduct.name}
                        </p>
                      )}
                      {(item.size?.displayName || item.size?.size) && (
                        <p className="text-xs text-gray-500">
                          Size: {item.size.displayName || item.size.size}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.tenant?.name && (
                          <span className="inline-flex rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            {item.tenant.name}
                          </span>
                        )}
                        {item.packRateApplied && (
                          <span className="inline-flex rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                            Pack rate
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  {formatCurrency(item.priceAtPurchase, order.currency)}
                </td>
                <td className="px-5 py-4 text-center font-semibold">
                  {item.quantity}
                </td>
                <td className="px-5 py-4 text-right">
                  {formatCurrency(item.itemSubtotal, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vendors.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Vendor Revenue
          </p>
          <div className="overflow-hidden rounded-xl border border-muted">
            {vendors.map((v, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-muted px-4 py-3 last:border-0 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {v.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {v.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {v.items} item{v.items === 1 ? '' : 's'} · revenue{' '}
                      {formatCurrency(v.revenue, order.currency)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(v.payout, order.currency)}
                  </p>
                  <p className="text-[10px] text-gray-400">vendor payout</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="border-t border-muted pt-7 @5xl:mt-3">
        <div className="ms-auto max-w-lg space-y-4">
          <div className="flex justify-between text-sm font-medium text-gray-700">
            Subtotal <span>{formatCurrency(order.subtotal, order.currency)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between text-sm font-medium text-green-600">
              <span>
                Discount
                {order.coupon?.code && (
                  <span className="ms-2 inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    <PiTicketBold className="h-3 w-3" />
                    {order.coupon.code}
                  </span>
                )}
              </span>
              <span>
                -{formatCurrency(order.discountTotal, order.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-medium text-gray-700">
            Shipping{' '}
            <span>
              {order.shippingFee === 0
                ? 'Free'
                : formatCurrency(order.shippingFee, order.currency)}
            </span>
          </div>
          {order.taxAmount > 0 && (
            <div className="flex justify-between text-sm font-medium text-gray-700">
              Tax <span>{formatCurrency(order.taxAmount, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-muted pt-4 text-base font-semibold text-gray-900">
            Total <span>{formatCurrency(order.totalAmount, order.currency)}</span>
          </div>
          {!!order.platformCommissionTotal && (
            <div className="flex items-center justify-between rounded-lg bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-600 dark:text-violet-400">
              Platform Profit
              <span>
                {formatCurrency(
                  order.platformCommissionTotal,
                  order.currency
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
