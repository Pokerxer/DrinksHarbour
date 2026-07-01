// client/apps/admin/src/app/shared/sales/sales-customer-bar.tsx
'use client';

import { useMemo } from 'react';
import CustomerSearch from './customer-search';
import { INPUT_CLS } from './sales-address-block';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';

export interface SalesCustomerBarProps {
  token: string;
  customer: POSCustomer | null;
  onSelectCustomer: (c: POSCustomer) => void;
  onClearCustomer: () => void;
  pricelists: { _id: string; name: string }[];
  pricelistId: string;
  onPricelistChange: (id: string) => void;
  /** Auto-resolved pricelist id for the selected customer (for the "auto-applied" hint). */
  resolvedPricelistId?: string | null;
  validUntil: string;
  onValidUntilChange: (v: string) => void;
  warehouses: { _id: string; name: string; isDefault?: boolean }[];
  warehouseId: string;
  onWarehouseChange: (id: string) => void;
}

/**
 * Top block of the Sales create page: customer picker, pricelist selector, and
 * the quotation date + expiration inputs.
 */
export default function SalesCustomerBar({
  token,
  customer,
  onSelectCustomer,
  onClearCustomer,
  pricelists,
  pricelistId,
  onPricelistChange,
  resolvedPricelistId,
  validUntil,
  onValidUntilChange,
  warehouses,
  warehouseId,
  onWarehouseChange,
}: SalesCustomerBarProps) {
  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, { dateStyle: 'medium' }),
    []
  );

  const activePricelist = pricelists.find((p) => p._id === pricelistId) ?? null;

  return (
    <div className="mb-6 grid grid-cols-1 gap-x-10 gap-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
          Customer
        </label>
        <CustomerSearch
          token={token}
          selected={customer}
          onSelect={onSelectCustomer}
          onClear={onClearCustomer}
        />
        <div className="mt-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
            Pricelist
          </label>
          <select
            value={pricelistId}
            onChange={(e) => onPricelistChange(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">— Base price —</option>
            {pricelists.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
          {activePricelist && resolvedPricelistId === activePricelist._id && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Auto-applied from this customer
            </p>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
            Warehouse
          </label>
          <select
            value={warehouseId}
            onChange={(e) => onWarehouseChange(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">— Select warehouse —</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
                {w.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
            Quotation Date
          </label>
          <p className="px-0 py-2 text-sm font-medium text-gray-700">{today}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
            Expiration
          </label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => onValidUntilChange(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>
    </div>
  );
}
