// client/apps/admin/src/app/shared/sales/sales-invoice-view.tsx
'use client';

import { Badge, Title, Text } from 'rizzui';
import { PiPrinter } from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { addressIsEmpty, addressesDiffer, addressLines } from './sales-helpers';

export default function SalesInvoiceView({ so }: { so: SalesOrder }) {
  const paid = so.paymentStatus === 'paid';
  const ship = so.deliveryAddress;
  const showShipTo =
    !!ship &&
    !addressIsEmpty(ship) &&
    addressesDiffer(ship, so.invoiceAddress);

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-5 text-sm sm:p-6">
      <div className="mb-4 flex items-center justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <PiPrinter className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="mb-10 flex flex-col-reverse items-start justify-between md:flex-row">
        <Title as="h4">Sales Invoice</Title>
        <div className="mb-4 md:mb-0">
          <Badge
            variant="flat"
            color={paid ? 'success' : 'warning'}
            rounded="md"
            className="mb-2"
          >
            {paid ? 'Paid' : 'Unpaid'}
          </Badge>
          <Title as="h6">{so.soNumber}</Title>
          <Text className="mt-0.5 text-gray-500">Order Number</Text>
        </div>
      </div>

      <div
        className={`mb-10 grid gap-4 ${
          showShipTo ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
        }`}
      >
        <div>
          <Title as="h6" className="mb-2 font-semibold">
            Bill To
          </Title>
          <Text className="mb-1 font-semibold uppercase">
            {so.customerSnapshot?.name ?? 'Walk-in'}
          </Text>
          {so.customerSnapshot?.phone && (
            <Text className="mb-1">{so.customerSnapshot.phone}</Text>
          )}
          {so.customerSnapshot?.email && (
            <Text className="mb-1">{so.customerSnapshot.email}</Text>
          )}
          {addressLines(so.invoiceAddress).map((l) => (
            <Text key={l} className="mb-1 text-gray-500">
              {l}
            </Text>
          ))}
        </div>
        {showShipTo && (
          <div>
            <Title as="h6" className="mb-2 font-semibold">
              Ship To
            </Title>
            {ship?.name && (
              <Text className="mb-1 font-semibold uppercase">{ship.name}</Text>
            )}
            {ship?.phone && <Text className="mb-1">{ship.phone}</Text>}
            {addressLines(ship).map((l) => (
              <Text key={l} className="mb-1 text-gray-500">
                {l}
              </Text>
            ))}
          </div>
        )}
        <div className="sm:text-right">
          <Title as="h6" className="mb-2 font-semibold">
            Order Date
          </Title>
          <Text>
            {so.createdAt ? new Date(so.createdAt).toLocaleDateString() : '—'}
          </Text>
          {so.paymentMethod && (
            <>
              <Title as="h6" className="mb-1 mt-3 font-semibold">
                Payment Method
              </Title>
              <Text className="capitalize">
                {so.paymentMethod.replace('_', ' ')}
              </Text>
            </>
          )}
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                Item
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                Qty
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                Unit Price
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                Tax %
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {so.items.map((item) => (
              <tr key={item._id}>
                <td className="px-3 py-2 text-gray-900">{item.name}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {item.quantity}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {fmtCur(item.unitPrice, so.currency)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {item.taxRate ? `${item.taxRate}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">
                  {fmtCur(item.lineTotal, so.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-sm">
          <Text className="flex items-center justify-between border-b border-gray-100 py-2">
            Subtotal:{' '}
            <Text as="span" className="font-semibold">
              {fmtCur(so.subtotal, so.currency)}
            </Text>
          </Text>
          <Text className="flex items-center justify-between border-b border-gray-100 py-2">
            Discount:{' '}
            <Text as="span" className="font-semibold">
              {fmtCur(so.discountTotal, so.currency)}
            </Text>
          </Text>
          {(so.promotionTotal ?? 0) > 0 && (
            <Text className="flex items-center justify-between border-b border-gray-100 py-2 text-emerald-600">
              Promotions:{' '}
              <Text as="span" className="font-semibold text-emerald-600">
                −{fmtCur(so.promotionTotal ?? 0, so.currency)}
              </Text>
            </Text>
          )}
          <Text className="flex items-center justify-between border-b border-gray-100 py-2">
            Tax:{' '}
            <Text as="span" className="font-semibold">
              {fmtCur(so.taxTotal ?? 0, so.currency)}
            </Text>
          </Text>
          <Text className="flex items-center justify-between pt-3 text-base font-semibold text-gray-900">
            Total: <span>{fmtCur(so.total, so.currency)}</span>
          </Text>
        </div>
      </div>
    </div>
  );
}
