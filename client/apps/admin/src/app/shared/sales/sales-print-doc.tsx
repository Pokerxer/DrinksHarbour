// client/apps/admin/src/app/shared/sales/sales-print-doc.tsx
'use client';

import { PiPrinter } from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import {
  addressIsEmpty,
  addressesDiffer,
  addressLines,
  paymentTermsLabel,
} from './sales-helpers';
import {
  isNonProductLine,
  NonProductLineRow,
  sectionSubtotals,
} from './sales-line-read-rows';

const COMPANY_NAME = 'DrinksHarbour';
const COMPANY_ADDRESS = '39 Gana St, Maitama, Abuja, Nigeria';
const COMPANY_PHONE = '';

export type PrintDocType = 'quotation' | 'proforma';

const DOC_TITLE: Record<PrintDocType, string> = {
  quotation: 'QUOTATION',
  proforma: 'PRO-FORMA INVOICE',
};

export default function SalesPrintDoc({
  so,
  docType = 'quotation',
}: {
  so: SalesOrder;
  docType?: PrintDocType;
}) {
  const title = DOC_TITLE[docType];
  const subtotals = sectionSubtotals(so.items);
  const ship = so.deliveryAddress;
  const showShipTo =
    !!ship && !addressIsEmpty(ship) && addressesDiffer(ship, so.invoiceAddress);

  const productLines = so.items.filter((i) => !isNonProductLine(i));
  const untaxed = productLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const taxTotal =
    so.taxTotal ?? productLines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const discountTotal = so.discountTotal ?? 0;

  return (
    <>
      {/* Print button — hidden when actually printing */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-gray-500">
          Preview — close this tab when done.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          <PiPrinter className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Print document */}
      <div
        id="print-doc"
        className="mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-sm shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
      >
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-gray-900">{COMPANY_NAME}</p>
            <p className="mt-0.5 text-xs text-gray-500">{COMPANY_ADDRESS}</p>
            {COMPANY_PHONE && (
              <p className="text-xs text-gray-500">{COMPANY_PHONE}</p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-wide text-gray-900">
              {title}
            </h1>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {so.soNumber}
            </p>
          </div>
        </div>

        {/* Meta row */}
        <div className="mb-8 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-semibold uppercase tracking-wide text-gray-400">
                Date
              </p>
              <p className="mt-0.5 text-gray-700">
                {so.createdAt
                  ? new Date(so.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
            {so.validUntil && (
              <div>
                <p className="font-semibold uppercase tracking-wide text-gray-400">
                  Valid Until
                </p>
                <p className="mt-0.5 text-gray-700">
                  {new Date(so.validUntil).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
            <div>
              <p className="font-semibold uppercase tracking-wide text-gray-400">
                Payment Terms
              </p>
              <p className="mt-0.5 text-gray-700">
                {paymentTermsLabel(so.paymentTerms)}
              </p>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div
          className={`mb-8 grid gap-6 ${showShipTo ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Bill To
            </p>
            <p className="font-semibold text-gray-800">
              {so.customerSnapshot?.name ?? 'Walk-in Customer'}
            </p>
            {so.customerSnapshot?.phone && (
              <p className="text-gray-600">{so.customerSnapshot.phone}</p>
            )}
            {so.customerSnapshot?.email && (
              <p className="text-gray-600">{so.customerSnapshot.email}</p>
            )}
            {addressLines(so.invoiceAddress).map((l) => (
              <p key={l} className="text-gray-500">
                {l}
              </p>
            ))}
          </div>

          {showShipTo && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Deliver To
              </p>
              {ship?.name && (
                <p className="font-semibold text-gray-800">{ship.name}</p>
              )}
              {ship?.phone && <p className="text-gray-600">{ship.phone}</p>}
              {addressLines(ship).map((l) => (
                <p key={l} className="text-gray-500">
                  {l}
                </p>
              ))}
            </div>
          )}

          {/* Blank col so the grid is balanced for 2-col layout */}
          {!showShipTo && <div />}
        </div>

        {/* Line items */}
        <div className="mb-8 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-gray-500">
                  Item
                </th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">
                  Qty
                </th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">
                  Unit Price
                </th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">
                  Discount
                </th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">
                  Tax
                </th>
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-gray-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {so.items.map((item) =>
                isNonProductLine(item) ? (
                  <NonProductLineRow
                    key={item._id}
                    item={item}
                    cols={6}
                    subtotal={
                      item.lineType === 'section'
                        ? subtotals.get(item._id)
                        : undefined
                    }
                    currency={so.currency}
                  />
                ) : (
                  <tr key={item._id}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {fmtCur(item.unitPrice, so.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {item.discount > 0
                        ? item.discountType === 'percentage'
                          ? `${item.discount}%`
                          : fmtCur(item.discount, so.currency)
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {item.taxRate ? `${item.taxRate}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                      {fmtCur(item.lineTotal, so.currency)}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 text-sm">
            <div className="flex items-center justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-800">
                {fmtCur(untaxed, so.currency)}
              </span>
            </div>
            {discountTotal > 0 && (
              <div className="flex items-center justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Discount</span>
                <span className="font-medium text-gray-800">
                  −{fmtCur(discountTotal, so.currency)}
                </span>
              </div>
            )}
            {taxTotal > 0 && (
              <div className="flex items-center justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Tax</span>
                <span className="font-medium text-gray-800">
                  {fmtCur(taxTotal, so.currency)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-base font-bold text-gray-900">
                {fmtCur(so.total, so.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(so.notes || so.terms) && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            {so.notes && (
              <div className="mb-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-xs text-gray-600">
                  {so.notes}
                </p>
              </div>
            )}
            {so.terms && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Terms &amp; Conditions
                </p>
                <p className="whitespace-pre-wrap text-xs text-gray-600">
                  {so.terms}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 border-t border-gray-100 pt-4 text-center text-[10px] text-gray-400">
          {COMPANY_NAME} · {COMPANY_ADDRESS}
          {docType === 'proforma' && (
            <p className="mt-0.5">
              This is a pro-forma invoice and does not constitute a tax invoice.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
