'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import type { Order } from '../_types';
import { STATUS_CONFIG } from '../_constants';

interface OrderCardProps {
  order: Order;
  userEmail?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function OrderCard({ order, userEmail }: OrderCardProps) {
  const orderNumber = order.orderNumber || order._id?.slice(-8).toUpperCase();
  const date = new Date(order.createdAt || order.placedAt || Date.now());
  const formattedDate = date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const total = order.totalAmount || order.total || 0;
  const items = order.items || [];
  const statusLo = order.status?.toLowerCase() || 'pending';

  const getItemImage = (item: typeof items[0]) => {
    const p = item.product;
    if (p && typeof p === 'object') return p.images?.[0]?.url ?? null;
    return null;
  };
  const cfg = STATUS_CONFIG[statusLo] || STATUS_CONFIG.pending;
  const StatusIc = cfg.icon;
  const trackHref = `/order-tracking?orderId=${orderNumber}&email=${encodeURIComponent(userEmail || '')}`;
  const detailHref = `/my-account/orders/${order._id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
        <div>
          <p className="font-black text-sm text-stone-900">#{orderNumber}</p>
          <p className="text-xs text-stone-400 mt-0.5">{formattedDate}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
          <StatusIc size={10} />
          {statusLo.charAt(0).toUpperCase() + statusLo.slice(1)}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-3.5 flex items-center justify-between gap-4">
        {/* Thumbnails + meta */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex -space-x-2 flex-shrink-0">
            {items.slice(0, 3).map((item, i) => {
              const img = getItemImage(item);
              return (
                <div key={i} className="w-11 h-11 rounded-xl border-2 border-white bg-stone-100 overflow-hidden relative">
                  {img ? (
                    <Image src={img} alt="" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon.PiPackageBold size={13} className="text-stone-300" />
                    </div>
                  )}
                </div>
              );
            })}
            {items.length > 3 && (
              <div className="w-11 h-11 rounded-xl border-2 border-white bg-stone-100 flex items-center justify-center">
                <span className="text-[10px] font-bold text-stone-400">+{items.length - 3}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-stone-700">{items.length} item{items.length !== 1 ? 's' : ''}</p>
            {order.shipping?.address && (
              <p className="text-xs text-stone-400 truncate max-w-[160px] mt-0.5 flex items-center gap-1">
                <Icon.PiMapPinBold size={9} className="flex-shrink-0" />
                {order.shipping.address}
              </p>
            )}
          </div>
        </div>

        {/* Price + actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider">Total</p>
            <p className="font-black text-stone-900 text-sm">{fmt(total)}</p>
          </div>
          <div className="flex gap-2">
            <Link href={detailHref}
              className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:border-red-200 hover:text-red-700 transition-all">
              <Icon.PiEyeBold size={11} /> Details
            </Link>
            <Link href={trackHref}
              className="flex items-center gap-1.5 bg-gradient-to-br from-red-700 to-red-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:from-red-800 hover:to-red-900 transition-all">
              <Icon.PiMagnifyingGlassBold size={11} /> Track
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile total */}
      <div className="px-5 pb-3.5 sm:hidden flex items-center justify-between -mt-1">
        <span className="text-[10px] text-stone-400">Total</span>
        <span className="font-black text-stone-900 text-sm">{fmt(total)}</span>
      </div>
    </motion.div>
  );
}
