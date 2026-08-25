'use client';

import Link from 'next/link';
import { PiBookOpenDuotone, PiChartBarDuotone, PiBooksDuotone, PiReceiptDuotone } from 'react-icons/pi';
import type { AccountingDashboard as DashboardPayload } from '@/services/accounting.service';

const MODULE_CARDS = [
  {
    href: '/accounting/journal-entries',
    title: 'Journal Entries',
    badge: 'LEDGER',
    description: 'Post manual entries, reverse mistakes, review every movement',
    color: '#b20202',
  },
  {
    href: '/accounting/reports',
    title: 'Reports',
    badge: 'ANALYSIS',
    description: 'Trial balance · Profit & Loss · Balance sheet · Ledger',
    color: '#7c3aed',
  },
  {
    href: '/accounting/chart-of-accounts',
    title: 'Chart of Accounts',
    badge: 'SETUP',
    description: 'Your account tree grouped by type',
    color: '#0ea5e9',
  },
  {
    href: '/accounting/taxes?tab=summary',
    title: 'Taxes',
    badge: 'VAT',
    description: 'Rates, capture ledger and monthly summary',
    color: '#059669',
  },
];

/** Module shortcut cards — terminal-card style from the POS dashboard. */
export default function AccountingDashboardModules({
  data,
}: {
  data: DashboardPayload | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {MODULE_CARDS.map((m) => (
        <Link
          key={m.title}
          href={m.href}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="h-1 w-full" style={{ background: m.color }} />
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold tracking-wide text-gray-900">
                  {m.title}{' '}
                  <span className="text-sm font-normal text-gray-400">[{m.badge}]</span>
                </h3>
                <p className="text-xs text-gray-400">{m.description}</p>
              </div>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white [&>svg]:h-4.5 [&>svg]:w-4.5"
                style={{ background: m.color }}
              >
                {m.title === 'Journal Entries' && <PiBookOpenDuotone />}
                {m.title === 'Reports' && <PiChartBarDuotone />}
                {m.title === 'Chart of Accounts' && <PiBooksDuotone />}
                {m.title === 'Taxes' && <PiReceiptDuotone />}
              </span>
            </div>
            {data && m.badge === 'VAT' && (
              <p className="mt-auto text-[11px] font-semibold text-gray-500">
                Net MTD:{' '}
                <span className="tabular-nums text-gray-900">
                  {fmtNet(data.profitLoss.tax.collected - data.profitLoss.tax.paid)}
                </span>
              </p>
            )}
            {data && m.badge === 'LEDGER' && (
              <p className="mt-auto text-[11px] font-semibold text-gray-500">
                Drafts waiting:{' '}
                <span className="tabular-nums text-gray-900">{data.unpostedDraftCount}</span>
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function fmtNet(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}₦ ${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
