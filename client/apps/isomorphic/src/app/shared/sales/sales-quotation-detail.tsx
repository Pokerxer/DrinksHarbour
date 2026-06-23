'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiPaperPlaneTilt,
  PiCheck,
  PiX,
  PiArrowsClockwise,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { QUOTE_STATUS_BADGE, quoteStatusLabel } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export default function SalesQuotationDetail({
  so,
  onChanged,
}: {
  so: SalesOrder;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [busy, setBusy] = useState(false);

  async function run(
    action: () => Promise<{ data: SalesOrder }>,
    successMsg: string,
    redirectToResult = false
  ) {
    setBusy(true);
    try {
      const res = await action();
      toast.success(successMsg);
      if (redirectToResult)
        router.push(routes.eCommerce.salesDetails(res.data._id));
      else onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const status = so.quoteStatus ?? 'draft';

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesQuotations}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Quotations
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{so.soNumber}</h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_BADGE[status]}`}
          >
            {quoteStatusLabel(status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => salesOrderService.send(so._id, token),
                  'Quotation sent'
                )
              }
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiPaperPlaneTilt className="h-4 w-4" /> Send
            </button>
          )}
          {status === 'sent' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => salesOrderService.accept(so._id, token),
                    'Quotation accepted'
                  )
                }
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <PiCheck className="h-4 w-4" /> Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => salesOrderService.reject(so._id, token),
                    'Quotation rejected'
                  )
                }
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <PiX className="h-4 w-4" /> Reject
              </button>
            </>
          )}
          {status === 'accepted' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => salesOrderService.convert(so._id, token),
                  'Converted to order',
                  true
                )
              }
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiArrowsClockwise className="h-4 w-4" /> Convert to Order
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Line Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {so.items.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3 text-gray-900">
                      {item.name}
                      {item.sku && (
                        <span className="ml-2 font-mono text-xs text-gray-400">
                          {item.sku}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fmtCur(item.unitPrice, so.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fmtCur(item.discount, so.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtCur(item.lineTotal, so.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(so.notes || so.terms) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
              {so.notes && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold text-gray-500">
                    Notes
                  </p>
                  <p className="text-gray-700">{so.notes}</p>
                </div>
              )}
              {so.terms && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">
                    Terms
                  </p>
                  <p className="text-gray-700">{so.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
            <p className="mb-1 text-xs font-semibold text-gray-500">Customer</p>
            <p className="mb-3 text-gray-900">
              {so.customerSnapshot?.name ?? 'Walk-in / none'}
            </p>
            {so.validUntil && (
              <>
                <p className="mb-1 text-xs font-semibold text-gray-500">
                  Valid Until
                </p>
                <p className="mb-3 text-gray-900">
                  {new Date(so.validUntil).toLocaleDateString()}
                </p>
              </>
            )}
            <div className="space-y-1 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Untaxed Amount</span>
                <span>{fmtCur(so.subtotal - so.discountTotal, so.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Tax</span>
                <span>{fmtCur(so.taxTotal ?? 0, so.currency)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>{fmtCur(so.total, so.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
