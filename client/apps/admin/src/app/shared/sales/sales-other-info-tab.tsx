// client/apps/admin/src/app/shared/sales/sales-other-info-tab.tsx
'use client';

import { PAYMENT_TERMS } from './sales-helpers';
import SalesAddressBlock, { INPUT_CLS } from './sales-address-block';
import type { SalesOrderAddress } from '@/services/salesOrder.service';

export interface SalesOtherInfoTabProps {
  paymentTerms: string;
  onPaymentTermsChange: (v: string) => void;
  invoiceAddress: SalesOrderAddress;
  deliveryAddress: SalesOrderAddress;
  deliverDifferent: boolean;
  onInvoiceChange: (patch: SalesOrderAddress) => void;
  onDeliveryChange: (patch: SalesOrderAddress) => void;
  onToggleDeliverDifferent: (v: boolean) => void;
  onLoadCustomerAddress?: () => void;
  loadingCustomerAddress?: boolean;
  notes: string;
  onNotesChange: (v: string) => void;
  terms: string;
  onTermsChange: (v: string) => void;
}

/**
 * "Other Info" tab for the Sales create/edit page: payment terms, invoice +
 * delivery addresses, and free-text notes / terms. Composes SalesAddressBlock.
 */
export default function SalesOtherInfoTab({
  paymentTerms,
  onPaymentTermsChange,
  invoiceAddress,
  deliveryAddress,
  deliverDifferent,
  onInvoiceChange,
  onDeliveryChange,
  onToggleDeliverDifferent,
  onLoadCustomerAddress,
  loadingCustomerAddress,
  notes,
  onNotesChange,
  terms,
  onTermsChange,
}: SalesOtherInfoTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Payment Terms
        </label>
        <select
          value={paymentTerms}
          onChange={(e) => onPaymentTermsChange(e.target.value)}
          className={INPUT_CLS}
        >
          {PAYMENT_TERMS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <SalesAddressBlock
        invoiceAddress={invoiceAddress}
        deliveryAddress={deliveryAddress}
        deliverDifferent={deliverDifferent}
        onInvoiceChange={onInvoiceChange}
        onDeliveryChange={onDeliveryChange}
        onToggleDeliverDifferent={onToggleDeliverDifferent}
        onLoadCustomerAddress={onLoadCustomerAddress}
        loadingCustomerAddress={loadingCustomerAddress}
      />

      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className={INPUT_CLS}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Terms
        </label>
        <textarea
          value={terms}
          onChange={(e) => onTermsChange(e.target.value)}
          rows={2}
          className={INPUT_CLS}
        />
      </div>
    </div>
  );
}