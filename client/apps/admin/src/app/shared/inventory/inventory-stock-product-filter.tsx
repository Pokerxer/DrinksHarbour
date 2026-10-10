'use client';
import { useMemo } from 'react';
import type { StockRow } from '@/services/warehouseStock.service';
import ProductFilter from '../warehouses/warehouse-location-analysis/product-filter';
export default function StockProductFilter({
  rows,
  selected,
  change,
  loading,
  error,
  retry,
}: {
  rows: StockRow[];
  selected: string[];
  change: (ids: string[]) => void;
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const products = useMemo(
    () =>
      Array.from(
        new Map(
          rows.map((row) => [
            row.subProductId,
            {
              id: row.subProductId,
              label: `${row.productName}${row.sku ? ' · ' + row.sku : ''}`,
            },
          ]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [rows],
  );
  return (
    <div className="border-b border-gray-100 px-5 py-3">
      <ProductFilter
        value={selected.join(',')}
        change={(value) => change(value.split(',').filter(Boolean))}
        products={products}
        loading={loading}
        error={error}
        retry={retry}
      />
      <p className="mt-2 text-xs text-gray-500">
        All products by default. Selected products match any selection; the other filters narrow
        those stock lines. Totals and exports include every matching line.
      </p>
    </div>
  );
}
