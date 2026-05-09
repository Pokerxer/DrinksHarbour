'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from './AccountShell';
import { API_URL } from '@/lib/api';

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending:    { color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: Icon.PiClockBold },
  confirmed:  { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Icon.PiCheckCircleBold },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Icon.PiPackageBold },
  shipped:    { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: Icon.PiTruckBold },
  delivered:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: Icon.PiCheckCircleBold },
  cancelled:  { color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: Icon.PiXCircleBold },
};

const getStatus = (s: string) => STATUS_CONFIG[s?.toLowerCase()] || STATUS_CONFIG.pending;
const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function AccountOverviewPage() {
  const { user, setUser, token } = useAccount();
  const [orders, setOrders]     = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [form, setForm]         = useState({ firstName: '', lastName: '', phone: '' });

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' });
  }, [user]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/orders/my-orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOrders(data.data?.orders || data.orders || []); })
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res  = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = data.data?.user || data.user || data;
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {}
    finally { setSaving(false); }
  };

  const displayName  = user?.firstName || user?.name || 'User';
  const initials     = displayName.slice(0, 2).toUpperCase();
  const recentOrders = orders.slice(0, 5);
  const totalSpend   = orders.reduce((s, o) => s + (o.totalAmount || o.total || 0), 0);

  const STATS = [
    { icon: Icon.PiPackageBold,  label: 'Total Orders',  value: orders.length,                             color: 'bg-blue-50 text-blue-700' },
    { icon: Icon.PiTruckBold,    label: 'Delivered',     value: orders.filter(o => o.status?.toLowerCase() === 'delivered').length, color: 'bg-green-50 text-green-700' },
    { icon: Icon.PiCurrencyNgn,  label: 'Total Spend',   value: fmt(totalSpend),                           color: 'bg-amber-50 text-amber-700' },
    { icon: Icon.PiClockBold,    label: 'Active Orders', value: orders.filter(o => !['delivered','cancelled'].includes(o.status?.toLowerCase())).length, color: 'bg-purple-50 text-purple-700' },
  ];

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all';

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Account Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back, {displayName}</p>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS.map(({ icon: Ic, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Ic size={18} />
            </div>
            <p className="text-xl font-black text-gray-900">{ordersLoading ? '—' : value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Profile card ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
            <Icon.PiUserBold size={15} className="text-red-700" /> Profile Information
          </h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline"
            >
              <Icon.PiPencilSimple size={13} /> Edit
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5"
            >
              <Icon.PiCheckCircleFill size={16} className="text-green-600" />
              <p className="text-sm text-green-700 font-medium">Profile updated successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {editing ? (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">First Name</label>
                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Last Name</label>
                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234 800 000 0000" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email Address</label>
              <input type="email" value={user?.email || ''} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here. Contact support.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60"
              >
                {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-red-200 hover:text-red-700 transition-all">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 grid sm:grid-cols-2 gap-4">
            {[
              { label: 'First Name',  value: user?.firstName || '—' },
              { label: 'Last Name',   value: user?.lastName  || '—' },
              { label: 'Email',       value: user?.email     || '—' },
              { label: 'Phone',       value: user?.phone     || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent orders ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
            <Icon.PiPackageBold size={15} className="text-red-700" /> Recent Orders
          </h2>
          <Link href="/my-account/orders" className="text-xs font-semibold text-red-700 hover:underline flex items-center gap-1">
            View all <Icon.PiArrowRight size={12} />
          </Link>
        </div>

        {ordersLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-10 text-center">
            <Icon.PiPackageBold size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold text-gray-700 mb-1">No orders yet</p>
            <p className="text-sm text-gray-400 mb-5">Your order history will appear here.</p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm"
            >
              <Icon.PiShoppingCart size={15} /> Start Shopping
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order: any) => {
              const cfg = getStatus(order.status);
              const Ic  = cfg.icon;
              return (
                <div key={order._id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  {/* Item thumbnails */}
                  <div className="flex -space-x-2 flex-shrink-0">
                    {order.items?.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="w-10 h-10 rounded-xl border-2 border-white bg-gray-100 overflow-hidden relative">
                        {item.image || item.thumbImage?.[0] ? (
                          <Image src={item.image || item.thumbImage?.[0]} alt="" fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon.PiPackageBold size={14} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">#{order.orderNumber || order._id?.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.createdAt || order.placedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-sm text-gray-900">{fmt(order.totalAmount || order.total || 0)}</p>
                    <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                      <Ic size={10} />
                      {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                    </span>
                  </div>
                  <Link
                    href={`/order-tracking?orderId=${order.orderNumber || order._id}&email=${encodeURIComponent(user?.email || '')}`}
                    className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-200 hover:text-red-700 transition-all flex-shrink-0"
                  >
                    <Icon.PiArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: Icon.PiMapPinBold,     label: 'Manage Addresses',    href: '/my-account/addresses',       color: 'bg-blue-50 text-blue-700' },
          { icon: Icon.PiBellBold,       label: 'Notifications',       href: '/my-account/notifications',   color: 'bg-purple-50 text-purple-700' },
          { icon: Icon.PiShieldBold,     label: 'Security Settings',   href: '/my-account/security',        color: 'bg-amber-50 text-amber-700' },
        ].map(({ icon: Ic, label, href, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 bg-white border border-gray-100 shadow-sm rounded-2xl p-4 hover:border-red-100 hover:shadow-md transition-all group"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Ic size={17} />
            </div>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-red-700 transition-colors">{label}</span>
            <Icon.PiArrowRight size={13} className="ml-auto text-gray-300 group-hover:text-red-500 transition-colors" />
          </Link>
        ))}
      </div>

    </div>
  );
}
