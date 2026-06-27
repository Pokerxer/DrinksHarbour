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
}: SalesCustomerBarProps) {
  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, { dateStyle: 'medium' }),
    []
  );

  const activePricelist = pricelists.find((p) => p._id === pricelistId) ?? null;

  return (
    <div className="mb-6 grid grid-cols-1 gap-x-10 gap-y-5 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Customer
        </label>
        <CustomerSearch
          token={token}
          selected={customer}
          onSelect={onSelectCustomer}
          onClear={onClearCustomer}
        />
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
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
            <p className="mt-1.5 text-xs text-emerald-600">
              Auto-applied from this customer.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Quotation Date
          </label>
          <p className="rounded-lg border border-transparent px-3 py-2 text-sm text-gray-700">
            {today}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
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