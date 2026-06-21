'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiArrowLeft,
  PiSpinnerGap,
  PiCoins,
  PiShoppingBag,
  PiChartLineUp,
  PiCalendarBlank,
  PiCreditCard,
  PiPackage,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  contactService,
  type Contact,
  type ContactSpending,
} from '@/services/contact.service';
import { routes } from '@/config/routes';
import { fraunces } from './contacts-fonts';
import { Avatar, fullName, SourceBadge } from './contact-form';

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  processing: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  refunded: 'bg-amber-100 text-amber-700',
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

// 'YYYY-MM' → 'Mon ’YY'
const fmtMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' });
};

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

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export default function ContactSpending({
  contactKey,
}: {
  contactKey: string;
}) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [contact, setContact] = useState<Contact | null>(null);
  const [spending, setSpending] = useState<ContactSpending | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await contactService.getContactSpending(contactKey, token);
      setContact(res.data.contact);
      setSpending(res.data.spending ?? null);
    } catch (e) {
      setNotFound(true);
      toast.error(e instanceof Error ? e.message : 'Failed to load spending');
    } finally {
      setLoading(false);
    }
  }, [contactKey, token, status]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !contact) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <PiSpinnerGap className="animate-spin text-4xl text-[#b20202]" />
      </div>
    );
  }

  if (notFound || !contact || !spending) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
        <PiCoins className="text-5xl" />
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

  const maxMonth = Math.max(1, ...spending.byMonth.map((m) => m.total));
  const hasOrders = spending.orderCount > 0;

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
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-full ring-2 ring-white/30">
              <Avatar c={contact} size={56} />
            </div>
            <div className="min-w-0">
              <h1
                className={`${fraunces.className} text-3xl font-semibold text-white`}
              >
                Spending
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <SourceBadge source={contact.source} />
                <span className="text-sm text-red-100">{fullName(contact)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-6 pb-10 pt-6 md:px-10 lg:px-14">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Spent"
            value={naira(spending.totalSpent)}
            icon={<PiCoins className="h-5 w-5" />}
            accent
          />
          <StatCard
            label="Orders"
            value={String(spending.orderCount)}
            icon={<PiShoppingBag className="h-5 w-5" />}
          />
          <StatCard
            label="Avg Order Value"
            value={naira(spending.avgOrderValue)}
            icon={<PiChartLineUp className="h-5 w-5" />}
          />
          <StatCard
            label="Last Order"
            value={fmtDate(spending.lastOrderAt)}
            icon={<PiCalendarBlank className="h-5 w-5" />}
          />
        </div>

        {!hasOrders ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <PiWarningCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700">
              No spending yet
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              This contact hasn’t placed any orders with your store yet.
            </p>
            <Link
              href={`${routes.contacts.detail(contact.key)}/orders`}
              className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              View orders
            </Link>
          </div>
        ) : (
          <>
            {/* Monthly spend */}
            <div className="mb-6">
              <Panel
                title="Monthly spend"
                icon={<PiChartLineUp className="h-4 w-4" />}
              >
                <div className="flex items-end gap-2 overflow-x-auto pb-2">
                  {spending.byMonth.map((m) => (
                    <div
                      key={m.month}
                      className="flex min-w-[44px] flex-1 flex-col items-center gap-2"
                      title={`${fmtMonth(m.month)} · ${naira(m.total)} · ${m.count} order${m.count === 1 ? '' : 's'}`}
                    >
                      <span className="text-[10px] font-semibold tabular-nums text-gray-400">
                        {m.total >= 1000
                          ? `${Math.round(m.total / 1000)}k`
                          : Math.round(m.total)}
                      </span>
                      <div className="flex h-32 w-full items-end">
                        <div
                          className="w-full rounded-t-md bg-[#b20202]/80 transition-all"
                          style={{
                            height: `${Math.max(4, (m.total / maxMonth) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] font-medium text-gray-500">
                        {fmtMonth(m.month)}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Top products */}
              <Panel
                title="Top products"
                icon={<PiPackage className="h-4 w-4" />}
              >
                {spending.topProducts.length === 0 ? (
                  <p className="text-sm text-gray-400">No product data.</p>
                ) : (
                  <ul className="space-y-3">
                    {spending.topProducts.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {p.quantity} unit{p.quantity === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-700">
                          {naira(p.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {/* Payment methods + statuses */}
              <Panel
                title="Payment methods"
                icon={<PiCreditCard className="h-4 w-4" />}
              >
                <ul className="space-y-3">
                  {spending.byPaymentMethod.map((pm) => (
                    <li
                      key={pm.method}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm capitalize text-gray-600">
                        {pm.method.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          {pm.count} order{pm.count === 1 ? '' : 's'}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-gray-700">
                          {naira(pm.total)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="my-4 h-px bg-gray-100" />

                <div className="flex flex-wrap gap-2">
                  {spending.byStatus.map((s) => (
                    <span
                      key={s.status}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_CLS[s.status] ?? 'bg-gray-100 text-gray-500'}`}
                    >
                      {s.status.replace(/_/g, ' ')}
                      <span className="tabular-nums opacity-70">{s.count}</span>
                    </span>
                  ))}
                </div>
              </Panel>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              First order {fmtDate(spending.firstOrderAt)} · Last order{' '}
              {fmtDate(spending.lastOrderAt)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
