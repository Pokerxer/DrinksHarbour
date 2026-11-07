'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { useAuth } from '@/context/AuthContext';
import ShipmentProgress from '@/components/Orders/ShipmentProgress';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import TrackingLookup from '@/components/Orders/TrackingLookup';
import { STEPS, fmt, fmtDate, getCfg } from '@/components/Orders/tracking-display';
import type { Order } from '@/components/Orders/tracking-types';

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Config ────────────────────────────────────────────────────────────────────

// ── Tracking Content ──────────────────────────────────────────────────────────

function OrderTrackingContent() {
  const searchParams = useSearchParams();
  const {token,user}=useAuth();
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current+=1;},[]);
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderId') || '');
  const [order, setOrder]             = useState<Order | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const fetchOrder = async (num: string) => {
    if (!token || !user) return;
    if (!num.trim()) { setError('Please enter your order number.'); return; }
    const request=++generation.current;
    setLoading(true); setError(''); setOrder(null);
    try {
      const res  = await fetchWithAuth(`${API_URL}/api/orders/number/${encodeURIComponent(num.trim())}`, { cache: 'no-store' });
      const data = await res.json();
      if(request!==generation.current)return;
      if (res.status === 401) { setError('Sign in to the account that placed this order. For a guest order, use its confirmation page on the checkout device.'); return; }
      if (res.status === 404) { setError('Order not found in your signed-in account. Please check the order number.'); return; }
      if (!res.ok) throw new Error(data.message || 'Failed to fetch order');
      setOrder(data.data?.order || data.order || data);
    } catch (err: any) {
      if(request!==generation.current)return;
      setError(err.message || 'Failed to fetch order. Please check your details and try again.');
    } finally {
      if(request===generation.current)setLoading(false);
    }
  };

  useEffect(() => {
    const id  = searchParams.get('orderId');
    if (id) { setOrderNumber(id); fetchOrder(id); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); fetchOrder(orderNumber); };

  // ── LOOKUP FORM ───────────────────────────────────────────────────────────

  if (!order) {
    return <TrackingLookup orderNumber={orderNumber} setOrderNumber={setOrderNumber} loading={loading} error={error} signedIn={!!(token && user)} handleSubmit={handleSubmit} />;
  }

  // ── ORDER RESULT ──────────────────────────────────────────────────────────

  const statusLo    = order.status?.toLowerCase() || 'pending';
  const cfg         = getCfg(order.status);
  const StatusIc    = cfg.icon;
  const isCancelled = statusLo === 'cancelled' || statusLo === 'refunded';
  const currentIdx  = STEPS.findIndex(s => s.key === statusLo);
  const idx         = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Sticky header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <button aria-label="Track another order" onClick={() => setOrder(null)}
            className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors">
            <Icon.PiArrowLeftBold size={17} />
          </button>
          <div className="flex-1 min-w-0 basis-[calc(100%-4rem)] sm:basis-auto">
            <p className="break-all text-sm font-black text-stone-900">Order #{order.orderNumber}</p>
            <p className="text-xs text-stone-400 hidden sm:block">{fmtDate(order.placedAt)}</p>
          </div>
          <button type="button" onClick={() => fetchOrder(order.orderNumber)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Refresh order status</button>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <StatusIc size={11} />
            {statusLo.charAt(0).toUpperCase() + statusLo.slice(1).replaceAll('_', ' ')}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-7 space-y-5">

        {/* Cancelled / refunded banner */}
        {isCancelled && (
          <div className="flex items-start gap-3.5 bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <Icon.PiXCircleBold size={20} className="text-red-600" />
            </div>
            <div>
              <p className="font-bold text-red-800 text-sm">Order {statusLo === 'refunded' ? 'Refunded' : 'Cancelled'}</p>
              <p className="text-xs text-red-600 mt-1 leading-relaxed">
                {statusLo === 'refunded'
                  ? 'This order is recorded as refunded. Contact support to confirm the payment status and expected arrival time.'
                  : 'This order was cancelled. If you were charged, contact support to confirm whether a refund is due and its progress.'}
                {' '}<Link href="/contact" className="underline font-semibold">Contact support</Link> if you need help.
              </p>
            </div>
          </div>
        )}

        {/* Progress tracker */}
        {statusLo === 'partially_shipped' && <p className="rounded-xl border border-stone-200 bg-white p-5">Some items have shipped. See the shipment groups below for each quantity.</p>}
        {!isCancelled && statusLo !== 'partially_shipped' && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-sm font-black text-stone-900 mb-6 flex items-center gap-2">
              <Icon.PiMapPinBold size={14} className="text-red-700" /> Delivery Progress
            </h2>
            <div className="flex items-start">
              {STEPS.map(({ key, label, sub, icon: Ic }, i) => {
                const done    = i <= idx;
                const current = i === idx;
                const isLast  = i === STEPS.length - 1;
                return (
                  <React.Fragment key={key}>
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                        current ? 'bg-red-700 border-red-700 text-white shadow-lg shadow-red-200'
                        : done   ? 'bg-red-50 border-red-300 text-red-500'
                        :          'bg-stone-50 border-stone-200 text-stone-300'
                      }`}>
                        {done && !current ? <Icon.PiCheckBold size={17} /> : <Ic size={17} />}
                      </div>
                      <p className={`mt-2 text-[10px] font-bold text-center leading-tight ${
                        current ? 'text-red-700' : done ? 'text-stone-700' : 'text-stone-300'
                      }`}>{label}</p>
                      <p className={`mt-0.5 text-[9px] text-center leading-tight hidden sm:block ${
                        current ? 'text-red-500' : done ? 'text-stone-400' : 'text-stone-200'
                      }`}>{sub}</p>
                      {current && (
                        <span className="mt-1.5 text-[9px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </div>
                    {!isLast && (
                      <div className={`flex-1 h-0.5 mt-5 mx-1 rounded-full ${i < idx ? 'bg-red-300' : 'bg-stone-200'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <ShipmentProgress orderId={order._id} sessionKey={token && user ? `${user._id}:${token}` : null} />

        {/* Items + summary side by side on lg */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Items */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
              <Icon.PiShoppingBagBold size={15} className="text-red-700" />
              <h3 className="font-black text-stone-900 text-sm">Items ({order.items.length})</h3>
            </div>
            <ul className="divide-y divide-stone-50">
              {order.items.map((item, i) => {
                const product = item.product || {} as any;
                const subproduct = item.subproduct as any;
                const name  = subproduct?.name || product.name || 'Product';
                const img   = subproduct?.imagesOverride?.[0]?.url || product.images?.[0]?.url || null;
                const slug  = product.slug;
                const size  = (item.size as any)?.displayName || (item.size as any)?.size;
                return (
                  <li key={i} className="flex items-center gap-4 p-4">
                    <div className="w-14 h-14 rounded-xl bg-stone-100 border border-stone-100 overflow-hidden flex-shrink-0 relative">
                      {img
                        ? <Image src={img} alt={name} fill className="object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Icon.PiPackageBold size={18} className="text-stone-300" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      {slug
                        ? <Link href={`/product/${slug}`} className="text-sm font-semibold text-stone-900 hover:text-red-700 transition-colors line-clamp-1">{name}</Link>
                        : <p className="text-sm font-semibold text-stone-900 line-clamp-1">{name}</p>
                      }
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-stone-400">{fmt(item.priceAtPurchase)} × {item.quantity}</span>
                        {size && <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-medium">{size}</span>}
                      </div>
                    </div>
                    <p className="font-bold text-sm text-stone-900 flex-shrink-0">{fmt(item.itemSubtotal)}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Summary + address stacked */}
          <div className="space-y-4">
            {/* Order summary */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <h3 className="font-black text-stone-900 text-sm flex items-center gap-2 mb-4">
                <Icon.PiReceiptBold size={14} className="text-red-700" /> Summary
              </h3>
              <div className="space-y-2.5 text-sm">
                {order.subtotal > 0 && (
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span><span className="font-medium text-stone-800">{fmt(order.subtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-500">
                  <span>Delivery</span>
                  <span className="font-medium text-stone-800">
                    {order.shippingFee > 0 ? fmt(order.shippingFee) : <span className="text-green-600 font-semibold">Free</span>}
                  </span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span><span className="font-semibold">−{fmt(order.discountTotal)}</span>
                  </div>
                )}
                <div className="border-t border-stone-100 pt-3 flex justify-between">
                  <span className="font-black text-stone-900">Total</span>
                  <span className="font-black text-stone-900">{fmt(order.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Delivery address */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <h3 className="font-black text-stone-900 text-sm flex items-center gap-2 mb-3">
                <Icon.PiMapPinBold size={14} className="text-red-700" /> Delivery Address
              </h3>
              <div className="text-xs text-stone-600 space-y-1 leading-relaxed">
                <p className="font-semibold text-stone-800">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state}</p>
                <p>{order.shippingAddress.country}</p>
                <p className="flex items-center gap-1.5 text-stone-400 mt-1.5">
                  <Icon.PiPhoneBold size={11} /> {order.shippingAddress.phone}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-wrap gap-3 justify-between items-center pt-1 pb-6">
          <button onClick={() => setOrder(null)}
            className="inline-flex items-center gap-2 border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all">
            <Icon.PiMagnifyingGlassBold size={14} /> Track Another Order
          </button>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact?subject=order"
              className="inline-flex items-center gap-2 border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all">
              <Icon.PiHeadsetBold size={14} /> Get Help
            </Link>
            {statusLo === 'delivered' && (
              <Link href="/returns"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md shadow-red-900/20">
                <Icon.PiArrowCounterClockwiseBold size={14} /> Return Items
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div role="status" aria-label="Loading order tracking" className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    }>
      <OrderTrackingSession />
    </Suspense>
  );
}

function OrderTrackingSession() {
 const {token,user}=useAuth();
 return <OrderTrackingContent key={JSON.stringify([user?._id,token])}/>;
}
