'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiArrowClockwise,
  PiEye,
  PiTrash,
  PiReceipt,
  PiCurrencyDollar,
  PiWarning,
  PiCheckCircle,
  PiList,
  PiSquaresFour,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiCaretRight,
  PiX,
  PiCheck,
  PiClock,
  PiMoney,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorBill } from './types';
import { STATUS_BADGE, statusLabel } from './types';

// ─── types ────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'draft' | 'posted' | 'paid' | 'overdue';
type ViewMode = 'list' | 'grid';
type SortCol =
  | 'billNumber'
  | 'vendor'
  | 'status'
  | 'total'
  | 'amountDue'
  | 'dueDate'
  | 'billDate';
type SortDir = 'asc' | 'desc';

// ─── constants ────────────────────────────────────────────────────
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'posted', label: 'Posted' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

// ─── helpers ─────────────────────────────────────────────────────
function isOverdueFn(b: VendorBill): boolean {
  return (
    b.status !== 'paid' &&
    b.status !== 'cancelled' &&
    !!b.dueDate &&
    new Date(b.dueDate) < new Date()
  );
}
function daysOverdue(dueDate?: string): number {
  if (!dueDate) return 0;
  return Math.floor(
    (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}
function fmtCurrency(n: number, cur = 'NGN') {
  if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${cur} ${(n / 1_000).toFixed(0)}k`;
  return `${cur} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
// Robust helpers — normalise field-name variants returned by the API
function billTotal(b: VendorBill): number {
  const t =
    (b as any).totalAmount ??
    b.total ??
    ((b as any).subtotal ?? b.subtotal ?? 0) +
      ((b as any).taxAmount ?? b.taxTotal ?? 0);
  if (t > 0) return t;
  return (b.items ?? []).reduce(
    (s, i) => s + ((i as any).amount ?? i.total ?? 0),
    0
  );
}
function billAmountPaid(b: VendorBill): number {
  return (b as any).paidAmount ?? b.amountPaid ?? 0;
}
function billAmountDue(b: VendorBill): number {
  const due = b.amountDue ?? (b as any).amountDue;
  if (due !== undefined) return due;
  return Math.max(0, billTotal(b) - billAmountPaid(b));
}
function billSubtotal(b: VendorBill): number {
  return (b as any).subtotal ?? b.subtotal ?? 0;
}
function billTax(b: VendorBill): number {
  return (b as any).taxAmount ?? (b as any).taxTotal ?? b.taxTotal ?? 0;
}
function paidPct(b: VendorBill): number {
  const total = billTotal(b);
  if (!total) return 0;
  return Math.min(100, Math.round((billAmountPaid(b) / total) * 100));
}

// ─── skeletons ────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[55, 75, 45, 50, 50, 45, 45, 28].map((w, i) => (
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
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex justify-between">
        <div className="h-4 w-24 rounded bg-gray-100" />
        <div className="h-5 w-14 rounded-full bg-gray-100" />
      </div>
      <div className="mb-2 h-3.5 w-32 rounded bg-gray-100" />
      <div className="mb-4 h-2 w-full rounded-full bg-gray-100" />
      <div className="flex justify-between border-t border-gray-100 pt-3">
        <div className="h-4 w-16 rounded bg-gray-100" />
        <div className="h-4 w-16 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ─── sort icon ────────────────────────────────────────────────────
function SortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: SortCol;
  sortCol: SortCol;
  sortDir: SortDir;
}) {
  if (col !== sortCol)
    return (
      <PiArrowsDownUp className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
    );
  return sortDir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}

// ─── record payment modal ─────────────────────────────────────────
function PayModal({
  bill,
  token,
  onClose,
  onSuccess,
}: {
  bill: VendorBill;
  token: string;
  onClose: () => void;
  onSuccess: (updated: VendorBill) => void;
}) {
  const [amount, setAmount] = useState(
    String((bill.amountDue ?? 0).toFixed(2))
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (amt > (bill.amountDue ?? 0) + 0.01) {
      toast.error('Amount exceeds balance due');
      return;
    }
    setSaving(true);
    try {
      const res = await vendorBillService.recordPayment(
        bill._id,
        { amount: amt, date, method, reference: reference || undefined },
        token
      );
      toast.success('Payment recorded');
      onSuccess(res.data as unknown as VendorBill);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div
          className="relative overflow-hidden px-5 pb-4 pt-5"
          style={{
            background:
              'linear-gradient(135deg,#0f0f0f 0%,#1a0606 60%,#0f0f0f 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'radial-gradient(circle,white 1px,transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#b20202]">
                Record Payment
              </p>
              <p className="mt-0.5 text-lg font-black text-white">
                {bill.billNumber}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {bill.vendorName} ·{' '}
                <span className="text-white/80">
                  {bill.currency}{' '}
                  {(bill.amountDue ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{' '}
                  remaining
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 hover:text-gray-300"
            >
              <PiX className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  {bill.currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-12 pr-3 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15"
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#b20202] focus:outline-none"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Reference
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction ID, cheque no…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15"
            />
          </div>

          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#b20202] py-2.5 text-sm font-bold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              {saving ? (
                <PiArrowClockwise className="h-4 w-4 animate-spin" />
              ) : (
                <PiMoney className="h-4 w-4" />
              )}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── bill card (grid) ─────────────────────────────────────────────
function BillCard({
  bill,
  onPay,
  onDelete,
  confirmDeleteId,
  setConfirmDeleteId,
  deleting,
}: {
  bill: VendorBill;
  onPay: (b: VendorBill) => void;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  deleting: string | null;
}) {
  const router = useRouter();
  const overdue = isOverdueFn(bill);
  const days = overdue ? daysOverdue(bill.dueDate) : 0;
  const pct = paidPct(bill);
  const canDelete = bill.status === 'draft';
  const canPay =
    bill.status !== 'paid' &&
    bill.status !== 'cancelled' &&
    bill.status !== 'draft';
  const isConfirming = confirmDeleteId === bill._id;

  return (
    <div
      onClick={() =>
        !isConfirming &&
        router.push(routes.eCommerce.vendorBillDetails(bill._id))
      }
      className={`group cursor-pointer rounded-xl border bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md ${
        overdue ? 'border-red-200' : 'border-gray-200'
      } ${deleting === bill._id ? 'opacity-40' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-gray-900 group-hover:text-[#b20202]">
            {bill.billNumber}
          </p>
          {overdue && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
              <PiClock className="h-3 w-3" /> {days}d overdue
            </span>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            STATUS_BADGE[bill.status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {statusLabel(bill.status)}
        </span>
      </div>

      <p className="mb-2 truncate text-sm font-medium text-gray-700">
        {bill.vendorName ?? <span className="text-gray-400">No vendor</span>}
      </p>

      <div className="mb-3 flex flex-wrap gap-x-3 text-[11px] text-gray-400">
        {bill.billDate && <span>Billed {fmtDate(bill.billDate)}</span>}
        {bill.dueDate && (
          <span className={overdue ? 'font-semibold text-red-500' : ''}>
            Due {fmtDate(bill.dueDate)}
          </span>
        )}
      </div>

      {bill.status !== 'draft' && (
        <div className="mb-3">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {bill.currency}{' '}
              {billAmountPaid(bill).toLocaleString(undefined, {
                minimumFractionDigits: 0,
              })}{' '}
              of{' '}
              {billTotal(bill).toLocaleString(undefined, {
                minimumFractionDigits: 0,
              })}{' '}
              paid
            </span>
            <span
              className={`text-[10px] font-bold ${pct === 100 ? 'text-emerald-600' : 'text-gray-600'}`}
            >
              {pct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#10b981' : '#b20202',
              }}
            />
          </div>
        </div>
      )}

      <div
        className="flex items-center justify-between border-t border-gray-100 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[10px] text-gray-400">Total</p>
          <p className="text-sm font-bold text-gray-900">
            {bill.currency}{' '}
            {billTotal(bill).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          {billTax(bill) > 0 && (
            <p className="text-[10px] text-gray-400">
              incl. {bill.currency}{' '}
              {billTax(bill).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              tax
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isConfirming ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
              <PiWarning className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <span className="text-xs font-semibold text-red-600">
                Delete?
              </span>
              <button
                type="button"
                onClick={() => onDelete(bill._id)}
                className="flex h-5 w-5 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600"
              >
                <PiCheck className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex h-5 w-5 items-center justify-center rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
              >
                <PiX className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              {canPay && (
                <button
                  type="button"
                  onClick={() => onPay(bill)}
                  title="Record payment"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                >
                  <PiMoney className="h-4 w-4" />
                </button>
              )}
              <Link
                href={routes.eCommerce.vendorBillDetails(bill._id)}
                title="View"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <PiEye className="h-4 w-4" />
              </Link>
              {canDelete && (
                <button
                  type="button"
                  title="Delete"
                  onClick={() => setConfirmDeleteId(bill._id)}
                  disabled={deleting === bill._id}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <PiTrash className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── empty state ──────────────────────────────────────────────────
function EmptyState({
  filter,
  inline,
}: {
  filter: StatusFilter;
  inline?: boolean;
}) {
  const msgs: Record<StatusFilter, string> = {
    all: 'No vendor bills yet',
    draft: 'No draft bills',
    posted: 'No posted bills',
    paid: 'No paid bills',
    overdue: 'No overdue bills — all on track!',
  };
  return (
    <div
      className={`flex flex-col items-center gap-3 ${inline ? '' : 'rounded-xl border border-gray-200 bg-white'} py-16 text-center`}
    >
      <PiReceipt className="h-10 w-10 text-gray-200" />
      <p className="text-sm font-medium text-gray-500">{msgs[filter]}</p>
      {filter === 'all' && (
        <Link
          href={routes.eCommerce.createVendorBill}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-bold text-white hover:bg-[#9a0101]"
        >
          <PiPlus className="h-4 w-4" /> Create Bill
        </Link>
      )}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────
export default function PurchasesBills() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorParam = searchParams.get('vendor') ?? undefined;
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [sortCol, setSortCol] = useState<SortCol>('billDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [payBill, setPayBill] = useState<VendorBill | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorBillService.getVendorBills(token, {
        vendor: vendorParam,
      });
      setBills(res.data ?? (res as any).bills ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [token, vendorParam]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await vendorBillService.deleteVendorBill(id, token);
      toast.success('Bill deleted');
      setBills((prev) => prev.filter((b) => b._id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  function handlePaySuccess(updated: VendorBill) {
    setBills((prev) =>
      prev.map((b) => (b._id === updated._id ? { ...b, ...updated } : b))
    );
  }

  // ── derived ──────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);

  const tabCounts = useMemo(
    () => ({
      all: bills.length,
      draft: bills.filter((b) => b.status === 'draft').length,
      posted: bills.filter((b) => b.status === 'posted').length,
      paid: bills.filter((b) => b.status === 'paid').length,
      overdue: bills.filter(isOverdueFn).length,
    }),
    [bills]
  );

  const totalOwed = useMemo(
    () => bills.reduce((s, b) => s + billAmountDue(b), 0),
    [bills]
  );

  const paidThisMonth = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();
    return bills
      .filter((b) => {
        if (b.status !== 'paid' || !b.billDate) return false;
        const d = new Date(b.billDate);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((s, b) => s + billTotal(b), 0);
  }, [bills, now]);

  const currency = bills[0]?.currency ?? 'NGN';

  const tabFiltered = useMemo(() => {
    if (statusFilter === 'draft')
      return bills.filter((b) => b.status === 'draft');
    if (statusFilter === 'posted')
      return bills.filter((b) => b.status === 'posted');
    if (statusFilter === 'paid')
      return bills.filter((b) => b.status === 'paid');
    if (statusFilter === 'overdue') return bills.filter(isOverdueFn);
    return bills;
  }, [bills, statusFilter]);

  const filtered = useMemo(() => {
    let list = tabFiltered;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.billNumber?.toLowerCase().includes(q) ||
          b.vendorName?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let va: number | string = 0,
        vb: number | string = 0;
      if (sortCol === 'billNumber') {
        va = a.billNumber ?? '';
        vb = b.billNumber ?? '';
      } else if (sortCol === 'vendor') {
        va = a.vendorName ?? '';
        vb = b.vendorName ?? '';
      } else if (sortCol === 'status') {
        va = a.status;
        vb = b.status;
      } else if (sortCol === 'total') {
        va = a.total ?? 0;
        vb = b.total ?? 0;
      } else if (sortCol === 'amountDue') {
        va = a.amountDue ?? 0;
        vb = b.amountDue ?? 0;
      } else if (sortCol === 'dueDate') {
        va = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        vb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      } else {
        va = a.billDate ? new Date(a.billDate).getTime() : 0;
        vb = b.billDate ? new Date(b.billDate).getTime() : 0;
      }
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tabFiltered, search, sortCol, sortDir]);

  const Th = ({
    col,
    label,
    right,
  }: {
    col: SortCol;
    label: string;
    right?: boolean;
  }) => (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-500 ${right ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-gray-800 ${sortCol === col ? 'text-gray-800' : ''}`}
      >
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </button>
    </th>
  );

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {vendorParam && (
            <div className="mb-1 flex items-center gap-1 text-xs text-gray-400">
              <Link
                href="/purchases/bills"
                className="text-[#b20202] hover:underline"
              >
                All Bills
              </Link>
              <PiCaretRight className="h-3 w-3" />
              <span>Filtered by vendor</span>
              <Link
                href="/purchases/bills"
                className="ml-1 flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-500 hover:bg-gray-200"
              >
                <PiX className="h-3 w-3" /> clear
              </Link>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">Vendor Bills</h1>
          <p className="text-sm text-gray-500">
            {vendorParam
              ? 'Showing bills for this vendor'
              : 'Track and manage vendor invoices'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={load}
            title="Refresh"
            className={`rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 ${loading ? 'animate-spin' : ''}`}
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={
              vendorParam
                ? `${routes.eCommerce.createVendorBill}?vendor=${vendorParam}`
                : routes.eCommerce.createVendorBill
            }
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Bill
          </Link>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            icon: <PiReceipt className="h-4 w-4" />,
            iconCls: 'text-gray-600 bg-gray-100',
            label: 'Total Bills',
            value: bills.length,
            fmt: (v: number) => String(v),
          },
          {
            icon: <PiWarning className="h-4 w-4" />,
            iconCls: 'text-red-600 bg-red-50',
            label: 'Overdue',
            value: tabCounts.overdue,
            fmt: (v: number) => String(v),
          },
          {
            icon: <PiCurrencyDollar className="h-4 w-4" />,
            iconCls: 'text-amber-600 bg-amber-50',
            label: 'Total Owed',
            value: totalOwed,
            fmt: (v: number) => fmtCurrency(v, currency),
          },
          {
            icon: <PiCheckCircle className="h-4 w-4" />,
            iconCls: 'text-emerald-600 bg-emerald-50',
            label: 'Paid This Month',
            value: paidThisMonth,
            fmt: (v: number) => fmtCurrency(v, currency),
          },
        ].map(({ icon, iconCls, label, value, fmt }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div
              className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg ${iconCls}`}
            >
              {icon}
            </div>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-0.5 text-2xl font-black text-gray-900">
              {loading ? (
                <span className="inline-block h-7 w-16 animate-pulse rounded bg-gray-100" />
              ) : (
                fmt(value)
              )}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {!loading && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                    statusFilter === tab.key
                      ? 'bg-[#b20202]/10 text-[#b20202]'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill# or vendor…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <PiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!loading && (
          <p className="shrink-0 text-sm text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
        <div className="ml-auto flex gap-0.5 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(
            [
              ['list', <PiList className="h-4 w-4" key="l" />, 'List'],
              ['grid', <PiSquaresFour className="h-4 w-4" key="g" />, 'Grid'],
            ] as const
          ).map(([v, icon, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-all ${view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid view ───────────────────────────────────────────── */}
      {view === 'grid' &&
        (loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={statusFilter} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((bill) => (
              <BillCard
                key={bill._id}
                bill={bill}
                onPay={setPayBill}
                onDelete={handleDelete}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
                deleting={deletingId}
              />
            ))}
          </div>
        ))}

      {/* ── List view ───────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <Th col="billNumber" label="Bill #" />
                <Th col="vendor" label="Vendor" />
                <Th col="status" label="Status" />
                <Th col="billDate" label="Bill Date" />
                <Th col="dueDate" label="Due Date" />
                <Th col="total" label="Total" right />
                <Th col="amountDue" label="Balance Due" right />
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4">
                    <EmptyState filter={statusFilter} inline />
                  </td>
                </tr>
              ) : (
                filtered.map((bill) => {
                  const overdue = isOverdueFn(bill);
                  const days = overdue ? daysOverdue(bill.dueDate) : 0;
                  const pct = paidPct(bill);
                  const canDelete = bill.status === 'draft';
                  const canPay =
                    bill.status !== 'paid' &&
                    bill.status !== 'cancelled' &&
                    bill.status !== 'draft';
                  const isConfirming = confirmDeleteId === bill._id;
                  const isDeleting = deletingId === bill._id;

                  return (
                    <tr
                      key={bill._id}
                      onClick={() =>
                        !isConfirming &&
                        router.push(
                          routes.eCommerce.vendorBillDetails(bill._id)
                        )
                      }
                      className={`cursor-pointer transition-colors hover:bg-gray-50/80 ${isDeleting ? 'opacity-40' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-gray-900">
                          {bill.billNumber}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-gray-700">
                        {bill.vendorName ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_BADGE[bill.status] ??
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {statusLabel(bill.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-sm text-gray-500">
                        {fmtDate(bill.billDate)}
                      </td>

                      <td className="px-4 py-3.5">
                        {bill.dueDate ? (
                          <div>
                            <p
                              className={`text-sm ${overdue ? 'font-semibold text-red-600' : 'text-gray-500'}`}
                            >
                              {fmtDate(bill.dueDate)}
                            </p>
                            {overdue && (
                              <p className="flex items-center gap-0.5 text-[10px] text-red-500">
                                <PiClock className="h-3 w-3" /> {days}d overdue
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-semibold text-gray-900">
                          {bill.currency}{' '}
                          {billTotal(bill).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        {billTax(bill) > 0 && (
                          <p className="text-[10px] text-gray-400">
                            {bill.currency}{' '}
                            {billSubtotal(bill).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            +{' '}
                            {billTax(bill).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            tax
                          </p>
                        )}
                      </td>

                      {/* Balance Due */}
                      <td className="px-4 py-3.5 text-right">
                        {bill.status === 'paid' || billAmountDue(bill) <= 0 ? (
                          <span className="flex items-center justify-end gap-1 text-xs font-semibold text-emerald-600">
                            <PiCheckCircle className="h-3.5 w-3.5" /> Paid
                          </span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-semibold text-red-600">
                              {bill.currency}{' '}
                              {billAmountDue(bill).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            {bill.status !== 'draft' && (
                              <>
                                <div className="h-1 w-16 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-[#b20202]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {pct}% paid
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </td>

                      <td
                        className="px-4 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                              <PiWarning className="h-3.5 w-3.5 shrink-0 text-red-500" />
                              <span className="text-xs font-semibold text-red-600">
                                Delete?
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDelete(bill._id)}
                                className="flex h-5 w-5 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600"
                              >
                                <PiCheck className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex h-5 w-5 items-center justify-center rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                              >
                                <PiX className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              {canPay && (
                                <button
                                  type="button"
                                  onClick={() => setPayBill(bill)}
                                  title="Record payment"
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                                >
                                  <PiMoney className="h-4 w-4" />
                                </button>
                              )}
                              <Link
                                href={routes.eCommerce.vendorBillDetails(
                                  bill._id
                                )}
                                title="View"
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              >
                                <PiEye className="h-4 w-4" />
                              </Link>
                              {canDelete && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => setConfirmDeleteId(bill._id)}
                                  disabled={isDeleting}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                >
                                  <PiTrash className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
              <p className="text-xs text-gray-500">
                {filtered.length} bill{filtered.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500">
                  Total:{' '}
                  <strong className="text-gray-800">
                    {currency}{' '}
                    {filtered
                      .reduce((s, b) => s + billTotal(b), 0)
                      .toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </strong>
                </span>
                <span className="font-semibold text-red-600">
                  Due: {currency}{' '}
                  {filtered
                    .reduce((s, b) => s + billAmountDue(b), 0)
                    .toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pay modal ───────────────────────────────────────────── */}
      {payBill && (
        <PayModal
          bill={payBill}
          token={token}
          onClose={() => setPayBill(null)}
          onSuccess={handlePaySuccess}
        />
      )}
    </div>
  );
}
