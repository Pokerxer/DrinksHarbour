// @ts-nocheck
'use client';

import Image from 'next/image';
import WidgetCard from '@core/components/cards/widget-card';
import { Button, Text } from 'rizzui';
import { useDashboard } from './use-dashboard';
import { routes } from '@/config/routes';
import Link from 'next/link';
import { PiPackageDuotone, PiTrophyDuotone, PiStorefrontDuotone } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { TopProduct } from '@/services/dashboard.service';

const STATUS_COLOR: Record<string, string> = {
  in_stock:     'bg-green-100 text-green-700',
  low_stock:    'bg-yellow-100 text-yellow-700',
  out_of_stock: 'bg-red-100 text-red-700',
};

const RANK_COLOR = ['text-amber-500', 'text-gray-400', 'text-amber-700'];

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

function VendorChip({ vendor }: { vendor: NonNullable<TopProduct['vendor']> }) {
  const initials = vendor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
      style={{ borderColor: vendor.color + '60', color: vendor.color, backgroundColor: vendor.color + '15' }}
      title={vendor.name}
    >
      {vendor.logo ? (
        <Image src={vendor.logo} alt={vendor.name} width={12} height={12} className="h-3 w-3 rounded-full object-cover" />
      ) : (
        <span className="flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: vendor.color }}>
          {initials[0]}
        </span>
      )}
      {vendor.name.split(' ')[0]}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-start">
      <div className="me-2 h-11 w-5 shrink-0 rounded bg-gray-100" />
      <div className="me-3 h-11 w-11 shrink-0 rounded-lg bg-gray-200" />
      <div className="flex w-full items-start justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-28 rounded bg-gray-200" />
          <div className="h-3 w-20 rounded bg-gray-100" />
          <div className="h-4 w-16 rounded bg-gray-100" />
        </div>
        <div className="h-5 w-14 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

export default function BestSellers({ className }: { className?: string }) {
  const data = useDashboard();
  const products = data?.topProducts ?? [];
  const isLoading = !data;

  return (
    <WidgetCard
      title="Top Products"
      description="By units sold (all time)"
      action={
        <Link href={routes.eCommerce.products}>
          <Button variant="text" className="whitespace-nowrap underline text-xs">
            View All
          </Button>
        </Link>
      }
      descriptionClassName="mt-0.5 text-gray-500"
      className={className}
    >
      {isLoading ? (
        <div className="custom-scrollbar -me-2 mt-4 grid max-h-[480px] gap-4 overflow-y-auto">
          {[1,2,3,4,5,6].map(i => <div key={i} className="pe-2"><SkeletonRow /></div>)}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <PiPackageDuotone className="mb-2 h-12 w-12 opacity-30" />
          <p className="text-sm">No sales data yet</p>
        </div>
      ) : (
        <div className="custom-scrollbar -me-2 mt-4 grid max-h-[480px] gap-3.5 overflow-y-auto">
          {products.map((product, idx) => (
            <div key={String(product.id)} className="flex items-start pe-2">
              {/* Rank */}
              <div className="me-2 flex h-11 w-5 shrink-0 items-center justify-center">
                {idx < 3
                  ? <PiTrophyDuotone className={cn('h-4 w-4', RANK_COLOR[idx])} />
                  : <span className="text-xs font-medium text-gray-400">{idx + 1}</span>
                }
              </div>

              {/* Product image */}
              <div className="me-3 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 @sm:h-12 @sm:w-12">
                {product.image ? (
                  <Image src={product.image} alt={product.name} width={48} height={48} className="h-full w-full object-cover" />
                ) : (
                  <PiPackageDuotone className="h-5 w-5 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <Text className="font-lexend text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-snug">
                    {product.name}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {product.sold.toLocaleString()} sold · {fmt(product.revenue)}
                    {product.margin !== null && (
                      <span className="ms-1.5 text-gray-400">· {product.margin}% margin</span>
                    )}
                  </Text>
                  {/* Vendor chip */}
                  <div className="mt-1">
                    {product.vendor ? (
                      <VendorChip vendor={product.vendor} />
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <PiStorefrontDuotone className="h-3 w-3" /> Platform
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock badge */}
                <span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[product.stockStatus] ?? 'bg-gray-100 text-gray-600')}>
                  {product.stock} left
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
