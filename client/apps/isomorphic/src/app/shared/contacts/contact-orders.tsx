'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiArrowLeft,
  PiSpinnerGap,
  PiShoppingBag,
  PiCoins,
  PiCheckCircle,
  PiXCircle,
  PiReceipt,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  contactService,
  type Contact,
  type ContactOrderStats,
} from '@/services/contact.service';
import type { Order } from '@/services/order.service';
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

export default function ContactOrders({ contactKey }: { contactKey: string }) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [contact, setContact] = useState<Contact | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<ContactOrderStats | null>(null);
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
      const res = await contactService.getContactOrders(contactKey, token);
      setContact(res.data.contact);
      setOrders(res.data.orders ?? []);
      setStats(res.data.stats ?? null);
    } catch (e) {
      setNotFound(true);
      toast.error(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [contactKey, token, status]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <PiSpinnerGap className="animate-spin text-4xl text-[#b20202]" />
      </div>
    );
  }

  if (notFound || !contact) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
        <PiShoppingBag className="text-5xl" />
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-full ring-2 ring-white/30">
              <Avatar c={contact} size={56} />
            </div>
            <div className="min-w-0">
              <h1
                className={`${fraunces.className} text-3xl font-semibold text-white`}
              >
                Orders
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <SourceBadge source={contact.source} />
                <span className="text-sm text-red-100">
                  {fullName(contact)}
                </span>
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
            label="Total Orders"
            value={String(stats?.count ?? orders.length)}
            icon={<PiShoppingBag className="h-5 w-5" />}
            accent
          />
          <StatCard
            label="Lifetime Spend"
            value={naira(stats?.totalSpent ?? 0)}
            icon={<PiCoins className="h-5 w-5" />}
          />
          <StatCard
            label="Delivered"
            value={String(stats?.delivered ?? 0)}
            icon={<PiCheckCircle className="h-5 w-5" />}
          />
          <StatCard
            label="Cancelled"
            value={String(stats?.cancelled ?? 0)}
            icon={<PiXCircle className="h-5 w-5" />}
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                          <PiWarningCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-700">
                          No orders yet
                        </h3>
                        <p className="mt-1 text-sm text-gray-400">
                          This contact has no orders with your store yet.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr
                      key={o._id}
                      className="transition-colors hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <PiReceipt className="h-4 w-4 text-gray-400" />
                          {o.orderNumber}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {o.placedAt
                          ? new Date(o.placedAt).toLocaleDateString('en-NG', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {o.items?.length ?? 0}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_CLS[o.status] ?? 'bg-gray-100 text-gray-500'}`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs capitalize text-gray-500">
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-gray-800">
                        {naira(o.totalAmount ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
