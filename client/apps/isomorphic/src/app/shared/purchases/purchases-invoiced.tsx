'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiReceipt,
  PiArrowClockwise,
  PiMagnifyingGlass,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiCheckCircle,
  PiClock,
  PiWarning,
  PiCurrencyDollar,
  PiCaretRight,
  PiCalendarBlank,
  PiEye,
  PiMoney,
  PiTrendUp,
  PiBuildings,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from '@/services/vendor.service';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorBill, Payment } from '@/services/vendorBill.service';
import { STATUS_BADGE } from './types';

// ─── types ────────────────────────────────────────────────────────
type SortCol =
  | 'billNumber'
  | 'billDate'
  | 'dueDate'
  | 'total'
  | 'paid'
  | 'due'
  | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter =
  | 'all'
  | 'confirmed'
  | 'posted'
  | 'paid'
  | 'partial'
  | 'overdue';
type DateRange = 'all' | '30d' | '90d' | '1y';

const INVOICED_STATUSES = ['posted', 'confirmed', 'paid', 'partial', 'overdue'];

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'posted', label: 'Posted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'partial', label: 'Partial' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
];

const DATE_RANGES: { key: DateRange; label: string; days: number }[] = [
  { key: 'all', label: 'All time', days: 0 },
  { key: '30d', label: 'Last 30d', days: 30 },
  { key: '90d', label: 'Last 90d', days: 90 },
  { key: '1y', label: 'Last year', days: 365 },
];

