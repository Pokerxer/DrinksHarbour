'use client';

import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
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

export default function SalesOrderDetailInfo({ so }: Props) {
  const ship = so.deliveryAddress;
  const hasShipTo =
    ship && !addressIsEmpty(ship) && addressesDiffer(ship, so.invoiceAddress);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
          Sale Details
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Order Date</span>
            <span className="text-sm font-medium text-gray-800">{fmtDate(so.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Payment Terms</span>
            <span className="text-sm font-medium text-gray-800">{paymentTermsLabel(so.paymentTerms)}</span>
          </div>
          {so.dueDate && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Due Date</span>
              <span className="text-sm font-medium text-gray-800">{fmtDate(so.dueDate)}</span>
            </div>
          )}
          {so.appliedPricelist?.pricelistName && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Pricelist</span>
              <span className="text-sm font-medium text-gray-800">{so.appliedPricelist.pricelistName}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Payment</span>
            <span className={`text-sm font-semibold ${so.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {so.paymentStatus === 'paid'
                ? `Paid · ${so.paymentMethod ?? '—'}`
                : 'Unpaid'}
            </span>
          </div>
          {(so.loyaltyRedeemed ?? 0) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Loyalty</span>
              <span className="text-sm font-medium text-emerald-600">
                {so.pointsRedeemed} pts · −{fmtCur(so.loyaltyRedeemed ?? 0, so.currency)}
              </span>
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
