'use client';

import React from 'react';
import Link from 'next/link';
import { routes } from '@/config/routes';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

/** One `GET /api/orders?source=manual` row. Platform scope returns the raw
 *  order: `user` is the matched customer account (or null for a guest) and
 *  the transcribed customer details live on `shippingAddress`. `placedBy`
 *  is an unpopulated ObjectId at list time, so it renders as a name only
 *  when the API populates it. */
export interface Row {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  placedBy?: { firstName?: string; lastName?: string } | null;
  shippingAddress?: { fullName?: string; phone?: string } | null;
  user?: { firstName?: string; lastName?: string } | null;
}

export default function IntakeList({ rows, loading }: { rows: Row[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="text-left px-5 py-3">Order</th>
            <th className="text-left px-5 py-3">Customer</th>
            <th className="text-left px-5 py-3">Total</th>
            <th className="text-left px-5 py-3">Payment</th>
            <th className="text-left px-5 py-3">Placed by</th>
            <th className="text-left px-5 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No WhatsApp orders yet — create the first one.</td></tr>
          )}
          {rows.map((o) => (
            <tr key={o._id} className="border-t border-gray-50 hover:bg-gray-50/60">
              <td className="px-5 py-3">
                <Link href={`${routes.eCommerce.orderDetails(o._id)}`} className="font-bold text-red-700 hover:underline">{o.orderNumber}</Link>
              </td>
              <td className="px-5 py-3">
                <div className="font-semibold text-gray-800">
                  {o.shippingAddress?.fullName ||
                    [o.user?.firstName, o.user?.lastName].filter(Boolean).join(' ') ||
                    'Guest'}
                </div>
                <div className="text-xs text-gray-400">{o.shippingAddress?.phone || ''}</div>
              </td>
              <td className="px-5 py-3 font-bold text-gray-900">{fmtNgn(o.totalAmount)}</td>
              <td className="px-5 py-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${o.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {o.paymentStatus}
                </span>
              </td>
              <td className="px-5 py-3 text-gray-600 text-xs">
                {[o.placedBy?.firstName, o.placedBy?.lastName].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="px-5 py-3 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString('en-NG')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
