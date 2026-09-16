'use client';

import type { LineRow, LineSortField, ToggleableCol } from '../types';
import { SortChevron } from './sort-chevron';
import { highlight } from './highlight';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { METHOD_COLOR, METHOD_LABEL, PAGE_SIZE } from '../constants';
import { PageBar } from './page-bar';

interface LinesTableProps {
  rows: LineRow[];
  sorted: LineRow[];
  hasCostData: boolean;
  hiddenCols: Set<ToggleableCol>;
  lineSortField: LineSortField;
  lineSortDir: 'asc' | 'desc';
  toggleLineSort: (f: LineSortField) => void;
  vis: (k: ToggleableCol) => boolean;
  debouncedSearch: string;
  showProfit: boolean;
  page: number;
  setPage: (p: number) => void;
  allRowCount: number;
}

export function LinesTable({
  rows, sorted, hasCostData, hiddenCols,
  lineSortField, lineSortDir, toggleLineSort, vis,
  debouncedSearch, showProfit, page, setPage, allRowCount,
}: LinesTableProps) {
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const th = (field: LineSortField, align: 'left' | 'center' | 'right' = 'left') =>
    `cursor-pointer select-none whitespace-nowrap px-4 py-3 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} hover:text-gray-700`;

  const shift = (n: number) => {
    let c = 0;
    if (vis('orderNumber')) c++;
    if (vis('cashier')) c++;
    c += 1; // product
    if (vis('variant')) c++;
    if (vis('category')) c++;
    if (vis('subcategory')) c++;
    if (vis('brand')) c++;
    c += 1; // warehouse
    return c + n;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th onClick={() => toggleLineSort('date')} className={th('date')}>
                <span className="inline-flex items-center gap-1">Date/Time <SortChevron active={lineSortField === 'date'} dir={lineSortDir} /></span>
              </th>
              {vis('orderNumber') && (
                <th onClick={() => toggleLineSort('orderNumber')} className={th('orderNumber')}>
                  <span className="inline-flex items-center gap-1">Order # <SortChevron active={lineSortField === 'orderNumber'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('cashier') && (
                <th onClick={() => toggleLineSort('cashier')} className={th('cashier')}>
                  <span className="inline-flex items-center gap-1">Cashier <SortChevron active={lineSortField === 'cashier'} dir={lineSortDir} /></span>
                </th>
              )}
              <th onClick={() => toggleLineSort('product')} className={th('product')}>
                <span className="inline-flex items-center gap-1">Product <SortChevron active={lineSortField === 'product'} dir={lineSortDir} /></span>
              </th>
              {vis('variant') && (
                <th onClick={() => toggleLineSort('variant')} className={th('variant')}>
                  <span className="inline-flex items-center gap-1">Variant <SortChevron active={lineSortField === 'variant'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('category') && (
                <th onClick={() => toggleLineSort('category')} className={th('category')}>
                  <span className="inline-flex items-center gap-1">Category <SortChevron active={lineSortField === 'category'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('subcategory') && (
                <th onClick={() => toggleLineSort('subcategory')} className={th('subcategory')}>
                  <span className="inline-flex items-center gap-1">Subcategory <SortChevron active={lineSortField === 'subcategory'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('brand') && (
                <th onClick={() => toggleLineSort('brand')} className={th('brand')}>
                  <span className="inline-flex items-center gap-1">Brand <SortChevron active={lineSortField === 'brand'} dir={lineSortDir} /></span>
                </th>
              )}
              <th className="whitespace-nowrap px-4 py-3 text-left">Warehouse</th>
              <th onClick={() => toggleLineSort('qty')} className={th('qty', 'center')}>
                <span className="inline-flex items-center justify-center gap-1">Qty <SortChevron active={lineSortField === 'qty'} dir={lineSortDir} /></span>
              </th>
              {vis('unitPrice') && (
                <th onClick={() => toggleLineSort('unitPrice')} className={th('unitPrice', 'right')}>
                  <span className="inline-flex items-center gap-1">Unit Price <SortChevron active={lineSortField === 'unitPrice'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('gross') && (
                <th onClick={() => toggleLineSort('gross')} className={th('gross', 'right')}>
                  <span className="inline-flex items-center gap-1">Gross <SortChevron active={lineSortField === 'gross'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('discount') && (
                <th onClick={() => toggleLineSort('discount')} className={th('discount', 'right')}>
                  <span className="inline-flex items-center gap-1">Discount <SortChevron active={lineSortField === 'discount'} dir={lineSortDir} /></span>
                </th>
              )}
              <th onClick={() => toggleLineSort('subtotal')} className={th('subtotal', 'right')}>
                <span className="inline-flex items-center gap-1">Net Total <SortChevron active={lineSortField === 'subtotal'} dir={lineSortDir} /></span>
              </th>
              {showProfit && hasCostData && (
                <th onClick={() => toggleLineSort('profit')} className={th('profit', 'right')}>
                  <span className="inline-flex items-center gap-1">Profit <SortChevron active={lineSortField === 'profit'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('payment') && (
                <th onClick={() => toggleLineSort('paymentMethod')} className={th('paymentMethod')}>
                  <span className="inline-flex items-center gap-1">Payment <SortChevron active={lineSortField === 'paymentMethod'} dir={lineSortDir} /></span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-20 text-center">
                  <p className="text-sm font-medium text-gray-400">
                    {allRowCount === 0 ? 'No sales data found.' : 'No line items match the current filters.'}
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={`${row.orderId}-${i}`}
                  className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${
                    i % 2 === 1 ? 'bg-gray-50/30' : ''
                  } ${row.isVoided ? 'opacity-40' : ''}`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                    {new Date(row.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  {vis('orderNumber') && (
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="font-mono text-xs font-semibold text-gray-800">
                        {highlight(row.orderNumber, debouncedSearch)}
                      </span>
                      {row.isVoided && (
                        <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">VOID</span>
                      )}
                    </td>
                  )}
                  {vis('cashier') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
                      {highlight(row.cashier, debouncedSearch)}
                    </td>
                  )}
                  <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-gray-900">
                    {highlight(row.product, debouncedSearch)}
                  </td>
                  {vis('variant') && (
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {row.variant ? highlight(row.variant, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {vis('category') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                      {row.category ? highlight(row.category, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {vis('subcategory') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                      {row.subcategory ? highlight(row.subcategory, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {vis('brand') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                      {row.brand ? highlight(row.brand, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
                    {row.warehouse || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-sm font-medium tabular-nums text-gray-700">
                    {row.qty}
                  </td>
                  {vis('unitPrice') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600">
                      {formatCurrency(row.unitPrice)}
                    </td>
                  )}
                  {vis('gross') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-500">
                      {formatCurrency(row.gross)}
                    </td>
                  )}
                  {vis('discount') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                      {row.discount > 0 ? (
                        <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                    {formatCurrency(row.subtotal)}
                  </td>
                  {showProfit && hasCostData && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                      {row.profit > 0 ? (
                        <span className="font-medium text-teal-600">{formatCurrency(row.profit)}</span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  )}
                  {vis('payment') && (
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${METHOD_COLOR[row.paymentMethod] ?? 'border border-gray-200 bg-gray-100 text-gray-600'}`}>
                        {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
                      </span>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                <td
                  colSpan={shift(1)}
                  className="px-4 py-3 text-gray-400"
                >
                  {sorted.length.toLocaleString()} line{sorted.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {sorted.reduce((s, r) => s + r.qty, 0).toLocaleString()}
                </td>
                {vis('unitPrice') && <td className="px-4 py-3" />}
                {vis('gross') && (
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {formatCurrency(sorted.reduce((s, r) => s + r.gross, 0))}
                  </td>
                )}
                {vis('discount') && (
                  <td className="px-4 py-3 text-right tabular-nums text-orange-500">
                    −{formatCurrency(sorted.reduce((s, r) => s + r.discount, 0))}
                  </td>
                )}
                <td className="px-4 py-3 text-right tabular-nums text-[#b20202]">
                  {formatCurrency(sorted.reduce((s, r) => s + r.subtotal, 0))}
                </td>
                {showProfit && hasCostData && (
                  <td className="px-4 py-3 text-right tabular-nums text-teal-600">
                    {formatCurrency(sorted.reduce((s, r) => s + r.profit, 0))}
                  </td>
                )}
                {vis('payment') && <td className="px-4 py-3" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <PageBar
        page={page}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(Math.min(totalPages, page + 1))}
        onPage={setPage}
      />
    </div>
  );
}