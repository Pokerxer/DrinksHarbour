import { useId, useMemo } from 'react';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import ProductFilter from '../warehouses/warehouse-location-analysis/product-filter';
import { itemName, itemSubProductKey } from './purchases-analytics-helpers';
export function PurchaseAnalyticsFilters({
  orders,
  filters,
  change,
}: {
  orders: PurchaseOrder[];
  filters: string[];
  change: (filters: string[]) => void;
}) {
  const id = useId();
  const products = useMemo(() => {
    const options = new Map<string, string>();
    for (const order of orders)
      for (const item of order.items || []) {
        const key = itemSubProductKey(item);
        const populated = item.subProductId as unknown as { sku?: string } | null;
        const sku = item.sku || populated?.sku;
        if (key) options.set(key, `${itemName(item)}${sku ? ` · ${sku}` : ''}`);
      }
    return Array.from(options)
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);
  const value = (prefix: string) =>
    filters.find((f) => f.startsWith(prefix))?.slice(prefix.length) || '';
  const set = (prefix: string, value: string) =>
    change([
      ...filters.filter((f) => !f.startsWith(prefix)),
      ...(value ? [`${prefix}${value}`] : []),
    ]);
  return (
    <section
      aria-label="Filter purchase analysis"
      className="mb-4 space-y-4 rounded-2xl border border-[#ece4d6] bg-white p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#65594e]">Filter purchases</h2>
        <button
          type="button"
          onClick={() => change(['not_cancelled'])}
          className="text-xs font-semibold text-[#b20202]"
        >
          Clear filters
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductFilter
          products={products}
          value={filters
            .filter((f) => f.startsWith('product_id:'))
            .map((f) => f.slice(11))
            .join(',')}
          change={(value) =>
            change([
              ...filters.filter((f) => !f.startsWith('product_id:')),
              ...value
                .split(',')
                .filter(Boolean)
                .map((id) => `product_id:${id}`),
            ])
          }
        />
        {(['created_from:', 'created_to:'] as const).map((prefix, index) => (
          <div key={prefix}>
            <label htmlFor={`${id}-${index}`} className="text-xs font-semibold text-gray-500">
              Created {index ? 'to' : 'from'}
            </label>
            <input
              id={`${id}-${index}`}
              type="date"
              value={value(prefix)}
              onChange={(e) => set(prefix, e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#ece4d6] px-3 py-2 text-sm"
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-reference`} className="text-xs font-semibold text-gray-500">
            Invoice / vendor reference
          </label>
          <input
            id={`${id}-reference`}
            value={value('reference:')}
            onChange={(e) => set('reference:', e.target.value)}
            placeholder="Purchase number or reference…"
            className="mt-1.5 w-full rounded-lg border border-[#ece4d6] px-3 py-2 text-sm"
          />
        </div>
      </div>
      {value('created_from:') &&
        value('created_to:') &&
        value('created_from:') > value('created_to:') && (
          <p role="alert" className="text-xs text-red-600">
            Created from must be on or before Created to.
          </p>
        )}
      <p className="text-xs text-gray-500">
        Products match any selection. Other filters narrow the results. Totals include only matching
        product lines. Creation dates use UTC.
      </p>
    </section>
  );
}
