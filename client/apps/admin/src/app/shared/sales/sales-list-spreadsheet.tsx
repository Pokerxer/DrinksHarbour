'use client';

import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import {
  fmtDate,
  warehouseName,
  salespersonName,
  statusText,
} from './sales-list-helpers';
import { paymentBadge } from './sales-list-status';

interface Props {
  orders: SalesOrder[];
}

const COLS = [
  { key: 'soNumber', label: 'Number' },
  { key: 'createdAt', label: 'Creation Date' },
  { key: 'customer', label: 'Customer' },
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'untaxedAmount', label: 'Untaxed Amt' },
  { key: 'taxTotal', label: 'Tax' },
  { key: 'total', label: 'Total' },
  { key: 'currency', label: 'Currency' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'status', label: 'Status' },
  { key: 'paymentStatus', label: 'Payment' },
  { key: 'amountPaid', label: 'Paid' },
  { key: 'outstanding', label: 'Outstanding' },
];

function cellValue(o: SalesOrder, key: string): string {
  switch (key) {
    case 'soNumber':
      return o.soNumber;
    case 'createdAt':
      return fmtDate(o.createdAt);
    case 'customer':
      return o.customerSnapshot?.name ?? '—';
    case 'salesperson':
      return salespersonName(o);
    case 'untaxedAmount':
      return fmtCur((o.total ?? 0) - (o.taxTotal ?? 0), o.currency);
    case 'taxTotal':
      return fmtCur(o.taxTotal ?? 0, o.currency);
    case 'total':
      return fmtCur(o.total, o.currency);
    case 'currency':
      return o.currency ?? '—';
    case 'warehouse':
      return warehouseName(o);
    // Was `o.docType === 'order' ? 'Sales Order' : …` — a constant for every
    // order, cancelled ones included.
    case 'status':
      return statusText(o);
    case 'paymentStatus':
      return paymentBadge(o).label;
    case 'amountPaid':
      return fmtCur(paymentBadge(o).paid, o.currency);
    case 'outstanding':
      return fmtCur(paymentBadge(o).outstanding, o.currency);
    default:
      return '—';
  }
}

export default function SalesListSpreadsheet({ orders }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {COLS.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-500"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={COLS.length}
                className="py-12 text-center text-gray-400"
              >
                No records
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr
                key={o._id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                {COLS.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-gray-700">
                    {cellValue(o, c.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
