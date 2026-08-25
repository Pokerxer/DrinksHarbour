'use client';

import Link from 'next/link';
import { PiArrowUpRight, PiArrowDownRight } from 'react-icons/pi';
import type { ProfitLoss } from '@/services/accounting.service';
import { fmtMoney } from './accounting-helpers';

/** Tax collected vs paid — right-column breakdown in the POS method-bars style. */
export default function AccountingDashboardTaxCard({
  profitLoss,
}: {
  profitLoss: ProfitLoss;
}) {
  const { collected, paid } = profitLoss.tax;
  const net = Math.round((collected - paid) * 100) / 100;
  const bigger = Math.max(collected, paid, 1);
  const rows = [
    { key: 'collected', label: 'VAT Collected', amount: collected, color: 'bg-emerald-500' },
    { key: 'paid', label: 'VAT Paid', amount: paid, color: 'bg-[#b20202]' },
  ];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">This Month by VAT</p>
        <Link
          href="/accounting/taxes?tab=summary"
          className="text-[11px] font-semibold text-[#b20202] hover:underline"
        >
          Details →
        </Link>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">{r.label}</span>
              <span className="text-xs font-bold tabular-nums text-gray-800">
                {fmtMoney(r.amount)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${r.color}`}
                style={{ width: `${Math.min(100, Math.round((r.amount / bigger) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div
        className={`mt-4 flex items-center justify-between rounded-xl px-3 py-2.5 ${net >= 0 ? 'bg-gray-50' : 'bg-red-50'}`}
      >
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {net >= 0 ? (
            <PiArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <PiArrowDownRight className="h-3 w-3 text-red-400" />
          )}
          Net VAT position
        </span>
        <span className="text-sm font-black tabular-nums text-gray-900">{fmtMoney(net)}</span>
      </div>
    </div>
  );
}
