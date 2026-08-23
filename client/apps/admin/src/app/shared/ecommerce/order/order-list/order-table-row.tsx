'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PiCaretRightBold } from 'react-icons/pi';
import type { Order } from '@/services/order.service';
import {
  SOURCE_CONFIG,
  StatusBadge,
  PayBadge,
  MethodBadge,
  customerOf,
  fmt,
  fmtDate,
} from './order-meta';

/** One table row (plus its per-vendor payout sub-row). The vendor map shows
 *  what the platform owes each vendor on this order — the operational reason a
 *  platform admin scans the orders list. */
export default function OrderTableRow({
  order,
  index,
  onView,
}: {
  order: Order;
  index: number;
  onView: (id: string) => void;
}) {
  const { name, contact } = customerOf(order);
  const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);
  const src = SOURCE_CONFIG[order.source ?? 'web'] ?? SOURCE_CONFIG.web;
  const open = () => onView(order._id);

  // Per-vendor payout summary — what the platform owes each vendor
  const vendorMap = new Map<string, { name: string; payout: number }>();
  for (const item of order.items) {
    const id = item.tenant?._id ?? '__unknown__';
    const prev = vendorMap.get(id) ?? {
      name: item.tenant?.name ?? 'Unknown',
      payout: 0,
    };
    vendorMap.set(id, {
      name: prev.name,
      payout: prev.payout + (item.tenantRevenueShare ?? 0),
    });
  }
  const vendors = Array.from(vendorMap.values()).filter((v) => v.payout > 0);

  return (
    <React.Fragment key={order._id}>
      <motion.tr
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index * 0.02, 0.2) }}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        tabIndex={0}
        role="link"
        aria-label={`View order ${order.orderNumber}`}
        className="group cursor-pointer border-t border-muted transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <td className="whitespace-nowrap px-5 py-4">
          <span className="font-mono text-xs font-semibold text-gray-900">
            #{order.orderNumber}
          </span>
          <span className="mt-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            <src.Icon className="h-3 w-3" />
            {src.label}
            {order.receiptNumber ? ` · ${order.receiptNumber}` : ''}
          </span>
        </td>
        <td className="px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">{name}</p>
          {contact && (
            <p className="mt-0.5 text-xs text-gray-400">{contact}</p>
          )}
        </td>
        <td className="whitespace-nowrap px-5 py-4 text-gray-600">
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </td>
        <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
          {fmt(order.totalAmount)}
        </td>
        <td className="whitespace-nowrap px-5 py-4">
          {order.platformCommissionTotal ? (
            <span className="inline-flex items-center rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
              {fmt(order.platformCommissionTotal)}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        <td className="px-5 py-4">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-5 py-4">
          <PayBadge status={order.paymentStatus} />
        </td>
        <td className="px-5 py-4">
          <MethodBadge method={order.paymentMethod} />
        </td>
        <td className="whitespace-nowrap px-5 py-4 text-xs text-gray-500">
          {fmtDate(order.placedAt || order.createdAt)}
        </td>
        <td className="px-5 py-4 text-right">
          <PiCaretRightBold className="inline h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-900" />
        </td>
      </motion.tr>

      {vendors.length > 0 && (
        <tr className="bg-gray-50/60">
          <td colSpan={10} className="px-5 pb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="me-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Vendors:
              </span>
              {vendors.map((v, vi) => (
                <span
                  key={vi}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs"
                >
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    {v.name}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {fmt(v.payout)}
                  </span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
