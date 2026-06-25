'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiArrowLeft,
  PiSpinnerGap,
  PiStar,
  PiArrowCircleUp,
  PiArrowCircleDown,
  PiClock,
  PiPlus,
  PiSlidersHorizontal,
  PiReceipt,
  PiWarningCircle,
  PiStorefront,
  PiCaretLeft,
  PiCaretRight,
  PiX,
} from 'react-icons/pi';
import {
  contactService,
  type Contact,
  type LoyaltyStats,
  type LoyaltyTransaction,
  type LoyaltyTxType,
  type ContactOrdersPagination,
} from '@/services/contact.service';
import { routes } from '@/config/routes';
import { fraunces } from './contacts-fonts';
import { Avatar, fullName, SourceBadge } from './contact-form';

const pts = (n: number) => `${Math.round(n).toLocaleString('en-NG')} pts`;

const PAGE_SIZE = 20;

// Ledger types an admin can filter the table by.
const TYPE_OPTIONS: LoyaltyTxType[] = [
  'earn',
  'redeem',
  'adjustment',
  'bonus',
  'expiry',
];

const TYPE_CLS: Record<string, string> = {
  earn: 'bg-green-100 text-green-700',
  bonus: 'bg-emerald-100 text-emerald-700',
  adjustment: 'bg-amber-100 text-amber-700',
  redeem: 'bg-red-100 text-red-600',
  expiry: 'bg-gray-100 text-gray-500',
};

