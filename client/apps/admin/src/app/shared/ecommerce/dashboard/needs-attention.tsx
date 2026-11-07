'use client';

// Operational queue widget: derived ONLY from fields the dashboard already
// receives — statCards.pendingOrders (orders with status 'pending', the same
// "Pending" state shown on the orders listing) and statCards.lowStockCount
// (products at/below their reorder threshold). Up to 3 latest pending rows
// come from recentOrders (status === 'pending') — no new fetch, no new
// service surface. Every row deep-links to a REAL config route; if a metric
// has no confirmed route it renders without a CTA. Never colour-only: every
// count pill carries its own icon, and NGN figures use the shared helpers.
// RSC note: subpath rizzui imports only — never `from 'rizzui'`.

import Link from 'next/link';
import WidgetCard from '@core/components/cards/widget-card';
import cn from '@core/utils/class-names';
import {
  PiArrowRightBold,
  PiCheckCircleDuotone,
  PiClipboardTextDuotone,
  PiPackageDuotone,
  PiWarningCircleDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { useDashboard } from './use-dashboard';
import { formatNaira } from './dashboard-format';
import { EmptyState } from './widget-parts';
import type { RecentOrder } from '@/services/dashboard.service';

/** Time-ago label for a pending preview row (compact, en-NG). */
function ago(s: string): string {
  const diffHrs = (Date.now() - new Date(s).getTime()) / 3600000;
  if (diffHrs < 1) return `${Math.max(0, Math.floor(diffHrs * 60))}m ago`;
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  return new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

const ROW_LINK =
  'flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-gray-100/10';

const COUNT_PILL = {
  amber:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

function QueueRow({
  href,
  icon,
  label,
  count,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: keyof typeof COUNT_PILL;
}) {
  return (
    <li>
      {/* Whole row is the 44px target; the accessible name reads label +
          count from the content — no decorative aria needed. */}
      <Link href={href} className={cn(ROW_LINK, 'text-gray-800 dark:text-gray-200')}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 text-gray-500 dark:text-gray-400">{icon}</span>
          <span className="truncate text-sm font-medium">{label}</span>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
              COUNT_PILL[tone]
            )}
          >
            <PiWarningCircleDuotone className="h-3 w-3" aria-hidden="true" />
            {count.toLocaleString()}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Review
          <PiArrowRightBold className="h-3 w-3" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

function PendingPreview({ order }: { order: RecentOrder }) {
  return (
    <li>
      <Link
        href={routes.eCommerce.orderDetails(order.id)}
        className={cn(ROW_LINK, 'ps-11 text-gray-600 dark:text-gray-400')}
      >
        <span className="min-w-0 truncate text-xs font-medium">
          {order.orderNumber}
        </span>
        <span className="shrink-0 text-xs tabular-nums">
          {formatNaira(order.total)} · {ago(order.placedAt)}
        </span>
      </Link>
    </li>
  );
}

export default function NeedsAttention({
  className,
}: {
  className?: string;
}) {
  const data = useDashboard();
  const pendingOrders = data?.statCards.pendingOrders ?? 0;
  const lowStockCount = data?.statCards.lowStockCount ?? 0;
  const pendingRows = (data?.recentOrders ?? [])
    .filter((o) => o.status === 'pending')
    .slice(0, 3);

  return (
    <WidgetCard
      title="Needs attention"
      description="Items waiting on you"
      descriptionClassName="mt-0.5 text-gray-500 dark:text-gray-600"
      className={className}
    >
      {!data ? (
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-11 rounded-lg bg-gray-200 dark:bg-gray-100/20" />
          <div className="h-11 rounded-lg bg-gray-200 dark:bg-gray-100/20" />
        </div>
      ) : pendingOrders === 0 && lowStockCount === 0 ? (
        <EmptyState
          icon={
            <PiCheckCircleDuotone className="h-6 w-6" aria-hidden="true" />
          }
          message="All clear — nothing waiting on you"
          className="py-9"
        />
      ) : (
        <ul className={cn('mt-3 space-y-2', lowStockCount > 0 && pendingOrders > 0 && 'divide-y divide-muted')}>
          {pendingOrders > 0 && (
            <>
              <QueueRow
                href={routes.eCommerce.orders}
                icon={
                  <PiClipboardTextDuotone className="h-5 w-5" aria-hidden="true" />
                }
                label="Orders to review"
                count={pendingOrders}
                tone="amber"
              />
              {pendingRows.map((order) => (
                <PendingPreview key={order.id} order={order} />
              ))}
            </>
          )}
          {lowStockCount > 0 && (
            <QueueRow
              href={routes.eCommerce.subProducts}
              icon={
                <PiPackageDuotone className="h-5 w-5" aria-hidden="true" />
              }
              label="Low / out-of-stock products"
              count={lowStockCount}
              tone="red"
            />
          )}
        </ul>
      )}
    </WidgetCard>
  );
}
