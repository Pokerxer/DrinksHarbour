'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  product: { _id: string; name: string; slug: string; images: { url: string; alt: string }[] };
  subproduct?: { name: string; images?: string[] };
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  size?: { displayName?: string; size?: string };
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  totalAmount: number;
  placedAt: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
    phone: string;
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending:    { color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  icon: Icon.PiClockBold },
  confirmed:  { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Icon.PiCheckCircleBold },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Icon.PiPackageBold },
  shipped:    { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: Icon.PiTruckBold },
  delivered:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: Icon.PiCheckCircleBold },
  cancelled:  { color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: Icon.PiXCircleBold },
  refunded:   { color: 'text-stone-600',  bg: 'bg-stone-50',   border: 'border-stone-200',  icon: Icon.PiArrowCounterClockwiseBold },
};

const STEPS = [
  { key: 'pending',    label: 'Order Placed', sub: 'Payment confirmed',   icon: Icon.PiShoppingCartBold },
  { key: 'confirmed',  label: 'Confirmed',    sub: 'Vendor acknowledged', icon: Icon.PiCheckCircleBold },
  { key: 'processing', label: 'Packing',      sub: 'Items being prepared',icon: Icon.PiPackageBold },
  { key: 'shipped',    label: 'On the Way',   sub: 'Rider dispatched',    icon: Icon.PiTruckBold },
  { key: 'delivered',  label: 'Delivered',    sub: 'Order received',      icon: Icon.PiHouseBold },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function getCfg(status: string) {
  return STATUS_CFG[status?.toLowerCase()] || STATUS_CFG.pending;
}

// ── Tracking Content ──────────────────────────────────────────────────────────

function OrderTrackingContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderId') || '');
  const [email, setEmail]             = useState(searchParams.get('email')   || '');
  const [order, setOrder]             = useState<Order | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const fetchOrder = async (num: string, mail: string) => {
    if (!num.trim() || !mail.trim()) { setError('Please enter both your order number and email.'); return; }
    setLoading(true); setError(''); setOrder(null);
    try {
      const res  = await fetch(`${API_URL}/api/orders/number/${num.trim()}?email=${encodeURIComponent(mail.trim())}`);
      const data = await res.json();
      if (res.status === 404) { setError('Order not found. Please check your order number and email.'); return; }
      if (!res.ok) throw new Error(data.message || 'Failed to fetch order');
      setOrder(data.data?.order || data.order || data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id  = searchParams.get('orderId');
    const em  = searchParams.get('email');
    if (id && em) { setOrderNumber(id); setEmail(em); fetchOrder(id, em); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); fetchOrder(orderNumber, email); };

  // ── LOOKUP FORM ───────────────────────────────────────────────────────────

  if (!order) {
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
              Enter your order number and billing email to get real-time delivery status.
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
                Your order number starts with <code className="font-mono font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">DH</code> and is in your confirmation email.
              </p>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5">
                  <Icon.PiWarningCircleBold size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1.5">Order Number</label>
                  <div className="relative">
                    <Icon.PiTagBold size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input type="text" placeholder="e.g. DH2605130001" value={orderNumber}
                      onChange={e => setOrderNumber(e.target.value)} required
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-all font-mono" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1.5">Billing Email</label>
                  <div className="relative">
                    <Icon.PiEnvelopeBold size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)} required
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl hover:from-red-800 hover:to-red-950 transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching…</>
                    : <><Icon.PiMagnifyingGlassBold size={16} /> Track Order</>}
                </button>
              </form>

              <p className="text-xs text-stone-400 mt-5 text-center">
                Can't find your order?{' '}
                <Link href="/contact?subject=order" className="text-red-700 font-semibold hover:underline">Contact support</Link>
              </p>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2 mb-3">
                  <Icon.PiQuestionBold size={14} className="text-red-700" /> Where's my order number?
                </h3>
                <ul className="space-y-2.5 text-xs text-stone-500">
                  {[
                    [Icon.PiEnvelopeBold,     'In your order confirmation email'],
                    [Icon.PiChatTeardropBold,  'In the SMS sent after payment'],
                    [Icon.PiUserBold,          'Under My Account → My Orders'],
                    [Icon.PiReceiptBold,       'On your payment receipt'],
                  ].map(([Ic, text]: any) => (
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
                      <span className="text-xs text-stone-400">{s.sub}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2348000000000'}?text=${encodeURIComponent('Hi! I need help tracking my order.')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-2xl p-4 transition-colors group">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon.PiWhatsappLogoBold size={19} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">Track via WhatsApp</p>
                  <p className="text-xs text-white/75">Instant support</p>
                </div>
                <Icon.PiArrowRightBold size={13} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ORDER RESULT ──────────────────────────────────────────────────────────

  const statusLo    = order.status?.toLowerCase();
  const cfg         = getCfg(order.status);
  const StatusIc    = cfg.icon;
  const isCancelled = statusLo === 'cancelled' || statusLo === 'refunded';
  const currentIdx  = STEPS.findIndex(s => s.key === statusLo);
  const idx         = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Sticky header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOrder(null)}
            className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors">
            <Icon.PiArrowLeftBold size={17} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-stone-900">Order #{order.orderNumber}</p>
            <p className="text-xs text-stone-400 hidden sm:block">{fmtDate(order.placedAt)}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <StatusIc size={11} />
            {statusLo.charAt(0).toUpperCase() + statusLo.slice(1)}
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
                  ? 'A refund has been processed and should reflect in your account within 3–5 business days.'
                  : 'This order was cancelled. If you were charged, a refund will be processed within 3–5 business days.'}
                {' '}<Link href="/contact" className="underline font-semibold">Contact support</Link> if you need help.
              </p>
            </div>
          </div>
        )}

        {/* Progress tracker */}
        {!isCancelled && (
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
        <div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
