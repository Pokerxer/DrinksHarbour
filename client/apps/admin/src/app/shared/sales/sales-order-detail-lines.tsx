'use client';

import { PiPackage } from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { outstanding, fmtDate } from './sales-helpers';
import {
  isNonProductLine,
  NonProductLineRow,
  sectionSubtotals,
} from './sales-line-read-rows';

const FULFILLMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#d97706' },
  in_progress: { label: 'In Progress', color: '#2563eb' },
  done: { label: 'Done', color: '#16a34a' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

interface Props {
  so: SalesOrder;
}

export default function SalesOrderDetailLines({ so }: Props) {
  const subtotals = sectionSubtotals(so.items);

  return (
    <>
      {so.fulfillments?.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
          <div className="border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              Delivery Orders
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {so.fulfillments.map((f, i) => {
              const fs = FULFILLMENT_STATUS[f.status] ?? { label: f.status, color: '#6b7280' };
              return (
                <div key={f._id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                      <PiPackage className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-bold text-brand">
                        WH/OUT/{String(i + 1).padStart(5, '0')}
                      </p>
                      <p className="text-xs text-gray-400">{fmtDate(f.at)}</p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: `${fs.color}18`, color: fs.color }}
                  >
                    {fs.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
        <div className="border-b border-gray-100 px-5 py-3.5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            Order Lines
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/60">
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Product</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Qty</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Outstanding</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Unit Price</th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {so.items.map((item) => {
              if (isNonProductLine(item)) {
                return (
                  <NonProductLineRow
                    key={item._id}
                    item={item}
                    cols={5}
                    subtotal={item.lineType === 'section' ? subtotals.get(item._id) : undefined}
                    currency={so.currency}
                  />
                );
              }
              const out = outstanding(item);
              return (
                <tr key={item._id} className="transition-colors hover:bg-gray-50/60">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    {item.sku && (
                      <span className="mt-0.5 inline-block rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">{item.sku}</span>
                    )}
                    {item.description && (
                      <p className="mt-0.5 text-xs text-gray-400">{item.description}</p>
                    )}
                    {(item.promoDiscount ?? 0) > 0 && (
                      <p className="mt-0.5 text-xs font-medium text-emerald-600">
                        {item.promoName || 'Promotion'} · −{fmtCur(item.promoDiscount ?? 0, so.currency)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-medium text-gray-700">{item.quantity}</span>
                    <span className="ml-1 text-xs text-gray-400">units</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-sm font-semibold ${out > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {out > 0 ? out : '✓'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm text-gray-600">
                    {fmtCur(item.unitPrice, so.currency)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-gray-900">
                    {fmtCur(item.lineTotal, so.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {(so.discountTotal > 0 || (so.promotionTotal ?? 0) > 0 || (so.couponDiscount ?? 0) > 0 || (so.shippingFee ?? 0) > 0) && (
              <tr className="border-t border-gray-100 bg-gray-50/50">
                <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Subtotal</td>
                <td className="px-5 py-2.5 text-right font-mono text-sm text-gray-700">{fmtCur(so.subtotal, so.currency)}</td>
              </tr>
            )}
            {so.discountTotal > 0 && (
              <tr className="bg-gray-50/50">
                <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Discount</td>
                <td className="px-5 py-2.5 text-right font-mono text-sm font-semibold text-brand">
                  −{fmtCur(so.discountTotal, so.currency)}
                </td>
              </tr>
            )}
            {(so.promotionTotal ?? 0) > 0 && (
              <tr className="bg-gray-50/50">
                <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Promotion</td>
                <td className="px-5 py-2.5 text-right font-mono text-sm font-semibold text-emerald-600">
                  −{fmtCur(so.promotionTotal ?? 0, so.currency)}
                </td>
              </tr>
            )}
            {(so.couponDiscount ?? 0) > 0 && (
              <tr className="bg-gray-50/50">
                <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">
                  Coupon{so.couponCode ? ` (${so.couponCode})` : ''}
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-sm font-semibold text-emerald-600">
                  −{fmtCur(so.couponDiscount ?? 0, so.currency)}
                </td>
              </tr>
            )}
            {(so.taxTotal ?? 0) > 0 && (
              <tr className="bg-gray-50/50">
                <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Tax</td>
                <td className="px-5 py-2.5 text-right font-mono text-sm text-gray-700">{fmtCur(so.taxTotal ?? 0, so.currency)}</td>
              </tr>
            )}
            {(so.shippingFee ?? 0) > 0 && (
              <tr className="bg-gray-50/50">
                <td colSpan={4} className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Shipping</td>
                <td className="px-5 py-2.5 text-right font-mono text-sm text-gray-700">{fmtCur(so.shippingFee ?? 0, so.currency)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-gray-100">
              <td colSpan={4} className="px-5 py-4 text-right text-sm font-bold text-gray-700">Total</td>
              <td className="px-5 py-4 text-right font-mono text-base font-black text-gray-900">{fmtCur(so.total, so.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(so.notes || so.terms) && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
          {so.notes && (
            <div className={so.terms ? 'mb-5' : ''}>
              <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Notes</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{so.notes}</p>
            </div>
          )}
          {so.terms && (
            <div>
              <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Terms &amp; Conditions</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{so.terms}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