// Signed effect on the balance: earn/bonus add, redeem/expiry subtract, and an
// 'adjustment' carries its own sign. Drives the +/− display + colour.
const signedPoints = (t: LoyaltyTransaction) => {
  if (t.type === 'adjustment') return t.points;
  if (t.type === 'redeem' || t.type === 'expiry') return -Math.abs(t.points);
  return Math.abs(t.points);
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border p-5 ${accent ? 'border-[#b20202]/20 bg-[#b20202]/5' : 'border-gray-200 bg-white'}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-500'}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p
          className={`mt-0.5 truncate text-xl font-black tabular-nums leading-none ${accent ? 'text-[#b20202]' : 'text-gray-900'}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Award / Adjust drawer ───────────────────────────────────────────────────────
//
// One drawer for both admin mutations. `mode='award'` always grants points; `mode
// ='adjust'` lets the admin pick a credit (add) or debit (deduct). Submitting posts
// to the API, then the parent refetches so balance + ledger stay authoritative. A
// reason is required for either action.

function LoyaltyActionDrawer({
  mode,
  balance,
  saving,
  onClose,
  onSubmit,
}: {
  mode: 'award' | 'adjust';
  balance: number;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: {
    direction: 'credit' | 'debit';
    points: number;
    reason: string;
  }) => void;
}) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const amt = Math.floor(Number(amount));
  const valid = Number.isInteger(amt) && amt > 0;
  const reasonOk = reason.trim().length > 0;
  const overdraw = mode === 'adjust' && direction === 'debit' && amt > balance;

  const submit = () => {
    if (!valid) {
      toast.error('Enter a positive number of points');
      return;
    }
    if (!reasonOk) {
      toast.error('A reason is required');
      return;
    }
    if (overdraw) {
      toast.error('A deduction cannot exceed the current balance');
      return;
    }
    onSubmit({
      direction: mode === 'award' ? 'credit' : direction,
      points: amt,
      reason: reason.trim(),
    });
  };

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-colors placeholder:text-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PiStar className="h-5 w-5 text-[#b20202]" />
            <span className="text-base font-semibold text-gray-900">
              {mode === 'award' ? 'Award points' : 'Adjust points'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-5 rounded-xl border border-[#b20202]/15 bg-[#b20202]/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Current balance
            </p>
            <p className="mt-0.5 text-2xl font-black tabular-nums text-[#b20202]">
              {pts(balance)}
            </p>
          </div>

          {mode === 'adjust' && (
            <div className="mb-4">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Direction
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['credit', 'debit'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                      direction === d
                        ? 'bg-[#b20202]/8 border-[#b20202] text-[#b20202]'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {d === 'credit' ? 'Add (credit)' : 'Deduct (debit)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Points
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
            {overdraw && (
              <p className="mt-1.5 text-xs text-red-600">
                A deduction cannot exceed the current balance.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Reason
            </label>
            <textarea
              rows={3}
              maxLength={280}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === 'award'
                  ? 'e.g. Goodwill bonus for a loyal customer'
                  : 'e.g. Correcting a mis-recorded redemption'
              }
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !valid || !reasonOk || overdraw}
            className="rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:opacity-60"
          >
            {saving
              ? 'Saving…'
              : mode === 'award'
                ? 'Award points'
                : direction === 'credit'
                  ? 'Add points'
                  : 'Deduct points'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ContactLoyalty({ contactKey }: { contactKey: string }) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [contact, setContact] = useState<Contact | null>(null);
  const [balance, setBalance] = useState(0);
  const [instoreOnly, setInstoreOnly] = useState(false);
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [pagination, setPagination] = useState<ContactOrdersPagination | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Filters + paging. Changing a filter resets the page back to 1.
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // Award / adjust drawer.
  const [action, setAction] = useState<'award' | 'adjust' | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await contactService.getContactLoyalty(contactKey, token, {
        type: (typeFilter || undefined) as LoyaltyTxType | undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setContact(res.data.contact);
      setBalance(res.data.balance ?? 0);
      setInstoreOnly(Boolean(res.data.instoreOnly));
      setStats(res.data.stats ?? null);
      setTransactions(res.data.transactions ?? []);
      setPagination(res.data.pagination ?? null);
    } catch (e) {
      setNotFound(true);
      toast.error(e instanceof Error ? e.message : 'Failed to load loyalty');
    } finally {
      setLoading(false);
    }
  }, [contactKey, token, status, typeFilter, fromDate, toDate, page]);

  useEffect(() => {
    load();
  }, [load]);

  const submitAction = async (data: {
    direction: 'credit' | 'debit';
    points: number;
    reason: string;
  }) => {
    if (!action) return;
    setSaving(true);
    try {
      if (action === 'award') {
        await contactService.awardLoyalty(contactKey, token, {
          points: data.points,
          reason: data.reason,
        });
        toast.success('Points awarded');
      } else {
        await contactService.adjustLoyalty(contactKey, token, {
          direction: data.direction,
          points: data.points,
          reason: data.reason,
        });
        toast.success('Points adjusted');
      }
      setAction(null);
      // Refetch from page 1 so the new row is visible and the balance is fresh.
      setPage(1);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const hasFilters = Boolean(typeFilter || fromDate || toDate);
  const resetFilters = () => {
    setTypeFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  // Full-screen spinner only on the very first load; later refetches (filter /
  // page changes) keep the UI mounted and show the inline spinner instead.
  if (loading && !contact) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <PiSpinnerGap className="animate-spin text-4xl text-[#b20202]" />
      </div>
    );
  }

  if (notFound || !contact) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
        <PiStar className="text-5xl" />
        <p>Contact not found</p>
        <Link
          href={routes.contacts.list}
          className="text-sm text-[#b20202] hover:underline"
        >
          Back to contacts
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col">
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden px-6 py-8 md:px-10 lg:px-14"
        style={{
          background:
            'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)',
        }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative">
          <Link
            href={routes.contacts.detail(contact.key)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-red-200 transition-colors hover:text-white"
          >
            <PiArrowLeft className="h-4 w-4" /> {fullName(contact)}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-full ring-2 ring-white/30">
                <Avatar c={contact} size={56} />
              </div>
              <div className="min-w-0">
                <h1
                  className={`${fraunces.className} text-3xl font-semibold text-white`}
                >
                  Loyalty
                </h1>
                <div className="mt-1.5 flex items-center gap-2">
                  <SourceBadge source={contact.source} />
                  <span className="text-sm text-red-100">
                    {fullName(contact)}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin actions — hidden for an ecommerce-only contact (no loyalty). */}
            {!instoreOnly && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAction('award')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#b20202] shadow-sm transition-colors hover:bg-red-50"
                >
                  <PiPlus className="h-4 w-4" /> Award
                </button>
                <button
                  type="button"
                  onClick={() => setAction('adjust')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <PiSlidersHorizontal className="h-4 w-4" /> Adjust
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 pb-10 pt-6 md:px-10 lg:px-14">
        {instoreOnly ? (
          // Ecommerce-only contact: loyalty is tracked for in-store customers only.
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <PiStorefront className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">
              Loyalty is for in-store customers
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-400">
              This is an online (ecommerce) customer. Loyalty points are earned
              and redeemed at the point of sale, so there&apos;s no ledger to
              show here.
            </p>
            <Link
              href={routes.contacts.detail(contact.key)}
              className="mt-5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back to contact
            </Link>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Current Balance"
                value={pts(balance)}
                icon={<PiStar className="h-5 w-5" />}
                accent
              />
              <StatCard
                label="Total Earned"
                value={pts(stats?.earned ?? 0)}
                icon={<PiArrowCircleUp className="h-5 w-5" />}
              />
              <StatCard
                label="Total Redeemed"
                value={pts(stats?.redeemed ?? 0)}
                icon={<PiArrowCircleDown className="h-5 w-5" />}
              />
              <StatCard
                label="Last Activity"
                value={fmtDate(stats?.lastActivityAt ?? null)}
                icon={<PiClock className="h-5 w-5" />}
              />
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Type
                </span>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm capitalize text-gray-600 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                >
                  <option value="">All types</option>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  From
                </span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  To
                </span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
                />
              </label>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
              {loading && (
                <PiSpinnerGap className="mb-1.5 animate-spin text-lg text-[#b20202]" />
              )}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3 text-right">Points</th>
                      <th className="px-5 py-3 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-16">
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                              <PiWarningCircle className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-700">
                              {hasFilters
                                ? 'No matching transactions'
                                : 'No loyalty activity yet'}
                            </h3>
                            <p className="mt-1 text-sm text-gray-400">
                              {hasFilters
                                ? 'Try a different type or date range.'
                                : 'Award points to start a ledger.'}
                            </p>
                            {hasFilters && (
                              <button
                                type="button"
                                onClick={resetFilters}
                                className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => {
                        const signed = signedPoints(t);
                        const debit = signed < 0;
                        return (
                          <tr
                            key={t._id}
                            className="transition-colors hover:bg-gray-50/70"
                          >
                            <td className="px-5 py-3.5 text-sm text-gray-600">
                              {new Date(t.createdAt).toLocaleDateString(
                                'en-NG',
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                }
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${TYPE_CLS[t.type] ?? 'bg-gray-100 text-gray-500'}`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-gray-600">
                              <span className="flex items-center gap-1.5">
                                {t.reason || (
                                  <span className="text-gray-300">—</span>
                                )}
                                {t.relatedOrder?.orderNumber && (
                                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                    <PiReceipt className="h-3.5 w-3.5" />
                                    {t.relatedOrder.orderNumber}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td
                              className={`px-5 py-3.5 text-right text-sm font-semibold tabular-nums ${debit ? 'text-red-600' : 'text-green-700'}`}
                            >
                              {debit ? '−' : '+'}
                              {pts(Math.abs(signed))}
                            </td>
                            <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-gray-800">
                              {pts(t.balanceAfter)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.total > PAGE_SIZE && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Showing{' '}
                  <span className="font-semibold text-gray-700">
                    {(pagination.page - 1) * pagination.limit + 1}–
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-gray-700">
                    {pagination.total}
                  </span>{' '}
                  transactions
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1 || loading}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PiCaretLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <span className="text-xs font-semibold text-gray-500">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(pagination.pages, p + 1))
                    }
                    disabled={pagination.page >= pagination.pages || loading}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <PiCaretRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {action && (
          <LoyaltyActionDrawer
            mode={action}
            balance={balance}
            saving={saving}
            onClose={() => setAction(null)}
            onSubmit={submitAction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
