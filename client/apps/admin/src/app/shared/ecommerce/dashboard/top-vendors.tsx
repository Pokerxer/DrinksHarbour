// @ts-nocheck
'use client';

import Image from 'next/image';
import WidgetCard from '@core/components/cards/widget-card';
import { Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { useDashboard } from './use-dashboard';
import {
  PiStorefrontDuotone,
  PiTrophyDuotone,
  PiArrowUpRightBold,
  PiArrowDownRightBold,
} from 'react-icons/pi';
import type { TopVendor } from '@/services/dashboard.service';

const RANK_COLOR = ['text-amber-500', 'text-gray-400', 'text-amber-700'];

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

function pct(part: number, total: number): string {
  if (!total) return '0';
  return (Math.round((part / total) * 1000) / 10).toFixed(1);
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-xl border border-muted px-3 py-3">
      <div className="h-10 w-10 shrink-0 rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-28 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-4 w-16 rounded bg-gray-200" />
        <div className="h-3 w-12 rounded bg-gray-100" />
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
  const initials = vendor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
      style={{ backgroundColor: vendor.color }}
    >
      {initials}
    </span>
  );
}

export default function TopVendors({ className }: { className?: string }) {
  const data = useDashboard();
  const vendors = data?.topVendors ?? [];
  const isLoading = !data;

  const totalRevenue = vendors.reduce((s, v) => s + v.grossRevenue, 0);

  return (
    <WidgetCard
      title="Top Vendors"
      description={
        data
          ? `${vendors.length} active this month · ${fmt(totalRevenue)} combined`
          : 'By gross revenue this month'
      }
      descriptionClassName="text-gray-500 mt-0.5 text-xs"
      className={className}
    >
      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <PiStorefrontDuotone className="mb-2 h-12 w-12 opacity-30" />
          <p className="text-sm">No vendor sales this month</p>
        </div>
      ) : (
        <div className="custom-scrollbar mt-4 space-y-2.5 max-h-[480px] overflow-y-auto -me-1 pe-1">
          {vendors.map((vendor, idx) => {
            const platformPct = pct(vendor.platformCommission, vendor.grossRevenue);
            const vendorPct   = pct(vendor.vendorShare,        vendor.grossRevenue);

            return (
              <div
                key={String(vendor.id)}
                className="flex items-center gap-3 rounded-xl border border-muted px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/5"
              >
                {/* Rank icon */}
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {idx < 3
                    ? <PiTrophyDuotone className={cn('h-4 w-4', RANK_COLOR[idx])} />
                    : <span className="text-xs font-semibold text-gray-400">{idx + 1}</span>
                  }
                </div>

                {/* Logo / Avatar */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-muted">
                  <VendorAvatar vendor={vendor} />
                </div>

                {/* Name + model */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {vendor.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {vendor.orderCount} order{vendor.orderCount !== 1 ? 's' : ''} · {vendor.itemCount} items
                    <span className={cn(
                      'ms-1.5 rounded px-1 py-px text-[10px] font-medium uppercase',
                      vendor.revenueModel === 'commission' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                    )}>
                      {vendor.revenueModel}
                    </span>
                  </p>
                </div>

                {/* Revenue + breakdown */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">{fmt(vendor.grossRevenue)}</p>
                  <div className="mt-0.5 flex items-center justify-end gap-2 text-[11px]">
                    <span className="text-violet-600" title="Platform profit from this vendor">
                      P: {fmt(vendor.platformProfit)}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-blue-600" title="Platform cost (vendor payout)">
                      C: {fmt(vendor.vendorCost)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {!isLoading && vendors.length > 0 && (
        <div className="mt-4 flex items-center gap-4 border-t border-dashed border-muted pt-3 text-xs text-gray-400">
          <span><span className="font-medium text-violet-600">P</span> = Platform profit</span>
          <span><span className="font-medium text-blue-600">C</span> = Vendor cost (payout)</span>
        </div>
      )}
    </WidgetCard>
  );
}
