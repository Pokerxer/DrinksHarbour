// client/apps/admin/src/app/shared/sales/sales-customer-bar.tsx
'use client';

import { useMemo, type ReactNode } from 'react';
import { PiArrowsClockwise, PiShoppingCart } from 'react-icons/pi';
import CustomerSearch from './customer-search';
import SalesPricelistSelect from './sales-pricelist-select';
import SalesEditorSelect from './sales-editor-select';
import { EDITOR_LABEL } from './sales-dropdown-styles';
import { INPUT_CLS } from './sales-address-block';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';

export interface SalesCustomerBarProps {
  token: string;
  customer: POSCustomer | null;
  onSelectCustomer: (c: POSCustomer) => void;
  onClearCustomer: () => void;
  pricelists: { _id: string; name: string }[];
  pricelistId: string;
  pricelistsLoading?: boolean;
  pricelistsError?: string | null;
  onRetryPricelists?: () => void;
  onPricelistChange: (id: string) => void;
  /** Recompute product unit prices from the selected pricelist. */
  onUpdatePrices?: () => void;
  /** Auto-resolved pricelist id for the selected customer (for the "auto-applied" hint). */
  resolvedPricelistId?: string | null;
  validUntil: string;
  onValidUntilChange: (v: string) => void;
  warehouses: { _id: string; name: string; isDefault?: boolean }[];
  warehouseId: string;
  onWarehouseChange: (id: string) => void;
  /** Open the marketplace cart import modal. Only meaningful once a customer with an email is selected. */
  onImportCart?: () => void;
  invoiceDetails?: ReactNode;
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
  pricelistsLoading,
  pricelistsError,
  onRetryPricelists,
  onPricelistChange,
  onUpdatePrices,
  resolvedPricelistId,
  validUntil,
  onValidUntilChange,
  warehouses,
  warehouseId,
  onWarehouseChange,
  onImportCart,
  invoiceDetails,
}: SalesCustomerBarProps) {
  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, { dateStyle: 'medium' }),
    [],
  );

  const activePricelist = pricelists.find((p) => p._id === pricelistId) ?? null;
  const hasEmail = !!customer?.email;

  return (
    <div className="mb-4 grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] sm:grid-cols-2 sm:p-5 [&>div]:min-w-0">
      <div>
        <label className={EDITOR_LABEL}>Customer</label>
        <CustomerSearch
          token={token}
          selected={customer}
          onSelect={onSelectCustomer}
          onClear={onClearCustomer}
        />

        {/* Marketplace cart import. Shown for any selected customer — when the
            POSCustomer has no email on file the modal prompts for the
            drinksharbour.com address (marketplace signup does not create
            POSCustomers, so the email is often missing). */}
        {customer && onImportCart && (
          <div className="mt-2">
            <button
              type="button"
              onClick={onImportCart}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#b20202]/20 bg-[#b20202]/5 px-3 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-[#b20202]/10"
            >
              <PiShoppingCart className="h-3.5 w-3.5" />
              Import from marketplace cart
            </button>
            {!hasEmail && (
              <p className="mt-1 px-0.5 text-[11px] text-gray-400">
                No email on file — you&#39;ll be asked for it.
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          <SalesPricelistSelect
            pricelists={pricelists}
            value={pricelistId}
            onChange={onPricelistChange}
            loading={pricelistsLoading}
            error={pricelistsError}
            onRetry={onRetryPricelists}
            resolvedId={resolvedPricelistId}
          />
          {activePricelist && resolvedPricelistId === activePricelist._id && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Auto-applied from this customer
            </p>
          )}
          {pricelistId && onUpdatePrices && (
            <button
              type="button"
              onClick={onUpdatePrices}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand transition-colors hover:text-brand-dark"
            >
              <PiArrowsClockwise className="h-3.5 w-3.5" />
              Update Prices
            </button>
          )}
        </div>

        <div className="mt-4">
          <SalesEditorSelect
            label="Warehouse"
            value={warehouseId}
            onChange={onWarehouseChange}
            searchable
            searchPlaceholder="Search warehouses…"
            options={[
              { value: '', label: '— Select warehouse —' },
              ...warehouses.map((w) => ({
                value: w._id,
                label: w.name,
                badge: w.isDefault ? 'Default' : undefined,
              })),
            ]}
          />
        </div>
      </div>

      {invoiceDetails || (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
              Quotation Date
            </label>
            <p className="px-0 py-2 text-sm font-medium text-gray-700">
              {today}
            </p>
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
      )}
    </div>
  );
}
