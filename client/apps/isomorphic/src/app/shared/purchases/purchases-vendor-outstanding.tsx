'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiArrowClockwise,
  PiMagnifyingGlass,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiWarning,
  PiClock,
  PiMoney,
  PiX,
  PiCheckCircle,
  PiBuildings,
  PiCaretDown,
  PiCalendarBlank,
  PiArrowSquareOut,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorBill } from '@/services/vendorBill.service';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from '@/services/vendor.service';

// ─── Types ────────────────────────────────────────────────────────
type AgingBucket = 'current' | '1-30' | '31-60' | '60+';
type SortCol = 'billNumber' | 'billDate' | 'dueDate' | 'total' | 'due' | 'age';
type SortDir = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────────
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
function dueAmount(b: VendorBill) {
  return Math.max(0, b.totalAmount - b.paidAmount);
}
// positive = days past due; negative = not yet due; 0 = due today
function daysOverdue(dueDate?: string): number {
  if (!dueDate) return 0;
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000);
}
function isUnpaid(b: VendorBill) {
  return b.status !== 'paid' && b.status !== 'cancelled' && dueAmount(b) > 0;
}
function getAgingBucket(b: VendorBill): AgingBucket {
  const days = daysOverdue(b.dueDate);
  if (days <= 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  return '60+';
}

const AGING_CONFIG: Record<
  AgingBucket,
  {
    label: string;
    barColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  current: {
    label: 'Current',
    barColor: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
  },
  '1-30': {
    label: '1–30 days',
    barColor: 'bg-amber-400',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
  },
  '31-60': {
    label: '31–60 days',
    barColor: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  '60+': {
    label: '60+ days',
    barColor: 'bg-red-600',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
  },
};
const AGING_ORDER: AgingBucket[] = ['current', '1-30', '31-60', '60+'];

function rowAccentClass(b: VendorBill) {
  const bucket = getAgingBucket(b);
  if (bucket === '60+') return 'border-l-[3px] border-l-red-500';
  if (bucket === '31-60') return 'border-l-[3px] border-l-orange-400';
  if (bucket === '1-30') return 'border-l-[3px] border-l-amber-400';
  return 'border-l-[3px] border-l-emerald-400';
}

function AgeBadge({ bill }: { bill: VendorBill }) {
  const days = daysOverdue(bill.dueDate);
  const bucket = getAgingBucket(bill);
  const cfg = AGING_CONFIG[bucket];
  const label =
    days <= 0 ? (days === 0 ? 'Due today' : 'Current') : `${days}d overdue`;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.bgColor} ${cfg.textColor}`}
    >
      {label}
    </span>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────
function exportCSV(bills: VendorBill[], vendorName: string) {
  const header = [
    'Bill #',
    'Bill Date',
    'Due Date',
    'Total (NGN)',
    'Paid (NGN)',
    'Balance Due (NGN)',
    'Days Overdue',
    'Status',
  ];
  const rows = bills.map((b) => [
    b.billNumber,
    fmtDate(b.billDate),
    fmtDate(b.dueDate),
    b.totalAmount.toFixed(2),
    b.paidAmount.toFixed(2),
    dueAmount(b).toFixed(2),
    Math.max(0, daysOverdue(b.dueDate)).toString(),
    b.status,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${vendorName.replace(/\s+/g, '_')}_outstanding_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sort Icon ────────────────────────────────────────────────────
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
      <PiArrowsDownUp className="h-3 w-3 opacity-30 group-hover:opacity-60" />
    );
  return dir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}

// ─── Pay Modal ────────────────────────────────────────────────────
function PayModal({
  bill,
  onClose,
  onPaid,
}: {
  bill: VendorBill;
  onClose: () => void;
  onPaid: (b: VendorBill) => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const remaining = dueAmount(bill);
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedAmt = Math.min(parseFloat(amount) || 0, remaining);
  const pctAfter =
    bill.totalAmount > 0
      ? Math.min(100, ((bill.paidAmount + parsedAmt) / bill.totalAmount) * 100)
      : 0;
  const willFullyPay = parsedAmt >= remaining - 0.001;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amt > remaining) {
      toast.error(`Cannot exceed balance due ${fmt(remaining)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await vendorBillService.recordPayment(
        bill._id,
        { amount: amt, method, reference, date, notes },
        token
      );
      toast.success('Payment recorded');
      onPaid(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Dark header */}
        <div className="bg-gray-900 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Recording payment for
              </div>
              <h3 className="text-lg font-bold text-white">
                {bill.billNumber}
              </h3>
              <div className="mt-0.5 text-xs text-gray-400">
                {bill.vendorName}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <PiX className="h-5 w-5" />
            </button>
          </div>
          {/* Balance summary */}
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white/5 p-3">
            <div className="text-center">
              <div className="text-[10px] text-gray-500">Bill Total</div>
              <div className="mt-0.5 text-sm font-bold text-white">
                {fmtShort(bill.totalAmount)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">Paid</div>
              <div className="mt-0.5 text-sm font-bold text-emerald-400">
                {fmtShort(bill.paidAmount)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">Balance Due</div>
              <div className="mt-0.5 text-sm font-bold text-amber-400">
                {fmtShort(remaining)}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6">
          {/* Amount */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold text-gray-600">
                Payment Amount
              </label>
              <button
                type="button"
                onClick={() => setAmount(remaining.toFixed(2))}
                className="text-[11px] font-semibold text-[#b20202] hover:underline"
              >
                Pay in full ({fmtShort(remaining)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                ₦
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 py-3 pl-9 pr-3 text-sm font-bold transition-colors focus:border-[#b20202] focus:outline-none"
                required
              />
            </div>
            {/* Progress after payment */}
            <div className="mt-2.5">
              <div className="mb-1 flex justify-between text-[10px] text-gray-400">
                <span>Progress after this payment</span>
                <span className="font-semibold">{pctAfter.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${willFullyPay ? 'bg-emerald-500' : 'bg-[#b20202]'}`}
                  style={{ width: `${pctAfter}%` }}
                />
              </div>
              {willFullyPay && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <PiCheckCircle className="h-3.5 w-3.5" /> This will fully
                  clear the bill
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-600">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm transition-colors focus:border-[#b20202] focus:outline-none"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-600">
                Payment Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm transition-colors focus:border-[#b20202] focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-600">
              Reference{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TXN-12345, cheque no."
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm transition-colors focus:border-[#b20202] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-600">
              Notes{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes"
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm transition-colors focus:border-[#b20202] focus:outline-none"
            />
          </div>

          {/* Previous payments */}
          {bill.payments && bill.payments.length > 0 && (
            <div className="rounded-xl bg-gray-50 p-3.5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Previous Payments
              </div>
              <div className="space-y-1.5">
                {bill.payments.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-500">
                      {fmtDate(p.date)}
                      {p.method ? ` · ${p.method.replace(/_/g, ' ')}` : ''}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </span>
                    <span className="font-bold text-emerald-600">
                      +{fmtShort(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-gray-200 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#b20202] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Expandable Bill Row ──────────────────────────────────────────
function BillRow({
  bill,
  onPay,
}: {
  bill: VendorBill;
  onPay: (b: VendorBill) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const due = dueAmount(bill);
  const pct =
    bill.totalAmount > 0 ? (bill.paidAmount / bill.totalAmount) * 100 : 0;

  return (
    <>
      <tr
        className={`group cursor-pointer transition-colors hover:bg-gray-50/60 ${rowAccentClass(bill)}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3.5">
          <Link
            href={`/purchases/bills/${bill._id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs font-bold text-[#b20202] hover:underline"
          >
            {bill.billNumber}
          </Link>
        </td>
        <td className="px-4 py-3.5 text-xs text-gray-500">
          {fmtDate(bill.billDate)}
        </td>
        <td className="px-4 py-3.5 text-xs text-gray-500">
          {fmtDate(bill.dueDate)}
        </td>
        <td className="px-4 py-3.5 text-xs text-gray-700">
          {fmt(bill.totalAmount, bill.currency)}
        </td>
        <td className="px-4 py-3.5">
          <div className="text-xs font-bold text-gray-900">
            {fmt(due, bill.currency)}
          </div>
          {pct > 0 && (
            <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </td>
        <td className="px-4 py-3.5">
          <AgeBadge bill={bill} />
        </td>
        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onPay(bill)}
            className="flex items-center gap-1 rounded-lg bg-[#b20202] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#9a0101]"
          >
            <PiMoney className="h-3.5 w-3.5" /> Pay
          </button>
        </td>
        <td className="w-8 px-2 py-3.5">
          <PiCaretDown
            className={`h-3.5 w-3.5 text-gray-300 transition-transform group-hover:text-gray-400 ${expanded ? 'rotate-180' : ''}`}
          />
        </td>
      </tr>

      {/* Expanded detail panel */}
      {expanded && (
        <tr>
          <td
            colSpan={8}
            className="border-b border-gray-100 bg-gray-50/70 px-5 py-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Payment history */}
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Payment History
                </div>
                {bill.payments && bill.payments.length > 0 ? (
                  <div className="space-y-1.5">
                    {bill.payments.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2"
                      >
                        <div>
                          <div className="text-xs font-semibold text-gray-700">
                            {fmtDate(p.date)}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {p.method?.replace(/_/g, ' ') ?? 'Payment'}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">
                          +{fmt(p.amount, bill.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs italic text-gray-400">
                    No payments recorded yet.
                  </div>
                )}
              </div>

              {/* Bill breakdown */}
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Bill Breakdown
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
                  <div className="divide-y divide-gray-50 px-4 py-1">
                    <div className="flex justify-between py-2 text-xs">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium text-gray-700">
                        {fmt(bill.subtotal, bill.currency)}
                      </span>
                    </div>
                    {bill.taxAmount > 0 && (
                      <div className="flex justify-between py-2 text-xs">
                        <span className="text-gray-500">Tax</span>
                        <span className="font-medium text-gray-700">
                          {fmt(bill.taxAmount, bill.currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 text-xs">
                      <span className="font-semibold text-gray-700">Total</span>
                      <span className="font-bold text-gray-900">
                        {fmt(bill.totalAmount, bill.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 text-xs">
                      <span className="text-gray-500">Paid</span>
                      <span className="font-semibold text-emerald-600">
                        {fmt(bill.paidAmount, bill.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 text-xs">
                      <span className="font-bold text-gray-800">
                        Balance Due
                      </span>
                      <span className="font-black text-[#b20202]">
                        {fmt(due, bill.currency)}
                      </span>
                    </div>
                  </div>
                  {pct > 0 && (
                    <div className="border-t border-gray-50 px-4 py-2.5">
                      <div className="mb-1 flex justify-between text-[10px] text-gray-400">
                        <span>Paid so far</span>
                        <span className="font-semibold">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {bill.notes && (
                  <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <span className="font-bold">Note: </span>
                    {bill.notes}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-44 animate-pulse rounded-2xl bg-gray-200" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      <div className="h-80 animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function PurchasesVendorOutstanding({
  vendorId,
}: {
  vendorId: string;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('age');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [agingFilter, setAgingFilter] = useState<AgingBucket | 'all'>('all');
  const [payBill, setPayBill] = useState<VendorBill | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [vendorRes, billsRes] = await Promise.all([
        vendorService.getById(vendorId, token),
        vendorBillService.getVendorBills(token, {
          vendor: vendorId,
          limit: 200,
        }),
      ]);
      setVendor(vendorRes);
      setBills(billsRes.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [vendorId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const unpaidBills = useMemo(() => bills.filter(isUnpaid), [bills]);

  // ── KPI stats ──────────────────────────────────────────────────
  const totalOutstanding = useMemo(
    () => unpaidBills.reduce((s, b) => s + dueAmount(b), 0),
    [unpaidBills]
  );
  const overdueAmt = useMemo(
    () =>
      unpaidBills
        .filter((b) => getAgingBucket(b) !== 'current')
        .reduce((s, b) => s + dueAmount(b), 0),
    [unpaidBills]
  );
  const oldestOverdueDays = useMemo(
    () =>
      unpaidBills.length
        ? Math.max(0, ...unpaidBills.map((b) => daysOverdue(b.dueDate)))
        : 0,
    [unpaidBills]
  );
  const nextDueBill = useMemo(() => {
    const upcoming = unpaidBills.filter(
      (b) => b.dueDate && daysOverdue(b.dueDate) <= 0
    );
    if (!upcoming.length) return null;
    return upcoming.sort(
      (a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
    )[0];
  }, [unpaidBills]);

  // ── Aging buckets ──────────────────────────────────────────────
  const agingData = useMemo(
    () =>
      AGING_ORDER.map((key) => {
        const items = unpaidBills.filter((b) => getAgingBucket(b) === key);
        return {
          key,
          ...AGING_CONFIG[key],
          bills: items,
          total: items.reduce((s, b) => s + dueAmount(b), 0),
        };
      }),
    [unpaidBills]
  );

  // ── Filtered + sorted list ─────────────────────────────────────
  const displayed = useMemo(() => {
    let list = unpaidBills;
    if (agingFilter !== 'all')
      list = list.filter((b) => getAgingBucket(b) === agingFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(q) ||
          b.vendorName.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let va: number | string = 0,
        vb: number | string = 0;
      switch (sortCol) {
        case 'billNumber':
          va = a.billNumber;
          vb = b.billNumber;
          break;
        case 'billDate':
          va = a.billDate ?? '';
          vb = b.billDate ?? '';
          break;
        case 'dueDate':
          va = a.dueDate ?? '';
          vb = b.dueDate ?? '';
          break;
        case 'total':
          va = a.totalAmount;
          vb = b.totalAmount;
          break;
        case 'due':
          va = dueAmount(a);
          vb = dueAmount(b);
          break;
        case 'age':
          va = daysOverdue(a.dueDate);
          vb = daysOverdue(b.dueDate);
          break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [unpaidBills, agingFilter, search, sortCol, sortDir]);

  const displayedTotal = useMemo(
    () => displayed.reduce((s, b) => s + b.totalAmount, 0),
    [displayed]
  );
  const displayedDue = useMemo(
    () => displayed.reduce((s, b) => s + dueAmount(b), 0),
    [displayed]
  );

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function handlePaid(updated: VendorBill) {
    setBills((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
    setPayBill(null);
  }

  if (loading) return <LoadingSkeleton />;

  const overdueRatio = totalOutstanding > 0 ? overdueAmt / totalOutstanding : 0;

  return (
    <div className="space-y-5">
      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gray-900 px-6 py-6 text-white shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          {/* Breadcrumb + vendor */}
          <div>
            <Link
              href={`/purchases/vendors/${vendorId}`}
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-200"
            >
              <PiArrowLeft className="h-3.5 w-3.5" />
              {vendor?.name ?? 'Vendor'}
            </Link>
            <div className="flex items-center gap-3">
              {vendor?.photo ? (
                <img
                  src={vendor.photo}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-white/20"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10">
                  <PiBuildings className="h-5 w-5 text-gray-300" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-black text-white">
                  {vendor?.name ?? '…'}
                </h1>
                <div className="mt-0.5 text-xs text-gray-400">
                  Outstanding Payables
                </div>
              </div>
            </div>
          </div>

          {/* Total callout */}
          <div className="text-right">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Total Outstanding
            </div>
            <div className="text-4xl font-black tabular-nums text-white">
              {fmtShort(totalOutstanding)}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {unpaidBills.length} unpaid bill
              {unpaidBills.length !== 1 ? 's' : ''}
            </div>
            {overdueAmt > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-600/25 px-3 py-1 text-xs font-bold text-red-400">
                <PiWarning className="h-3.5 w-3.5" />
                {fmtShort(overdueAmt)} overdue
              </div>
            )}
          </div>
        </div>

        {/* Aging split bar */}
        {totalOutstanding > 0 && (
          <div className="relative mt-6">
            <div className="mb-1.5 flex justify-between text-[10px] text-gray-500">
              <span>Current — {((1 - overdueRatio) * 100).toFixed(0)}%</span>
              <span>Overdue — {(overdueRatio * 100).toFixed(0)}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
              {agingData
                .filter((d) => d.total > 0)
                .map((d) => (
                  <div
                    key={d.key}
                    className={`${d.barColor} opacity-80 first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${(d.total / totalOutstanding) * 100}%` }}
                    title={`${d.label}: ${fmtShort(d.total)}`}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Outstanding',
            value: fmtShort(totalOutstanding),
            sub: `${unpaidBills.length} bill${unpaidBills.length !== 1 ? 's' : ''}`,
            accentCls: 'bg-red-100 text-[#b20202]',
            icon: <PiMoney className="h-5 w-5" />,
          },
          {
            label: 'Overdue Amount',
            value: fmtShort(overdueAmt),
            sub: overdueAmt > 0 ? 'Past due date' : 'None overdue ✓',
            accentCls:
              overdueAmt > 0
                ? 'bg-orange-100 text-orange-600'
                : 'bg-emerald-100 text-emerald-600',
            icon: <PiWarning className="h-5 w-5" />,
          },
          {
            label: 'Oldest Overdue',
            value: oldestOverdueDays > 0 ? `${oldestOverdueDays}d` : '—',
            sub: oldestOverdueDays > 0 ? 'days past due' : 'No overdue bills',
            accentCls:
              oldestOverdueDays > 60
                ? 'bg-red-100 text-[#b20202]'
                : oldestOverdueDays > 0
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 text-gray-500',
            icon: <PiClock className="h-5 w-5" />,
          },
          {
            label: 'Next Due',
            value: nextDueBill ? fmtDate(nextDueBill.dueDate) : '—',
            sub: nextDueBill ? nextDueBill.billNumber : 'No upcoming bills',
            accentCls: 'bg-blue-100 text-blue-600',
            icon: <PiCalendarBlank className="h-5 w-5" />,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div
              className={`mb-3 inline-flex rounded-lg p-2 ${card.accentCls}`}
            >
              {card.icon}
            </div>
            <div className="text-2xl font-black tabular-nums text-gray-900">
              {card.value}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-gray-500">
              {card.label}
            </div>
            <div className="mt-0.5 text-[10px] text-gray-400">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Aging Analysis ── */}
      {unpaidBills.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Aging Analysis</h2>
            {agingFilter !== 'all' && (
              <button
                onClick={() => setAgingFilter('all')}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3 w-3" /> Clear filter
              </button>
            )}
          </div>

          {/* Stacked bar */}
          <div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
            {agingData
              .filter((d) => d.total > 0)
              .map((d) => (
                <div
                  key={d.key}
                  className={`${d.barColor} transition-all first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${(d.total / totalOutstanding) * 100}%` }}
                  title={`${d.label}: ${fmt(d.total)}`}
                />
              ))}
          </div>

          {/* Bucket cards — clickable filters */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {agingData.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() =>
                  setAgingFilter(agingFilter === d.key ? 'all' : d.key)
                }
                className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                  agingFilter === d.key
                    ? `${d.borderColor} ${d.bgColor} shadow-sm`
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                }`}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${d.barColor}`} />
                  <span className="text-[11px] font-semibold text-gray-500">
                    {d.label}
                  </span>
                </div>
                <div
                  className={`text-lg font-black tabular-nums ${agingFilter === d.key ? d.textColor : 'text-gray-800'}`}
                >
                  {fmtShort(d.total)}
                </div>
                <div className="mt-0.5 text-[10px] text-gray-400">
                  {d.bills.length} bill{d.bills.length !== 1 ? 's' : ''}
                </div>
                {totalOutstanding > 0 && d.total > 0 && (
                  <div className="mt-1 text-[10px] text-gray-400">
                    {((d.total / totalOutstanding) * 100).toFixed(0)}% of total
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bills Table ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-800">Unpaid Bills</h2>
            {agingFilter !== 'all' && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${AGING_CONFIG[agingFilter].bgColor} ${AGING_CONFIG[agingFilter].textColor}`}
              >
                {AGING_CONFIG[agingFilter].label}
                <button onClick={() => setAgingFilter('all')}>
                  <PiX className="h-3 w-3" />
                </button>
              </span>
            )}
            {displayed.length > 0 && (
              <span className="text-[11px] text-gray-400">
                {displayed.length} result{displayed.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bills…"
                className="w-44 rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs transition-colors focus:border-[#b20202] focus:outline-none"
              />
            </div>
            <button
              onClick={() => exportCSV(displayed, vendor?.name ?? 'vendor')}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              title="Export visible bills to CSV"
            >
              <PiArrowSquareOut className="h-3.5 w-3.5" /> Export
            </button>
            <button
              onClick={load}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50"
              title="Refresh"
            >
              <PiArrowClockwise className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <PiCheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-gray-700">
              {unpaidBills.length === 0
                ? 'All clear — no outstanding bills'
                : 'No bills match your filter'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {unpaidBills.length === 0
                ? `${vendor?.name ?? 'This vendor'} has no unpaid bills`
                : 'Try adjusting your search or aging filter'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  {[
                    { col: 'billNumber' as SortCol, label: 'Bill #' },
                    { col: 'billDate' as SortCol, label: 'Bill Date' },
                    { col: 'dueDate' as SortCol, label: 'Due Date' },
                    { col: 'total' as SortCol, label: 'Total' },
                    { col: 'due' as SortCol, label: 'Balance Due' },
                    { col: 'age' as SortCol, label: 'Aging' },
                  ].map(({ col, label }) => (
                    <th
                      key={col}
                      className="group cursor-pointer px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400"
                      onClick={() => toggleSort(col)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon col={col} active={sortCol} dir={sortDir} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    Action
                  </th>
                  <th className="w-8 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((bill) => (
                  <BillRow key={bill._id} bill={bill} onPay={setPayBill} />
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-xs font-bold text-gray-500"
                  >
                    {displayed.length} bill{displayed.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-700">
                    {fmt(displayedTotal, 'NGN')}
                  </td>
                  <td className="px-4 py-3 text-xs font-black text-[#b20202]">
                    {fmt(displayedDue, 'NGN')}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {payBill && (
        <PayModal
          bill={payBill}
          onClose={() => setPayBill(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
