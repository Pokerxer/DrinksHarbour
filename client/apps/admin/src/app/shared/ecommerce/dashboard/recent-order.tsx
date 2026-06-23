// @ts-nocheck
'use client';

import { orderData } from '@/data/order-data';
// Re-export for backwards compat with columns.tsx and table components
export type OrdersDataType = (typeof orderData)[number];

import Link from 'next/link';
import WidgetCard from '@core/components/cards/widget-card';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { useDashboard } from './use-dashboard';
import { PiArrowRightBold, PiUserBold } from 'react-icons/pi';

const STATUS_STYLE: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  shipped:    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled:  'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  refunded:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const PAY_STYLE: Record<string, string> = {
  paid:               'bg-green-100 text-green-700',
  pending:            'bg-amber-100 text-amber-700',
  failed:             'bg-red-100 text-red-600',
  partially_refunded: 'bg-orange-100 text-orange-700',
  refunded:           'bg-gray-100 text-gray-600',
};

const METHOD_LABEL: Record<string, string> = {
  card:             'Card',
  bank_transfer:    'Bank',
  cash_on_delivery: 'COD',
  cod:              'COD',
  mobile_money:     'Mobile',
  wallet:           'Wallet',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const diffHrs = (now.getTime() - d.getTime()) / 3600000;
  if (diffHrs < 1) return `${Math.floor(diffHrs * 60)}m ago`;
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 48) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-muted">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <td key={i} className="px-3 py-4 first:px-5 first:lg:px-7 last:px-3 last:lg:pr-7">
          <div className="h-4 rounded bg-gray-200" style={{ width: `${40 + (i * 13) % 50}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function RecentOrder({ className }: { className?: string }) {
  const data = useDashboard();
  const orders = data?.recentOrders ?? [];
  const isLoading = !data;

  return (
    <WidgetCard
      title="Recent Orders"
      className={cn('p-0 lg:p-0', className)}
      headerClassName="px-5 pt-5 lg:px-7 lg:pt-7 mb-4"
      action={
        <Link href={routes.eCommerce.orders}>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            View All <PiArrowRightBold className="h-3 w-3" />
          </Button>
        </Link>
      }
    >
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-muted text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-5 py-3 lg:px-7 font-medium">Order #</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Amount</th>
              <th className="px-3 py-3 font-medium">Payment</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 lg:pr-7 font-medium text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400 lg:px-7">
                  No orders yet
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={String(order.id)} className="border-b border-muted last:border-0 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/5">
                  <td className="px-5 py-3.5 lg:px-7">
                    <Link
                      href={`${routes.eCommerce.orders}/${order.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      #{order.orderNumber}
                    </Link>
                    {order.vendors?.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-gray-400 truncate max-w-[120px]" title={order.vendors.join(', ')}>
                        {order.vendors.slice(0, 2).join(', ')}{order.vendors.length > 2 ? ` +${order.vendors.length - 2}` : ''}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3.5 max-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-gray-700">{order.customer}</span>
                      {order.hasAccount && (
                        <span title="Registered user" className="shrink-0 rounded bg-blue-50 p-0.5">
                          <PiUserBold className="h-2.5 w-2.5 text-blue-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 font-semibold text-gray-900">
                    {fmt(order.total)}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className={cn('w-fit rounded-full px-2 py-0.5 text-xs font-medium capitalize', PAY_STYLE[order.paymentStatus] ?? 'bg-gray-100 text-gray-600')}>
                        {order.paymentStatus}
                      </span>
                      <span className="text-xs text-gray-400">{METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium capitalize', STATUS_STYLE[order.status] ?? 'bg-gray-100 text-gray-600')}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 lg:pr-7 text-right text-xs text-gray-400 tabular-nums">
                    {fmtDate(order.placedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  );
}
