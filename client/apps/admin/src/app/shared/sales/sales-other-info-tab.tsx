// client/apps/admin/src/app/shared/sales/sales-other-info-tab.tsx
'use client';

import { PiCreditCard, PiMapPin, PiNotePencil } from 'react-icons/pi';
import type { ReactNode } from 'react';
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

/** Section wrapper: icon + uppercase mini-header, matching the detail cards. */
function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/10 text-brand">
          {icon}
        </span>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
          {title}
        </h3>
        {hint && <span className="text-[11px] text-gray-400">— {hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * "Other Info" tab for the Sales create/edit page, grouped into three
 * sections: Payment, Addresses, and Notes & Terms.
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Section
          icon={<PiCreditCard className="h-3.5 w-3.5" />}
          title="Payment"
          hint="due date derives from the document date"
        >
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
        </Section>

        <Section
          icon={<PiNotePencil className="h-3.5 w-3.5" />}
          title="Notes & Terms"
          hint="shown on the printed document"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={3}
                placeholder="Internal or customer-facing notes for this document…"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Terms &amp; Conditions
              </label>
              <textarea
                value={terms}
                onChange={(e) => onTermsChange(e.target.value)}
                rows={4}
                placeholder="Payment terms, return policy, delivery conditions…"
                className={INPUT_CLS}
              />
            </div>
          </div>
        </Section>
      </div>

      <Section
        icon={<PiMapPin className="h-3.5 w-3.5" />}
        title="Addresses"
        hint="invoice + optional delivery"
      >
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
      </Section>
    </div>
  );
}
