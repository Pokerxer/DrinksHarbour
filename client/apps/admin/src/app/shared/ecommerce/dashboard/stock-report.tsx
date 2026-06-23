// @ts-nocheck
'use client';

import Link from 'next/link';
import Image from 'next/image';
import WidgetCard from '@core/components/cards/widget-card';
import { Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { useDashboard } from './use-dashboard';
import { PiArrowRightBold, PiPackageDuotone } from 'react-icons/pi';

const STATUS_STYLE: Record<string, string> = {
  in_stock:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  low_stock:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  out_of_stock: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  in_stock:     'In Stock',
  low_stock:    'Low Stock',
  out_of_stock: 'Out of Stock',
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-muted">
      {[180, 80, 60, 60, 80].map((w, i) => (
        <td key={i} className="px-3 py-3 first:px-5 first:lg:px-7 last:px-3 last:lg:pr-7">
          <div className="h-4 rounded bg-gray-200" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function StockReport({ className }: { className?: string }) {
  const data = useDashboard();
  const products = data?.topProducts ?? [];
  const isLoading = !data;

  const sorted = [...products].sort((a, b) => {
    const p: Record<string, number> = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
    const diff = (p[a.stockStatus] ?? 2) - (p[b.stockStatus] ?? 2);
    return diff !== 0 ? diff : a.stock - b.stock;
  });

  const lowCount  = products.filter(p => p.stockStatus === 'low_stock').length;
  const outCount  = products.filter(p => p.stockStatus === 'out_of_stock').length;

  return (
    <WidgetCard
      title="Stock Report"
      description={
        data && (outCount > 0 || lowCount > 0) ? (
          <span className="text-xs">
            {outCount > 0 && <span className="text-red-500 font-medium">{outCount} out of stock</span>}
            {outCount > 0 && lowCount > 0 && <span className="text-gray-400"> · </span>}
            {lowCount > 0 && <span className="text-amber-500 font-medium">{lowCount} low stock</span>}
          </span>
        ) : undefined
      }
      className={cn('p-0 lg:p-0', className)}
      headerClassName="mb-4 px-5 pt-5 lg:px-7 lg:pt-7"
      action={
        <Link href={routes.eCommerce.subProducts}>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            Manage Stock <PiArrowRightBold className="h-3 w-3" />
          </Button>
        </Link>
      }
    >
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-muted text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-5 py-3 lg:px-7 font-medium">Product</th>
              <th className="px-3 py-3 font-medium">SKU</th>
              <th className="px-3 py-3 font-medium text-right">Available</th>
              <th className="px-3 py-3 font-medium text-right">Sold</th>
              <th className="px-3 py-3 lg:pr-7 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400 lg:px-7">
                  No product data yet
                </td>
              </tr>
            ) : (
              sorted.map(p => (
                <tr key={String(p.id)} className="border-b border-muted last:border-0 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/5">
                  <td className="px-5 py-3 lg:px-7">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                        {p.image ? (
                          <Image src={p.image} alt={p.name} width={36} height={36} className="h-full w-full object-cover" />
                        ) : (
                          <PiPackageDuotone className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <span className="max-w-[200px] truncate font-medium text-gray-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500 uppercase">{p.sku}</td>
                  <td className="px-3 py-3 text-right">
                    <span className={cn('font-semibold', p.stock === 0 ? 'text-red-600' : p.stock <= 10 ? 'text-amber-600' : 'text-gray-900')}>
                      {p.stock.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600">{p.sold.toLocaleString()}</td>
                  <td className="px-3 py-3 lg:pr-7 text-right">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLE[p.stockStatus] ?? 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABEL[p.stockStatus] ?? p.stockStatus}
                    </span>
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
