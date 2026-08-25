'use client';

import Link from 'next/link';
import { PiCaretRight, PiTrendUp, PiTrendDown, PiReceipt, PiArrowsCounterClockwise } from 'react-icons/pi';
import type { AccountingDashboard as DashboardPayload } from '@/services/accounting.service';
import { fmtMoney } from './accounting-helpers';

/** Stat card in the POS dashboard style (rounded-2xl, icon square, black value). */
function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-md ${accent ? 'border-[#b20202]/20 bg-[#b20202]/5' : 'border-gray-200 bg-white'}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-500'}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p
          className={`mt-0.5 text-xl font-black tabular-nums leading-none ${accent ? 'text-[#b20202]' : 'text-gray-900'}`}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-[10px] text-gray-400">{sub}</p>}
      </div>
      <PiCaretRight className="mt-1 h-4 w-4 shrink-0 text-gray-200" />
    </Link>
  );
}

/** Month-to-date stat row: revenue · expenses · net profit · net tax. */
export default function AccountingDashboardKpis({
  data,
}: {
  data: DashboardPayload['kpis'];
}) {
  const netTax = Math.round((data.taxCollectedMtd - data.taxPaidMtd) * 100) / 100;
  const profitPositive = data.netProfitMtd >= 0;
  const stats = [
    {
      label: 'Revenue MTD',
      value: fmtMoney(data.revenueMtd),
      sub: data.grossProfitMtd != null ? `Gross ${fmtMoney(data.grossProfitMtd)}` : undefined,
      icon: <PiTrendUp className="h-5 w-5" />,
      accent: true,
      href: '/accounting/reports',
    },
    {
      label: 'Expenses MTD',
      value: fmtMoney(data.expensesMtd ?? 0),
      sub: `${data.unpostedDraftCount ?? 0} draft entries`,
      icon: <PiTrendDown className="h-5 w-5" />,
      href: '/accounting/reports',
    },
    {
      label: 'Net Profit MTD',
      value: fmtMoney(data.netProfitMtd),
      sub: profitPositive ? 'In the black' : 'Running at a loss',
      icon: <PiTrendUp className={`h-5 w-5 ${profitPositive ? '' : 'rotate-180'}`} />,
      href: '/accounting/reports',
    },
    {
      label: 'Net Tax MTD',
      value: fmtMoney(netTax),
      sub: `Collected ${fmtMoney(data.taxCollectedMtd)} · Paid ${fmtMoney(data.taxPaidMtd)}`,
      icon: <PiReceipt className="h-5 w-5" />,
      href: '/accounting/taxes?tab=summary',
    },
    {
      label: 'Unposted Drafts',
      value: String(data.unpostedDraftCount ?? 0),
      icon: <PiArrowsCounterClockwise className="h-5 w-5" />,
      href: '/accounting/journal-entries',
    },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}
