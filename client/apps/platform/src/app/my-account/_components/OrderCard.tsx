'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import type { Order } from '../_types';
import StatusBadge from './StatusBadge';

interface OrderCardProps {
  order: Order;
  userEmail?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function OrderCard({ order, userEmail }: OrderCardProps) {
  const orderNumber = order.orderNumber || order._id?.slice(-8).toUpperCase();
  const date = new Date(order.createdAt || order.placedAt || Date.now());
  const formattedDate = date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const total = order.totalAmount || order.total || 0;
  const items = order.items || [];
  const trackHref = `/order-tracking?orderId=${orderNumber}&email=${encodeURIComponent(userEmail || '')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <div>
          <p className="font-bold text-sm text-stone-900">#{orderNumber}</p>
          <p className="text-xs text-stone-400 mt-0.5">{formattedDate}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex -space-x-2 flex-shrink-0">
            {(items.slice(0, 4) as Order['items']).map((item, i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-xl border-2 border-white bg-stone-100 overflow-hidden relative"
              >
                {item.image || item.thumbImage?.[0] ? (
                  <Image
                    src={item.image || item.thumbImage![0]}
                    alt=""
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon.PiPackageBold size={14} className="text-stone-300" />
                  </div>
                )}
              </div>
            ))}
            {items.length > 4 && (
              <div className="w-12 h-12 rounded-xl border-2 border-white bg-stone-100 flex items-center justify-center">
                <span className="text-xs font-bold text-stone-400">+{items.length - 4}</span>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs text-stone-500">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
            {order.shipping?.address && (
              <p className="text-xs text-stone-400 truncate max-w-xs mt-0.5 flex items-center gap-1">
                <Icon.PiMapPinBold size={10} />
                {order.shipping.address}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-stone-400">Total</p>
            <p className="font-black text-stone-900">{fmt(total)}</p>
          </div>
          <Link
            href={trackHref}
            className="flex items-center gap-1.5 bg-gradient-to-br from-red-700 to-red-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:from-red-800 hover:to-red-900 transition-all"
          >
            <Icon.PiMagnifyingGlassBold size={12} /> Track
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
