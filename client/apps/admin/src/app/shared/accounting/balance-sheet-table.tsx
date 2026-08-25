'use client';

import type { BalanceSheet } from '@/services/accounting.service';
import { downloadCsv, fmtMoney } from './accounting-helpers';

function Section({ title, data }: { title: string; data: BalanceSheet['assets'] }) {
  return (
    <>
      <tr className="bg-gray-50">
        <td colSpan={2} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </td>
      </tr>
      {data.rows.length === 0 && (
        <tr>
          <td colSpan={2} className="px-4 py-3 text-center text-gray-400">—</td>
        </tr>
      )}
      {data.rows.map((r) => (
        <tr key={r.code}>
          <td className="px-8 py-3 text-gray-700">{r.code}</td>
          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(r.amount)}</td>
        </tr>
      ))}
      <tr className="font-semibold">
        <td className="px-4 py-3">Total {title}</td>
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(data.total)}</td>
      </tr>
    </>
  );
}

/** Balance Sheet — assets = liabilities + equity (incl. retained earnings). */
export default function BalanceSheetTable({ data }: { data: BalanceSheet }) {
  return (
    <div>
      {!data.balanced && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ Assets do not equal liabilities + equity yet — post opening-balance
          entries (e.g. cash/equity) or run the journal backfill.
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <Section title="Assets" data={data.assets} />
            <Section title="Liabilities" data={data.liabilities} />
            <Section title="Equity" data={data.equity} />
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              ['Section', 'Code', 'Amount'],
              [
                ...data.assets.rows.map((r) => ['Assets', r.code, r.amount.toFixed(2)]),
                ...data.liabilities.rows.map((r) => ['Liabilities', r.code, r.amount.toFixed(2)]),
                ...data.equity.rows.map((r) => ['Equity', r.code, r.amount.toFixed(2)]),
              ],
              'balance-sheet'
            )
          }
          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