// ─── helpers ─────────────────────────────────────────────────────
function fmt(n: number, cur = 'NGN') {
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`;
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function fmtMonthYear(s: string) {
  return new Date(s).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}
function isOverdue(b: VendorBill) {
  return b.status !== 'paid' && !!b.dueDate && new Date(b.dueDate) < new Date();
}
function daysOverdue(d?: string) {
  if (!d) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  );
}
function daysSince(d?: string) {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}
function dueAmount(b: VendorBill) {
  return Math.max(0, b.totalAmount - b.paidAmount);
}

// ─── aging buckets ────────────────────────────────────────────────
type AgingBucket = { label: string; color: string; bills: VendorBill[] };
function buildAging(bills: VendorBill[]): AgingBucket[] {
  const unpaid = bills.filter((b) => b.status !== 'paid' && dueAmount(b) > 0);
  const current: VendorBill[] = [];
  const d1_30: VendorBill[] = [];
  const d31_60: VendorBill[] = [];
  const d60plus: VendorBill[] = [];
  for (const b of unpaid) {
    const days = daysOverdue(b.dueDate);
    if (days === 0) current.push(b);
    else if (days <= 30) d1_30.push(b);
    else if (days <= 60) d31_60.push(b);
    else d60plus.push(b);
  }
  return [
    { label: 'Current', color: 'bg-emerald-500', bills: current },
    { label: '1–30 days', color: 'bg-amber-400', bills: d1_30 },
    { label: '31–60 days', color: 'bg-orange-500', bills: d31_60 },
    { label: '60+ days', color: 'bg-[#b20202]', bills: d60plus },
  ];
}

// ─── skeletons ─────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[50, 60, 45, 45, 55, 55, 40, 30].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-3.5 animate-pulse rounded bg-gray-100"
            style={{ width: `${w}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── sort icon ────────────────────────────────────────────────────
function SortIcon({
  col,
  active,
  dir,
}: {
  col: SortCol;
  active: SortCol;
  dir: SortDir;
}) {
  if (col !== active)
    return (
      <PiArrowsDownUp className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
    );
  return dir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}

// ─── circular progress ────────────────────────────────────────────
function CircleProgress({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={10}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct >= 100 ? '#10b981' : '#10b981'}
        strokeWidth={10}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

// ─── payment timeline ─────────────────────────────────────────────
function PaymentTimeline({ bills }: { bills: VendorBill[] }) {
  const groups = useMemo(() => {
    const list: (Payment & { billNumber: string; billId: string })[] = [];
    for (const b of bills) {
      for (const p of b.payments ?? []) {
        list.push({ ...p, billNumber: b.billNumber, billId: b._id });
      }
    }
    list.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // group by month
    const map = new Map<string, typeof list>();
    for (const p of list) {
      const key = fmtMonthYear(p.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()];
  }, [bills]);

  const totalPayments = groups.reduce((s, [, arr]) => s + arr.length, 0);
  const totalPaidAmt = groups.reduce(
    (s, [, arr]) => s + arr.reduce((ss, p) => ss + p.amount, 0),
    0
  );

  if (!groups.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <PiMoney className="h-7 w-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">
          No payments recorded yet
        </p>
        <p className="mt-1 text-[11px] text-gray-400">
          Payment entries will appear here once recorded
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* summary bar */}
      <div className="mb-5 flex items-center gap-6 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <div className="text-[11px] text-gray-400">Total Payments</div>
          <div className="text-sm font-bold text-gray-800">
            {totalPayments} entries
          </div>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div>
          <div className="text-[11px] text-gray-400">Total Paid Out</div>
          <div className="text-sm font-bold text-emerald-600">
            {fmt(totalPaidAmt)}
          </div>
        </div>
      </div>

      {/* timeline by month */}
      <div className="space-y-6">
        {groups.map(([month, entries]) => (
          <div key={month}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {month}
              </span>
              <div className="flex-1 border-t border-gray-100" />
              <span className="text-[11px] text-gray-400">
                {fmt(entries.reduce((s, p) => s + p.amount, 0))}
              </span>
            </div>
            <div className="relative pl-5">
              <div className="absolute left-[8px] top-0 h-full w-px bg-gray-100" />
              <div className="space-y-3">
                {entries.map((p, i) => (
                  <div
                    key={`${p.billId}-${p.date}-${i}`}
                    className="relative flex gap-3"
                  >
                    <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400 bg-white" />
                    <div className="flex-1 rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-gray-800">
                            {fmt(p.amount)}
                          </span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-gray-500">
                            {(p.method ?? 'bank transfer').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-gray-400">
                          {fmtDate(p.date)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Link
                          href={`/purchases/bills/${p.billId}`}
                          className="text-[11px] font-medium text-[#b20202] hover:underline"
                        >
                          {p.billNumber}
                        </Link>
                        {p.reference && (
                          <span className="font-mono text-[10px] text-gray-400">
                            ref: {p.reference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────
export default function PurchasesInvoiced({ vendorId }: { vendorId: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [sortCol, setSortCol] = useState<SortCol>('billDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [tab, setTab] = useState<'bills' | 'aging' | 'payments'>('bills');

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [vendorRes, billsRes] = await Promise.all([
        vendorService.getById(vendorId, token),
        vendorBillService.getVendorBills(token, {
          vendor: vendorId,
          limit: 500,
        }),
      ]);
      setVendor(vendorRes);
      const invoiced = (billsRes.data ?? []).filter((b) =>
        INVOICED_STATUSES.includes(b.status)
      );
      setBills(invoiced);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, status, vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalInvoiced = bills.reduce((s, b) => s + b.totalAmount, 0);
    const totalPaid = bills.reduce((s, b) => s + b.paidAmount, 0);
    const totalDue = bills.reduce((s, b) => s + dueAmount(b), 0);
    const paidPct =
      totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
    const overdueBillsList = bills.filter(isOverdue);
    const overdueAmt = overdueBillsList.reduce((s, b) => s + dueAmount(b), 0);
    // avg days to pay (bills that are fully paid)
    const paidBills = bills.filter((b) => b.status === 'paid' && b.billDate);
    const avgDaysToPay = paidBills.length
      ? Math.round(
          paidBills.reduce((s, b) => s + daysSince(b.billDate), 0) /
            paidBills.length
        )
      : null;
    return {
      totalInvoiced,
      totalPaid,
      totalDue,
      paidPct,
      overdueBills: overdueBillsList.length,
      overdueAmt,
      billCount: bills.length,
      avgDaysToPay,
    };
  }, [bills]);

  const aging = useMemo(() => buildAging(bills), [bills]);

  // ─── tab counts ───────────────────────────────────────────────
  const tabCount = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: bills.length,
      posted: bills.filter((b) => b.status === 'posted').length,
      confirmed: bills.filter((b) => b.status === 'confirmed').length,
      partial: bills.filter((b) => b.status === 'partial').length,
      overdue: bills.filter(isOverdue).length,
      paid: bills.filter((b) => b.status === 'paid').length,
    };
    return counts;
  }, [bills]);

  // ─── filtered + sorted ────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = bills;

    // date range
    if (dateRange !== 'all') {
      const cutoff =
        Date.now() -
        DATE_RANGES.find((d) => d.key === dateRange)!.days * 86_400_000;
      list = list.filter(
        (b) => b.billDate && new Date(b.billDate).getTime() >= cutoff
      );
    }

    // status — overdue is computed, not a stored status
    if (statusFilter === 'overdue') {
      list = list.filter(isOverdue);
    } else if (statusFilter !== 'all') {
      list = list.filter((b) => b.status === statusFilter);
    }

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(q) ||
          (b.vendorName ?? '').toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'billNumber')
        cmp = a.billNumber.localeCompare(b.billNumber);
      else if (sortCol === 'billDate')
        cmp = (a.billDate ?? '').localeCompare(b.billDate ?? '');
      else if (sortCol === 'dueDate')
        cmp = (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
      else if (sortCol === 'total') cmp = a.totalAmount - b.totalAmount;
      else if (sortCol === 'paid') cmp = a.paidAmount - b.paidAmount;
      else if (sortCol === 'due') cmp = dueAmount(a) - dueAmount(b);
      else if (sortCol === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [bills, statusFilter, dateRange, search, sortCol, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const footerTotals = useMemo(
    () => ({
      total: filtered.reduce((s, b) => s + b.totalAmount, 0),
      paid: filtered.reduce((s, b) => s + b.paidAmount, 0),
      due: filtered.reduce((s, b) => s + dueAmount(b), 0),
    }),
    [filtered]
  );

  const agingTotal = aging.reduce(
    (s, bucket) => s + bucket.bills.reduce((ss, b) => ss + dueAmount(b), 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Sticky header ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <nav className="mb-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Link href="/purchases/vendors" className="hover:text-gray-600">
              Vendors
            </Link>
            <PiCaretRight className="h-3 w-3" />
            <Link
              href={`/purchases/vendors/${vendorId}`}
              className="hover:text-gray-600"
            >
              {vendor?.name ?? '…'}
            </Link>
            <PiCaretRight className="h-3 w-3" />
            <span className="font-medium text-gray-700">Invoiced</span>
          </nav>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:bg-gray-50"
              >
                <PiArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-[15px] font-bold text-gray-900">
                  Invoiced Bills
                  {vendor && (
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      — {vendor.name}
                    </span>
                  )}
                </h1>
                {vendor?.paymentTerms && (
                  <span className="text-[11px] text-gray-400">
                    Terms:{' '}
                    <span className="font-medium text-gray-600">
                      {vendor.paymentTerms.replace('_', ' ')}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiArrowClockwise
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
              </button>
              <Link
                href={`/purchases/bills?vendor=${vendorId}`}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
              >
                <PiReceipt className="h-3.5 w-3.5" />
                All Bills
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {/* ── Financial hero ─────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-0 sm:flex-row">
            {/* left: circular progress */}
            <div className="flex flex-col items-center justify-center gap-2 border-b border-gray-100 px-8 py-6 sm:border-b-0 sm:border-r">
              <div className="relative">
                <CircleProgress pct={loading ? 0 : kpis.paidPct} size={100} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[18px] font-black text-gray-900">
                    {loading ? '—' : `${kpis.paidPct}%`}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                    paid
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                {kpis.billCount} bill{kpis.billCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* right: stacked amounts */}
            <div className="flex flex-1 flex-wrap gap-0 divide-gray-100 sm:divide-x">
              {[
                {
                  label: 'Total Invoiced',
                  value: fmtShort(kpis.totalInvoiced),
                  sub: `${kpis.billCount} bills`,
                  icon: <PiReceipt className="h-4 w-4" />,
                  color: 'text-gray-900',
                  bg: 'bg-gray-50',
                },
                {
                  label: 'Total Paid',
                  value: fmtShort(kpis.totalPaid),
                  sub: `${kpis.paidPct}% of total`,
                  icon: <PiCheckCircle className="h-4 w-4" />,
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                },
                {
                  label: 'Outstanding',
                  value: fmtShort(kpis.totalDue),
                  sub: kpis.totalDue > 0 ? 'balance due' : 'fully settled',
                  icon: <PiCurrencyDollar className="h-4 w-4" />,
                  color: kpis.totalDue > 0 ? 'text-amber-600' : 'text-gray-400',
                  bg: kpis.totalDue > 0 ? 'bg-amber-50' : 'bg-gray-50',
                },
                {
                  label: 'Overdue',
                  value:
                    kpis.overdueBills > 0 ? fmtShort(kpis.overdueAmt) : '₦0',
                  sub:
                    kpis.overdueBills > 0
                      ? `${kpis.overdueBills} bill${kpis.overdueBills !== 1 ? 's' : ''}`
                      : 'none',
                  icon: <PiWarning className="h-4 w-4" />,
                  color:
                    kpis.overdueBills > 0 ? 'text-[#b20202]' : 'text-gray-400',
                  bg: kpis.overdueBills > 0 ? 'bg-[#b20202]/5' : 'bg-gray-50',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex min-w-[140px] flex-1 flex-col justify-center gap-1 px-5 py-5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`${stat.color} opacity-70`}>
                      {stat.icon}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {stat.label}
                    </span>
                  </div>
                  <div
                    className={`text-[20px] font-black leading-none ${stat.color}`}
                  >
                    {loading ? (
                      <div className="h-6 w-20 animate-pulse rounded bg-gray-100" />
                    ) : (
                      stat.value
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* progress bar */}
          {kpis.totalInvoiced > 0 && (
            <div className="border-t border-gray-100 px-6 py-3">
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="flex h-full">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${kpis.paidPct}%` }}
                  />
                  {kpis.overdueAmt > 0 && (
                    <div
                      className="h-full bg-[#b20202]"
                      style={{
                        width: `${Math.round((kpis.overdueAmt / kpis.totalInvoiced) * 100)}%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Paid
                </span>
                {kpis.overdueAmt > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#b20202]" />
                    Overdue
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-200" />
                  Pending
                </span>
                {kpis.avgDaysToPay !== null && (
                  <span className="ml-auto flex items-center gap-1 text-gray-400">
                    <PiTrendUp className="h-3 w-3" />
                    Avg {kpis.avgDaysToPay}d to pay
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-1 border-b border-gray-100 px-4">
            {(['bills', 'aging', 'payments'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 pr-5 text-[12px] font-semibold transition-colors ${
                  tab === t
                    ? 'border-b-2 border-[#b20202] text-[#b20202]'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'bills'
                  ? `Bills (${bills.length})`
                  : t === 'aging'
                    ? 'Aging Analysis'
                    : 'Payment History'}
              </button>
            ))}
          </div>

          {/* ── Bills tab ──────────────────────────────────────── */}
          {tab === 'bills' && (
            <>
              {/* filters */}
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
                <div className="relative min-w-[180px]">
                  <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bills…"
                    className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-[12px] text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                  />
                </div>
                {/* status pills */}
                <div className="flex flex-wrap gap-1">
                  {STATUS_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setStatusFilter(t.key)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        statusFilter === t.key
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                      }`}
                    >
                      {t.label}
                      <span className="ml-1 opacity-50">
                        ({tabCount[t.key]})
                      </span>
                    </button>
                  ))}
                </div>
                {/* date range */}
                <div className="ml-auto flex items-center gap-1">
                  {DATE_RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setDateRange(r.key)}
                      className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                        dateRange === r.key
                          ? 'bg-[#b20202] text-white'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {(
                        [
                          { col: 'billNumber' as SortCol, label: 'Bill #' },
                          { col: 'billDate' as SortCol, label: 'Bill Date' },
                          { col: 'dueDate' as SortCol, label: 'Due Date' },
                          { col: 'status' as SortCol, label: 'Status' },
                          {
                            col: 'total' as SortCol,
                            label: 'Total',
                            right: true,
                          },
                          {
                            col: 'paid' as SortCol,
                            label: 'Paid',
                            right: true,
                          },
                          {
                            col: 'due' as SortCol,
                            label: 'Balance Due',
                            right: true,
                          },
                        ] as { col: SortCol; label: string; right?: boolean }[]
                      ).map(({ col, label, right }) => (
                        <th
                          key={col}
                          onClick={() => toggleSort(col)}
                          className={`group cursor-pointer whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 ${right ? 'text-right' : 'text-left'}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <SortIcon
                              col={col}
                              active={sortCol}
                              dir={sortDir}
                            />
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonRow key={i} />
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <PiReceipt className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                          <p className="text-sm font-medium text-gray-400">
                            No bills match your filters
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((b) => {
                        const over = isOverdue(b);
                        const due = dueAmount(b);
                        const pct =
                          b.totalAmount > 0
                            ? Math.min(
                                100,
                                Math.round((b.paidAmount / b.totalAmount) * 100)
                              )
                            : 0;
                        const statusKey = over ? 'overdue' : b.status;
                        const badgeCls =
                          STATUS_BADGE[statusKey] ??
                          'bg-gray-100 text-gray-600';
                        return (
                          <tr
                            key={b._id}
                            onClick={() =>
                              router.push(`/purchases/bills/${b._id}`)
                            }
                            className={`group cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50/70 ${over ? 'bg-[#b20202]/[0.02]' : ''}`}
                          >
                            <td className="px-4 py-3.5">
                              <span className="text-[12px] font-semibold text-[#b20202]">
                                {b.billNumber}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                                <PiCalendarBlank className="h-3 w-3 text-gray-400" />
                                {fmtDate(b.billDate)}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div
                                className={`text-[12px] ${over ? 'text-[#b20202]' : 'text-gray-600'}`}
                              >
                                {fmtDate(b.dueDate)}
                                {over && (
                                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-[#b20202]">
                                    <PiClock className="h-2.5 w-2.5" />
                                    {daysOverdue(b.dueDate)}d overdue
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}
                              >
                                {statusKey.charAt(0).toUpperCase() +
                                  statusKey.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-[12px] font-semibold text-gray-800">
                                {fmt(b.totalAmount, b.currency)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-[12px] font-semibold text-emerald-600">
                                {fmt(b.paidAmount, b.currency)}
                              </span>
                              {b.totalAmount > 0 && (
                                <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-emerald-400"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={`text-[12px] font-bold ${due > 0 ? (over ? 'text-[#b20202]' : 'text-amber-600') : 'text-gray-300'}`}
                              >
                                {due > 0 ? fmt(due, b.currency) : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Link
                                href={`/purchases/bills/${b._id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 opacity-0 transition hover:text-gray-600 group-hover:opacity-100"
                              >
                                <PiEye className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {!loading && filtered.length > 0 && (
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-3 text-[11px] font-semibold text-gray-500"
                        >
                          {filtered.length} of {bills.length} bills
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] font-bold text-gray-900">
                          {fmt(footerTotals.total)}
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] font-bold text-emerald-600">
                          {fmt(footerTotals.paid)}
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] font-bold text-[#b20202]">
                          {footerTotals.due > 0 ? fmt(footerTotals.due) : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}

          {/* ── Aging tab ──────────────────────────────────────── */}
          {tab === 'aging' && (
            <div className="p-5">
              {aging.every((b) => b.bills.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <PiCheckCircle className="mb-3 h-10 w-10 text-emerald-300" />
                  <p className="text-sm font-medium text-gray-500">
                    No outstanding bills
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    All invoiced bills have been settled
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[11px] text-gray-400">
                    Outstanding balance by age of overdue days
                  </p>

                  {/* stacked bar */}
                  {agingTotal > 0 && (
                    <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
                      {aging.map((bucket) => {
                        const amt = bucket.bills.reduce(
                          (s, b) => s + dueAmount(b),
                          0
                        );
                        const pct = Math.round((amt / agingTotal) * 100);
                        if (!pct) return null;
                        return (
                          <div
                            key={bucket.label}
                            title={`${bucket.label}: ${fmtShort(amt)}`}
                            className={`h-full ${bucket.color} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* bucket cards */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {aging.map((bucket) => {
                      const amt = bucket.bills.reduce(
                        (s, b) => s + dueAmount(b),
                        0
                      );
                      const pct =
                        agingTotal > 0
                          ? Math.round((amt / agingTotal) * 100)
                          : 0;
                      return (
                        <div
                          key={bucket.label}
                          className="rounded-lg border border-gray-200 bg-white p-4"
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${bucket.color}`}
                            />
                            <span className="text-[11px] font-semibold text-gray-600">
                              {bucket.label}
                            </span>
                          </div>
                          <div className="text-[18px] font-black text-gray-900">
                            {fmtShort(amt)}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {bucket.bills.length} bill
                            {bucket.bills.length !== 1 ? 's' : ''} · {pct}% of
                            outstanding
                          </div>
                          {bucket.bills.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              {bucket.bills.slice(0, 3).map((b) => (
                                <Link
                                  key={b._id}
                                  href={`/purchases/bills/${b._id}`}
                                  className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-[11px] hover:bg-gray-100"
                                >
                                  <span className="font-medium text-[#b20202]">
                                    {b.billNumber}
                                  </span>
                                  <span className="text-gray-500">
                                    {fmtShort(dueAmount(b))}
                                  </span>
                                </Link>
                              ))}
                              {bucket.bills.length > 3 && (
                                <p className="text-center text-[10px] text-gray-400">
                                  +{bucket.bills.length - 3} more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Payments tab ───────────────────────────────────── */}
          {tab === 'payments' && (
            <div className="p-5">
              <PaymentTimeline bills={bills} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
