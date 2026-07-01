'use client';

import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import { PiKanban } from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { fmtDate } from './sales-list-helpers';

const ORDER_COLUMNS = [
  { status: 'draft', label: 'Draft' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'partially_fulfilled', label: 'Partially Fulfilled' },
  { status: 'fulfilled', label: 'Fulfilled' },
  { status: 'cancelled', label: 'Cancelled' },
];

const QUOTE_COLUMNS = [
  { status: 'draft', label: 'Draft' },
  { status: 'sent', label: 'Sent' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'converted', label: 'Converted' },
];

interface Props {
  orders: SalesOrder[];
  isQuotation: boolean;
}

export default function SalesListKanban({ orders, isQuotation }: Props) {
  const router = useRouter();
  const columns = isQuotation ? QUOTE_COLUMNS : ORDER_COLUMNS;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
        <PiKanban className="mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">No orders to show</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const statusKey = isQuotation ? 'quoteStatus' as const : 'orderStatus' as const;
        const items = orders.filter((o) => {
          const val = isQuotation ? o.quoteStatus : o.orderStatus;
          return val === col.status || (!val && col.status === 'draft');
        });

        return (
          <div key={col.status} className="min-w-[260px] flex-1 rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
              <span className="text-sm font-semibold text-gray-800">{col.label}</span>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">{items.length}</span>
            </div>
            <div className="space-y-2 p-2">
              {items.map((o) => (
                <div
                  key={o._id}
                  onClick={() => router.push(routes.eCommerce.salesDetails(o._id))}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
                >
                  <p className="font-mono text-sm font-semibold text-brand">{o.soNumber}</p>
                  <p className="mt-1 text-sm text-gray-800">{o.customerSnapshot?.name || '—'}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{fmtCur(o.total, o.currency)}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{fmtDate(o.createdAt)}</p>
                </div>
              ))}
              {items.length === 0 && (
                <p className="py-8 text-center text-xs text-gray-400">No orders</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
