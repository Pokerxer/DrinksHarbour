// client/apps/admin/src/app/shared/sales/sales-address-block.tsx
'use client';

import { PiArrowsCounterClockwise } from 'react-icons/pi';
import type { SalesOrderAddress } from '@/services/salesOrder.service';

export const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

const ADDRESS_FIELDS: {
  key: keyof SalesOrderAddress;
  label: string;
  span?: boolean;
}[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'street', label: 'Street', span: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
];

/** Two-column block of the 6 structured address inputs. */
export function AddressFields({
  value,
  onChange,
  disabled,
}: {
  value: SalesOrderAddress;
  onChange: (patch: SalesOrderAddress) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ADDRESS_FIELDS.map((f) => (
        <div key={f.key} className={f.span ? 'sm:col-span-2' : undefined}>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            {f.label}
          </label>
          <input
            type="text"
            value={value[f.key] ?? ''}
            onChange={(e) => onChange({ [f.key]: e.target.value })}
            disabled={disabled}
            className={INPUT_CLS}
          />
        </div>
      ))}
    </div>
  );
}

export interface SalesAddressBlockProps {
  invoiceAddress: SalesOrderAddress;
  deliveryAddress: SalesOrderAddress;
  deliverDifferent: boolean;
  onInvoiceChange: (patch: SalesOrderAddress) => void;
  onDeliveryChange: (patch: SalesOrderAddress) => void;
  onToggleDeliverDifferent: (v: boolean) => void;
  /** Pull the customer's default address again (overwrites manual edits after confirm). */
  onLoadCustomerAddress?: () => void;
  loadingCustomerAddress?: boolean;
}

/**
 * Invoice + delivery address section for the Sales create "Other Info" tab.
 * The invoice block is always shown; the delivery block appears once the
 * "Deliver to a different address" toggle is on. A "Use customer's address"
 * button re-pulls the customer's resolved default (when a customer is set).
 */
export default function SalesAddressBlock({
  invoiceAddress,
  deliveryAddress,
  deliverDifferent,
  onInvoiceChange,
  onDeliveryChange,
  onToggleDeliverDifferent,
  onLoadCustomerAddress,
  loadingCustomerAddress,
}: SalesAddressBlockProps) {
  return (
    <div className="sm:col-span-2 space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Invoice Address</h3>
          {onLoadCustomerAddress && (
            <button
              type="button"
              onClick={onLoadCustomerAddress}
              disabled={loadingCustomerAddress}
              className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline disabled:opacity-50"
            >
              <PiArrowsCounterClockwise className="h-3.5 w-3.5" />
              {loadingCustomerAddress ? 'Loading…' : 'Use customer’s address'}
            </button>
          )}
        </div>
        <AddressFields
          value={invoiceAddress}
          onChange={onInvoiceChange}
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={deliverDifferent}
            onChange={(e) => onToggleDeliverDifferent(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/20"
          />
          Deliver to a different address
        </label>
      </div>

      {deliverDifferent && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Delivery Address</h3>
            {onLoadCustomerAddress && (
              <button
                type="button"
                onClick={onLoadCustomerAddress}
                disabled={loadingCustomerAddress}
                className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline disabled:opacity-50"
              >
                <PiArrowsCounterClockwise className="h-3.5 w-3.5" />
                {loadingCustomerAddress ? 'Loading…' : 'Use customer’s address'}
              </button>
            )}
          </div>
          <AddressFields
            value={deliveryAddress}
            onChange={onDeliveryChange}
          />
        </div>
      )}
    </div>
  );
}