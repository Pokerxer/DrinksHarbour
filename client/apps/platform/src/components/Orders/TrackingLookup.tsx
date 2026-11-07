'use client';

import type React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { STEPS } from './tracking-display';

interface Props {
  orderNumber: string;
  setOrderNumber: (value: string) => void;
  loading: boolean;
  error: string;
  signedIn: boolean;
  handleSubmit: (event: React.FormEvent) => void;
}

export default function TrackingLookup({ orderNumber, setOrderNumber, loading, error, signedIn, handleSubmit }: Props) {
    return (
      <div className="min-h-screen bg-stone-50">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-stone-900 via-red-950 to-stone-900 text-white overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl" />
          </div>
          <div className="max-w-4xl mx-auto px-4 py-16 relative text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-semibold text-red-300 mb-5 border border-white/10">
              <Icon.PiTruckBold size={12} /> Order Tracking
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Where is my order?</h1>
            <p className="text-stone-300 text-sm sm:text-base max-w-md mx-auto">
              Sign in to the account that placed your order, then enter its order number.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-stone-50 to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="grid lg:grid-cols-5 gap-6 items-start">

            {/* Form card */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-200 shadow-sm p-7">
              <h2 className="text-lg font-black text-stone-900 mb-1">Track your order</h2>
              <p className="text-sm text-stone-500 mb-6">
                Your order number starts with <code className="font-mono font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">DH</code> and is in your confirmation email. Sign in to the account that placed the order.
              </p>

              {error && (
                <div id="tracking-error" role="alert" className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5">
                  <Icon.PiWarningCircleBold size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {signedIn ? <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
                <div>
                  <label htmlFor="tracking-order-number" className="text-sm font-bold text-stone-700 block mb-1.5">Order number</label>
                  <div className="relative">
                    <Icon.PiTagBold size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input id="tracking-order-number" name="orderNumber" autoComplete="off" aria-invalid={!!error} aria-describedby={error ? "tracking-error" : undefined} type="text" placeholder="e.g. DH2605130001" value={orderNumber}
                      onChange={e => setOrderNumber(e.target.value)} required
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-all font-mono" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl hover:from-red-800 hover:to-red-950 transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching…</>
                    : <><Icon.PiMagnifyingGlassBold size={16} /> Track Order</>}
                </button>
              </form> : <Link href={`/login?redirect=${encodeURIComponent(`/order-tracking${orderNumber ? `?orderId=${encodeURIComponent(orderNumber)}` : ''}`)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-center font-semibold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700">Sign in to track your order</Link>}

              <p className="text-xs text-stone-600 mt-5 text-center">
                Can&apos;t find your order?{' '}
                <Link href="/contact?subject=order" className="text-red-700 font-semibold hover:underline">Contact support</Link>
              </p>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2 mb-3">
                  <Icon.PiQuestionBold size={14} className="text-red-700" /> Where&apos;s my order number?
                </h3>
                <ul className="space-y-2.5 text-xs text-stone-500">
                  {([
                    [Icon.PiEnvelopeBold,     'In your order confirmation email'],
                    [Icon.PiShoppingBagBold,  'On your order confirmation page'],
                    [Icon.PiUserBold,          'Under My Account → My Orders'],
                    [Icon.PiReceiptBold,       'On your payment receipt'],
                  ] as const).map(([Ic, text]) => (
                    <li key={text} className="flex items-center gap-2.5">
                      <Ic size={13} className="text-red-500 flex-shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2 mb-3">
                  <Icon.PiTruckBold size={14} className="text-red-700" /> What each status means
                </h3>
                <ul className="space-y-2">
                  {STEPS.map(s => (
                    <li key={s.key} className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full flex-shrink-0">{s.label}</span>
                      <span className="text-xs text-stone-600">{s.sub}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2347048004020'}?text=${encodeURIComponent('Hi! I need help tracking my order.')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-green-800 hover:bg-green-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-800 text-white rounded-2xl p-4 transition-colors group">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon.PiWhatsappLogoBold size={19} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">Ask about your order</p>
                  <p className="text-xs text-white/90">Message our support team</p>
                </div>
                <Icon.PiArrowRightBold size={13} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
}
