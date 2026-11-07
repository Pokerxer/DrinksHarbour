// @ts-nocheck
'use client';

import Image from 'next/image';
import WidgetCard from '@core/components/cards/widget-card';
import cn from '@core/utils/class-names';
import { useDashboard, useDashboardMeta } from './use-dashboard';
import { PiStorefrontDuotone, PiTrophyDuotone } from 'react-icons/pi';
import { formatCompactNaira as fmt } from './dashboard-format';
import { EmptyState } from './widget-parts';
import type { TopVendor } from '@/services/dashboard.service';

const RANK_COLOR = ['text-amber-500', 'text-gray-400', 'text-amber-700'];

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-xl border border-muted px-3 py-3">
      <div className="h-10 w-10 shrink-0 rounded-xl bg-gray-200 dark:bg-gray-100/20" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-28 rounded bg-gray-200 dark:bg-gray-100/20" />
        <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-100/10" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-100/20" />
        <div className="h-3 w-12 rounded bg-gray-100 dark:bg-gray-100/10" />
      </div>
    </div>
  );
}

function VendorAvatar({ vendor }: { vendor: TopVendor }) {
  if (vendor.logo) {
    return (
      <Image
        src={vendor.logo}
        alt={vendor.name}
        width={40}
        height={40}
        className="h-full w-full object-cover"
      />
    );
  }
  // Fallback: coloured initials
  const initials = vendor.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
      style={{ backgroundColor: vendor.color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export default function TopVendors({ className }: { className?: string }) {
  const data = useDashboard();
  const meta = useDashboardMeta();
  const periodLabel = meta?.label ?? 'This month';
  const vendors = data?.topVendors ?? [];
  const isLoading = !data;

  const totalRevenue = vendors.reduce((s, v) => s + v.grossRevenue, 0);

  return (
    <WidgetCard
      title="Top Vendors"
      description={
        data
          ? `${vendors.length} active · ${periodLabel} · ${fmt(totalRevenue)} combined`
          : `By gross revenue · ${periodLabel}`
      }
      descriptionClassName="text-gray-500 dark:text-gray-600 mt-0.5 text-xs"
      className={className}
    >
      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={
            <PiStorefrontDuotone className="h-6 w-6" aria-hidden="true" />
          }
          message={`No vendor sales ${periodLabel.toLowerCase()}`}
        />
      ) : (
        <div className="custom-scrollbar -me-1 mt-4 max-h-[480px] space-y-2.5 overflow-y-auto pe-1">
          {vendors.map((vendor, idx) => (
            <div
              key={String(vendor.id)}
              className="flex items-center gap-3 rounded-xl border border-muted px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/5"
            >
              {/* Rank */}
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {idx < 3 ? (
                  <PiTrophyDuotone
                    className={cn('h-4 w-4', RANK_COLOR[idx])}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-600 tabular-nums">
                    {idx + 1}
                  </span>
                )}
                <span className="sr-only">Rank {idx + 1}</span>
              </div>

              {/* Logo / Avatar */}
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-muted">
                <VendorAvatar vendor={vendor} />
              </div>

              {/* Name + model */}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
                  title={vendor.name}
                >
                  {vendor.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-600">
                  {vendor.orderCount} order
                  {vendor.orderCount !== 1 ? 's' : ''} · {vendor.itemCount}{' '}
                  items
                  <span
                    className={cn(
                      'ms-1.5 rounded px-1 py-px text-[10px] font-medium uppercase',
                      vendor.revenueModel === 'commission'
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    )}
                  >
                    {vendor.revenueModel === 'selling_price_markup' ? 'Selling-price markup' : vendor.revenueModel}
                  </span>
                </p>
              </div>

              {/* Revenue + breakdown */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {fmt(vendor.grossRevenue)}
                </p>
                <div className="mt-0.5 flex items-center justify-end gap-2 text-[11px] tabular-nums">
                  <span
                    className="text-violet-700 dark:text-violet-300"
                    title="Platform profit from this vendor"
                  >
                    P: {fmt(vendor.platformProfit)}
                  </span>
                  <span
                    className="text-gray-300 dark:text-gray-500"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <span
                    className="text-blue-dark dark:text-blue-400"
                    title="Platform cost (vendor payout)"
                  >
                    C: {fmt(vendor.vendorCost)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {!isLoading && vendors.length > 0 && (
        <div className="mt-4 flex items-center gap-4 border-t border-dashed border-muted pt-3 text-xs text-gray-500 dark:text-gray-600">
          <span>
            <span className="font-medium text-violet-700 dark:text-violet-300">
              P
            </span>{' '}
            = Platform profit
          </span>
          <span>
            <span className="font-medium text-blue-dark dark:text-blue-400">
              C
            </span>{' '}
            = Vendor cost (payout)
          </span>
        </div>
      )}
    </WidgetCard>
  );
}
