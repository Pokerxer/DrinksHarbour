'use client';

import type { SalesOrder } from '@/services/salesOrder.service';
import {
  addressLines,
  paymentTermsLabel,
  addressIsEmpty,
  addressesDiffer,
  fmtDate,
} from './sales-helpers';

interface Props {
  so: SalesOrder;
}

export default function SalesQuotationDetailInfo({ so }: Props) {
  const ship = so.deliveryAddress;
  const hasShipTo =
    ship && !addressIsEmpty(ship) && addressesDiffer(ship, so.invoiceAddress);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
          Quote Details
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Quote Date</span>
            <span className="text-sm font-medium text-gray-800">{fmtDate(so.createdAt)}</span>
          </div>
          {so.validUntil && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Valid Until</span>
              <span className="text-sm font-medium text-gray-800">{fmtDate(so.validUntil)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Payment Terms</span>
            <span className="text-sm font-medium text-gray-800">{paymentTermsLabel(so.paymentTerms)}</span>
          </div>
          {so.appliedPricelist?.pricelistName && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Pricelist</span>
              <span className="text-sm font-medium text-gray-800">{so.appliedPricelist.pricelistName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
          {hasShipTo ? 'Invoicing & Shipping' : 'Invoicing Address'}
        </h2>
        <div className={`grid gap-4 ${hasShipTo ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Bill To</p>
            <p className="text-sm font-semibold text-gray-900">{so.customerSnapshot?.name ?? 'Walk-in Customer'}</p>
            {addressLines(so.invoiceAddress).map((l) => (
              <p key={l} className="mt-0.5 text-xs leading-relaxed text-gray-500">{l}</p>
            ))}
          </div>
          {hasShipTo && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Ship To</p>
              <p className="text-sm font-semibold text-gray-900">{ship?.name ?? so.customerSnapshot?.name ?? '—'}</p>
              {addressLines(ship).map((l) => (
                <p key={l} className="mt-0.5 text-xs leading-relaxed text-gray-500">{l}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
