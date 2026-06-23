'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { API_URL } from '@/lib/api';

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending:    { color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: Icon.PiClockBold },
  confirmed:  { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Icon.PiCheckCircleBold },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Icon.PiPackageBold },
  shipped:    { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: Icon.PiTruckBold },
  delivered:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: Icon.PiCheckCircleBold },
  cancelled:  { color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: Icon.PiXCircleBold },
};

const getStatus = (s: string) => STATUS_CONFIG[s?.toLowerCase()] ?? STATUS_CONFIG.pending;
const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

const FILTERS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function OrdersPage() {
  const { token, user } = useAccount();
  const [orders, setOrders]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/orders/my-orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOrders(data.data?.orders || data.orders || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status?.toLowerCase() === filter);

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = f === 'all' ? orders.length : orders.filter(o => o.status?.toLowerCase() === f).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? 'Loading orders…' : `${orders.length} order${orders.length !== 1 ? 's' : ''} placed`}
        </p>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => {
          const active = filter === f;
          const count  = counts[f] ?? 0;
          if (f !== 'all' && count === 0) return null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                active ? 'bg-red-700 border-red-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <Icon.PiPackageBold size={44} className="mx-auto text-gray-200 mb-4" />
          <p className="font-black text-gray-800 text-lg mb-1">
            {filter === 'all' ? 'No orders yet' : `No ${filter} orders`}
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {filter === 'all' ? 'Your order history will appear here once you place an order.' : 'Try a different filter above.'}
          </p>
          {filter === 'all' && (
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm"
            >
              <Icon.PiShoppingCartBold size={15} /> Start Shopping
            </Link>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {filtered.map((order: any) => {
              const cfg = getStatus(order.status);
              const Ic  = cfg.icon;
              return (
                <motion.div
                  key={order._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-100 transition-all"
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    <div>
                      <p className="font-black text-gray-900 text-sm">
                        #{order.orderNumber || order._id?.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.createdAt || order.placedAt).toLocaleDateString('en-NG', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                      <Ic size={11} />
                      {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                    </span>
                  </div>

                  {/* Items + summary */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnails */}
                      <div className="flex -space-x-2 flex-shrink-0">
                        {order.items?.slice(0, 4).map((item: any, i: number) => (
                          <div key={i} className="w-12 h-12 rounded-xl border-2 border-white bg-gray-100 overflow-hidden relative">
                            {item.image || item.thumbImage?.[0] ? (
                              <Image src={item.image || item.thumbImage?.[0]} alt="" fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon.PiPackageBold size={14} className="text-gray-300" />
                              </div>
                            )}
                          </div>
                        ))}
                        {(order.items?.length ?? 0) > 4 && (
                          <div className="w-12 h-12 rounded-xl border-2 border-white bg-gray-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-400">+{order.items.length - 4}</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          {order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
                        </p>
                        {order.shipping?.address && (
                          <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5 flex items-center gap-1">
                            <Icon.PiMapPinBold size={10} />
                            {order.shipping.address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Total</p>
                        <p className="font-black text-gray-900">{fmt(order.totalAmount || order.total || 0)}</p>
                      </div>
                      <Link
                        href={`/order-tracking?orderId=${order.orderNumber || order._id}&email=${encodeURIComponent(user?.email || '')}`}
                        className="flex items-center gap-1.5 bg-gradient-to-br from-red-700 to-red-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:from-red-800 hover:to-red-950 transition-all"
                      >
                        <Icon.PiMagnifyingGlassBold size={12} /> Track
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
