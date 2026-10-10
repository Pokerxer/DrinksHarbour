import { useId, useMemo } from 'react';
import type { StockRow } from '@/services/warehouseStock.service';
import type { InventoryMovement } from '@/services/inventory.service';
import ProductFilter from '../warehouses/warehouse-location-analysis/product-filter';
import {
  emptyInventoryFilters,
  refId,
  type InventoryFilters,
} from './inventory-dashboard-analysis';
export default function InventoryDashboardFilters({
  rows,
  movements,
  filters,
  change,
}: {
  rows: StockRow[];
  movements: InventoryMovement[];
  filters: InventoryFilters;
  change: (filters: InventoryFilters) => void;
}) {
  const id = useId();
  const products = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.subProductId, `${row.productName} · ${row.sku}`);
    for (const m of movements) {
      const key = refId(m.subProduct);
      const sp = typeof m.subProduct === 'object' ? m.subProduct : null;
      const product = typeof sp?.product === 'object' ? sp.product : null;
      const direct = m.product as { name?: string } | null;
      if (key && !map.has(key))
        map.set(
          key,
          `${direct?.name || product?.name || sp?.name || sp?.sku || 'Historical product'}${sp?.sku ? ` · ${sp.sku}` : ''}`,
        );
    }
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [rows, movements]);
  const warehouses = useMemo(() => {
    const map = new Map(rows.map((row) => [row.warehouseId, row.warehouseName]));
    for (const movement of movements)
      for (const value of [
        movement.warehouse,
        movement.sourceWarehouse,
        movement.destinationWarehouse,
      ]) {
        const key = refId(value);
        if (key && typeof value === 'object' && value && !map.has(key))
          map.set(key, value.name || value.code || 'Historical warehouse');
      }
    return Array.from(map, ([id, label]) => ({ id, label }))
      .filter((row) => row.id)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, movements]);
  const set = (key: keyof InventoryFilters, value: string) => change({ ...filters, [key]: value });
  const shortcut = (type: 'week' | 'month' | 'all') => {
    const now = new Date();
    const start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        type === 'month' ? 1 : now.getUTCDate() - 6,
      ),
    );
    change({
      ...filters,
      from: type === 'all' ? '' : start.toISOString().slice(0, 10),
      to: type === 'all' ? '' : now.toISOString().slice(0, 10),
    });
  };
  const input = 'mt-1.5 w-full rounded-lg border border-[#ece4d6] bg-white px-3 py-2.5 text-sm';
  return (
    <section
      aria-label="Inventory filters"
      className="mb-6 rounded-2xl border border-[#ece4d6] bg-white p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Filter inventory</h2>
        <button
          type="button"
          onClick={() => change(emptyInventoryFilters())}
          className="text-xs font-semibold text-[#b20202]"
        >
          Clear filters
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductFilter
          products={products}
          value={filters.products.join(',')}
          change={(value) => change({ ...filters, products: value.split(',').filter(Boolean) })}
        />
        <label className="text-xs font-semibold text-gray-500">
          Warehouse
          <select
            className={input}
            value={filters.warehouse}
            onChange={(e) => set('warehouse', e.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Stock health
          <select
            className={input}
            value={filters.health}
            onChange={(e) => set('health', e.target.value)}
          >
            <option value="">All stock statuses</option>
            {[
              ['ok', 'Healthy'],
              ['low', 'Low stock'],
              ['out', 'Out of stock / nonpositive'],
              ['expiry', 'Near expiry'],
              ['over', 'Overstocked'],
            ].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {(['from', 'to'] as const).map((key) => (
          <label key={key} className="text-xs font-semibold text-gray-500" htmlFor={`${id}-${key}`}>
            History recorded {key}
            <input
              id={`${id}-${key}`}
              type="date"
              className={input}
              value={filters[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
        <label className="text-xs font-semibold text-gray-500 sm:col-span-2">
          History reference
          <input
            className={input}
            value={filters.reference}
            onChange={(e) => set('reference', e.target.value)}
            placeholder="Invoice, transfer, or adjustment reference…"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['week', 'month', 'all'] as const).map((type, i) => (
          <button
            type="button"
            key={type}
            className="rounded-full border border-[#ece4d6] px-3 py-1.5 text-xs text-gray-600"
            onClick={() => shortcut(type)}
          >
            {['Last 7 days', 'This month', 'All dates'][i]}
          </button>
        ))}
      </div>
      {filters.from && filters.to && filters.from > filters.to && (
        <p role="alert" className="mt-3 text-xs text-red-600">
          History start must be on or before the end date.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        Products match any selection; warehouse and stock health narrow the results. Stock cards
        show current balances. Dates and reference filter movement history only; dates use UTC.
        Health filters use today’s warehouse stock status.
      </p>
    </section>
  );
}
