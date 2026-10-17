'use client';
import type { SalesOrder } from '@/services/salesOrder.service';
import { orderStatusLabel } from './sales-helpers';
import {
  operationsWarehouse,
  type OperationsFilters,
  type OperationsKind,
} from './sales-operations-helpers';

const control =
  'min-h-10 min-w-0 rounded-md border border-gray-200 bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand';
export default function SalesOperationsToolbar({
  orders,
  kind,
  filters,
  update,
  clear,
}: {
  orders: SalesOrder[];
  kind: OperationsKind;
  filters: OperationsFilters;
  update: (key: keyof OperationsFilters, value: string) => void;
  clear: () => void;
}) {
  const warehouses = Array.from(
    new Map(
      orders.map((order) => {
        const warehouse = operationsWarehouse(order);
        return [warehouse.id, warehouse] as const;
      })
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-gray-200 bg-gray-50/70 p-3">
      <label className="grid min-w-0 flex-1 basis-60 gap-1 text-xs text-gray-600">
        Search orders
        <input
          type="search"
          value={filters.search}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Order, customer or warehouse"
          className={control}
        />
      </label>
      <label className="grid min-w-0 flex-1 basis-36 gap-1 text-xs text-gray-600 sm:max-w-52">
        Order warehouse
        <select
          value={filters.warehouse}
          onChange={(event) => update('warehouse', event.target.value)}
          className={control}
        >
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 flex-1 basis-36 gap-1 text-xs text-gray-600 sm:max-w-52">
        Order status
        <select
          value={filters.status}
          onChange={(event) => update('status', event.target.value)}
          className={control}
        >
          <option value="">All statuses</option>
          {(kind === 'fulfill'
            ? ['confirmed', 'partially_fulfilled']
            : ['partially_fulfilled', 'fulfilled']
          ).map((status) => (
            <option key={status} value={status}>
              {orderStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      {Object.values(filters).some(Boolean) && (
        <button
          type="button"
          onClick={clear}
          className="min-h-10 px-2 text-xs font-semibold text-brand hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
