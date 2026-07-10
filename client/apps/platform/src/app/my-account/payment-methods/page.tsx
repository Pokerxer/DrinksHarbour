'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import Link from 'next/link';
import { PAYMENT_METHODS } from '../_constants';

export default function PaymentMethodsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900">Payment Methods</h1>
        <p className="text-sm text-stone-500 mt-0.5">Accepted payment options at DrinksHarbour</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {PAYMENT_METHODS.map(({ id, icon: Ic, label, description, badge, badgeColor, color }) => (
          <div key={id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 hover:border-red-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Ic size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-stone-900 text-sm">{label}</p>
                  {badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-100">
          <Icon.PiShieldBold size={15} className="text-red-700" />
          <h2 className="font-black text-stone-900 text-sm">Payment Security</h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { icon: Icon.PiLockBold,          label: 'End-to-end encryption',    text: 'All payment data is encrypted with 256-bit SSL. Your card details are never stored on our servers.' },
            { icon: Icon.PiShieldCheckBold,    label: 'Korapay certified',        text: 'Payments are processed by Korapay, a PCI DSS compliant payment gateway trusted by thousands of Nigerian businesses.' },
            { icon: Icon.PiArrowCounterClockwiseBold, label: 'Instant refunds',   text: 'Approved refunds are processed back to your original payment method within 3–5 business days.' },
          ].map(({ icon: Ic, label, text }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-700 flex items-center justify-center flex-shrink-0">
                <Ic size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-900">{label}</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <Icon.PiInfoBold size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-900">Payment at checkout</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            You can choose your preferred payment method when you place an order. We do not save card details — all payments are processed in real time through Korapay.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-stone-900 via-red-950 to-stone-900 rounded-xl p-6 text-white flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-black text-base">Ready to shop?</p>
          <p className="text-sm text-red-200 mt-0.5">Browse our collection and pay with your preferred method at checkout.</p>
        </div>
        <Link
          href="/shop"
          className="flex items-center gap-2 bg-white text-red-800 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-all flex-shrink-0"
        >
          <Icon.PiShoppingCartBold size={15} /> Shop Now
        </Link>
      </div>
    </div>
  );
}
