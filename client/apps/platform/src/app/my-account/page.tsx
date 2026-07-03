'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useAccount } from './AccountShell';
import type { Order } from './_types';
import StatCard from './_components/StatCard';
import OrderCard from './_components/OrderCard';
import OrderCardSkeleton from './_components/OrderCardSkeleton';
import ProfileInfo from './_components/ProfileInfo';
import ProfileForm from './_components/ProfileForm';

const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function AccountOverviewPage() {
  const { user, setUser, token } = useAccount();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });

  useEffect(() => {
    if (user) setForm({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' });
  }, [user]);

  useEffect(() => {
    if (!token) return;
    fetchWithAuth(`${API_URL}/api/orders/my-orders`)
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
      const res = await fetchWithAuth(`${API_URL}/api/users/me`, { method: 'PUT', body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        const updated = data.data?.user || data.user || data;
        setUser(updated);
        localStorage.setItem('dh_user', JSON.stringify(updated));
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {}
    finally { setSaving(false); }
  };

  const displayName = user?.firstName || user?.name || 'User';
  const recentOrders = orders.slice(0, 5);
  const totalSpend = orders.reduce((s, o) => s + (o.totalAmount || o.total || 0), 0);

  const stats = [
    { icon: Icon.PiPackageBold,  label: 'Total Orders',  value: orders.length,                             color: 'bg-blue-50 text-blue-700' },
    { icon: Icon.PiTruckBold,    label: 'Delivered',     value: orders.filter(o => o.status?.toLowerCase() === 'delivered').length, color: 'bg-green-50 text-green-700' },
    { icon: Icon.PiCurrencyNgn,  label: 'Total Spend',   value: fmt(totalSpend),                           color: 'bg-amber-50 text-amber-700' },
    { icon: Icon.PiClockBold,    label: 'Active Orders', value: orders.filter(o => !['delivered', 'cancelled'].includes(o.status?.toLowerCase())).length, color: 'bg-purple-50 text-purple-700' },
  ];

  const quickLinks = [
    { icon: Icon.PiMapPinBold,   label: 'Manage Addresses',  href: '/my-account/addresses',     color: 'bg-blue-50 text-blue-700' },
    { icon: Icon.PiBellBold,     label: 'Notifications',     href: '/my-account/notifications', color: 'bg-purple-50 text-purple-700' },
    { icon: Icon.PiShieldBold,   label: 'Security Settings', href: '/my-account/security',      color: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900">Account Overview</h1>
        <p className="text-sm text-stone-500 mt-0.5">Welcome back, {displayName}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} loading={ordersLoading} />)}
      </div>

      {editing ? (
        <ProfileForm form={form} user={user!} saving={saving} saved={saved}
          onChange={(f, v) => setForm(p => ({ ...p, [f]: v }))}
          onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : user && <ProfileInfo user={user} onEdit={() => setEditing(true)} />}

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
            <Icon.PiPackageBold size={15} className="text-red-700" /> Recent Orders
          </h2>
          <Link href="/my-account/orders" className="text-xs font-semibold text-red-700 hover:underline flex items-center gap-1">
            View all <Icon.PiArrowRight size={12} />
          </Link>
        </div>

        {ordersLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => <OrderCardSkeleton key={i} />)}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-10 text-center">
            <Icon.PiPackageBold size={40} className="mx-auto text-stone-200 mb-3" />
            <p className="font-semibold text-stone-700 mb-1">No orders yet</p>
            <p className="text-sm text-stone-400 mb-5">Your order history will appear here.</p>
            <Link href="/shop" className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm">
              <Icon.PiShoppingCart size={15} /> Start Shopping
            </Link>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {recentOrders.map(order => <OrderCard key={order._id} order={order} userEmail={user?.email} />)}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {quickLinks.map(({ icon: Ic, label, href, color }) => (
          <Link key={href} href={href} className="flex items-center gap-3 bg-white border border-stone-200 shadow-sm rounded-xl p-4 hover:border-red-200 hover:shadow-md transition-all group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Ic size={17} />
            </div>
            <span className="text-sm font-semibold text-stone-700 group-hover:text-red-700 transition-colors">{label}</span>
            <Icon.PiArrowRight size={13} className="ml-auto text-stone-300 group-hover:text-red-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
