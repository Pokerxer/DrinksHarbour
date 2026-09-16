'use client';

import type { GroupRow, GroupSortField } from '../types';
import { SortChevron } from './sort-chevron';
import { highlight } from './highlight';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { GROUP_PAGE_SIZE } from '../constants';
import { PageBar } from './page-bar';

interface GroupedTableProps {
  rows: GroupRow[];
  grouped: GroupRow[];
  groupLabel: string;
  hasCostData: boolean;
  showProfit: boolean;
  groupSortField: GroupSortField;
  groupSortDir: 'asc' | 'desc';
  toggleGroupSort: (f: GroupSortField) => void;
  debouncedSearch: string;
  groupPage: number;
  setGroupPage: (p: number) => void;
  distinctOrderCount: number;
  allRowCount: number;
}

export function GroupedTable({
  rows, grouped, groupLabel, hasCostData, showProfit,
  groupSortField, groupSortDir, toggleGroupSort,
  debouncedSearch, groupPage, setGroupPage,
  distinctOrderCount, allRowCount,
}: GroupedTableProps) {
  const totalPages = Math.max(1, Math.ceil(grouped.length / GROUP_PAGE_SIZE));

  const cols: { field: GroupSortField; label: string; align: 'text-left' | 'text-center' | 'text-right' }[] = [
    { field: 'key', label: groupLabel, align: 'text-left' },
    { field: 'qty', label: 'Qty Sold', align: 'text-center' },
    { field: 'gross', label: 'Gross Revenue', align: 'text-right' },
    { field: 'discount', label: 'Discount', align: 'text-right' },
    { field: 'revenue', label: 'Net Revenue', align: 'text-right' },
    ...(showProfit && hasCostData ? [{ field: 'profit' as GroupSortField, label: 'Profit', align: 'text-right' as const }] : []),
    { field: 'share', label: 'Revenue Share', align: 'text-left' as const },
    { field: 'lineCount', label: 'Lines', align: 'text-center' as const },
    { field: 'orderCount', label: 'Orders', align: 'text-center' as const },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {cols.map(({ field, label, align }) => (
                <th
                  key={field}
                  onClick={() => toggleGroupSort(field)}
                  className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 ${align} hover:text-gray-700`}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <SortChevron active={groupSortField === field} dir={groupSortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-20 text-center text-sm text-gray-400">
                  {allRowCount === 0 ? 'No sales data found.' : 'No data matches the current filters.'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.key}
                  className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                >
                  <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-gray-900">
                    {highlight(row.key, debouncedSearch)}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-700">
                    {row.qty.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-500">
                    {formatCurrency(row.gross)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                    {row.discount > 0 ? (
                      <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                    {formatCurrency(row.revenue)}
                  </td>
                  {showProfit && hasCostData && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {row.profit > 0 ? (
                        <span className="font-medium text-teal-600">{formatCurrency(row.profit)}</span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  )}
                  <td className="min-w-[160px] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-[#b20202] transition-all"
                          style={{ width: `${Math.min(100, row.share)}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">
                        {row.share.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">
                    {row.lineCount}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">
                    {row.orderCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {grouped.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                <td className="px-4 py-3 text-gray-400">
                  {grouped.length} group{grouped.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {grouped.reduce((s, r) => s + r.qty, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                  {formatCurrency(grouped.reduce((s, r) => s + r.gross, 0))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-orange-500">
                  −{formatCurrency(grouped.reduce((s, r) => s + r.discount, 0))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#b20202]">
                  {formatCurrency(grouped.reduce((s, r) => s + r.revenue, 0))}
                </td>
                {showProfit && hasCostData && (
                  <td className="px-4 py-3 text-right tabular-nums text-teal-600">
                    {formatCurrency(grouped.reduce((s, r) => s + r.profit, 0))}
                  </td>
                )}
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {grouped.reduce((s, r) => s + r.lineCount, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {distinctOrderCount.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <PageBar
        page={groupPage}
        totalPages={totalPages}
        totalItems={grouped.length}
        pageSize={GROUP_PAGE_SIZE}
        onPrev={() => setGroupPage(Math.max(1, groupPage - 1))}
        onNext={() => setGroupPage(Math.min(totalPages, groupPage + 1))}
        onPage={setGroupPage}
      />
    </div>
  );
}