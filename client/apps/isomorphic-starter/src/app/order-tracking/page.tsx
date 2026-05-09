'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  product: {
    _id: string;
    name: string;
    slug: string;
    images: { url: string; alt: string }[];
  };
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
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
    postalCode: string;
    phone: string;
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending:    { color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: Icon.PiClockBold },
  confirmed:  { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Icon.PiCheckCircleBold },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Icon.PiPackageBold },
  shipped:    { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: Icon.PiTruckBold },
  delivered:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: Icon.PiCheckCircleBold },
  cancelled:  { color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: Icon.PiXCircleBold },
  refunded:   { color: 'text-gray-700',   bg: 'bg-gray-50',    border: 'border-gray-200',   icon: Icon.PiArrowUUpLeftBold },
};

const STATUS_STEPS = [
  { key: 'pending',    label: 'Order Placed', icon: Icon.PiShoppingCartBold },
  { key: 'confirmed',  label: 'Confirmed',    icon: Icon.PiCheckCircleBold },
  { key: 'processing', label: 'Packing',      icon: Icon.PiPackageBold },
  { key: 'shipped',    label: 'On the Way',   icon: Icon.PiTruckBold },
  { key: 'delivered',  label: 'Delivered',    icon: Icon.PiHouseBold },
];

const getStatusIndex = (status: string) => {
  const i = STATUS_STEPS.findIndex(s => s.key === status.toLowerCase());
  return i >= 0 ? i : 0;
};

const getStatusConfig = (status: string) => {
  const key = status?.toLowerCase() || 'pending';
  return STATUS_CONFIG[key] || STATUS_CONFIG.pending;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-NG', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── Input helper ─────────────────────────────────────────────────────────────

function Field({ label, icon: Ic, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <Ic size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

const inputCls = 'w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all';

// ─── Main content ─────────────────────────────────────────────────────────────

function OrderTrackingContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderId') || '');
  const [email, setEmail]             = useState(searchParams.get('email')   || '');
  const [order, setOrder]             = useState<Order | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    const orderId     = searchParams.get('orderId');
    const orderEmail  = searchParams.get('email');
    if (orderId && orderEmail) {
      setOrderNumber(orderId);
      setEmail(orderEmail);
      fetchOrder(orderId, orderEmail);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchOrder = async (orderNum: string, orderEmail: string) => {
    if (!orderNum.trim() || !orderEmail.trim()) {
      setError('Please enter both your order number and billing email.');
      return;
    }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res  = await fetch(`${API_URL}/api/orders/number/${orderNum}?email=${encodeURIComponent(orderEmail)}`);
      if (res.status === 404) { setError('Order not found. Please check your order number and email.'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch order');
      setOrder(data.data?.order || data.order || data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); fetchOrder(orderNumber, email); };

  // ── Form view ──────────────────────────────────────────────────────────────
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
          </div>
          <div className="container mx-auto max-w-4xl px-4 py-16 relative text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
              <Icon.PiMagnifyingGlass size={13} />
              Order Tracking
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Where is my order?</h1>
            <p className="text-gray-300 text-sm sm:text-base max-w-md mx-auto">
              Enter your order number and billing email to get real-time delivery status.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
              <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
            </svg>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-10">
          <div className="grid lg:grid-cols-5 gap-8 items-start">

            {/* Form */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
              <h2 className="text-lg font-black text-gray-900 mb-1">Track your order</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your order number is in your confirmation email — it starts with <span className="font-mono font-semibold text-gray-700">DH</span>.
              </p>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5"
                  >
                    <Icon.PiWarningCircleFill size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Field label="Order Number" icon={Icon.PiTag}>
                  <input
                    type="text"
                    placeholder="e.g. DH2602090029"
                    value={orderNumber}
                    onChange={e => setOrderNumber(e.target.value)}
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label="Billing Email" icon={Icon.PiEnvelope}>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className={inputCls}
                  />
                </Field>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl hover:from-red-800 hover:to-red-950 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching…</>
                  ) : (
                    <><Icon.PiMagnifyingGlass size={17} /> Track Order</>
                  )}
                </button>
              </form>

              <p className="text-xs text-gray-400 mt-4 text-center">
                Can't find your order?{' '}
                <Link href="/contact?subject=order" className="text-red-700 font-semibold hover:underline">
                  Contact support
                </Link>
              </p>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-4">
              {/* Where to find order number */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
                  <Icon.PiQuestion size={16} className="text-red-700" />
                  Where's my order number?
                </h3>
                <div className="space-y-2.5 text-xs text-gray-500">
                  {[
                    { icon: Icon.PiEnvelope,    text: 'In your order confirmation email' },
                    { icon: Icon.PiChatTeardrop, text: 'In the SMS sent after payment' },
                    { icon: Icon.PiUser,         text: 'Under My Account → My Orders' },
                    { icon: Icon.PiReceiptLight, text: 'On your payment receipt' },
                  ].map(({ icon: Ic, text }) => (
                    <div key={text} className="flex items-center gap-2">
                      <Ic size={14} className="text-red-600 flex-shrink-0" />
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery statuses */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
                  <Icon.PiTruck size={16} className="text-red-700" />
                  Order Statuses
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Order Placed',  desc: 'Payment confirmed',         color: 'bg-yellow-100 text-yellow-700' },
                    { label: 'Confirmed',     desc: 'Vendor acknowledged',        color: 'bg-blue-100 text-blue-700' },
                    { label: 'Packing',       desc: 'Items being prepared',       color: 'bg-orange-100 text-orange-700' },
                    { label: 'On the Way',    desc: 'Rider dispatched',           color: 'bg-purple-100 text-purple-700' },
                    { label: 'Delivered',     desc: 'Order received',             color: 'bg-green-100 text-green-700' },
                  ].map(({ label, desc, color }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${color}`}>{label}</span>
                      <span className="text-xs text-gray-400">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2348000000000'}?text=${encodeURIComponent('Hi! I need help tracking my order. Order #: ')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-[#25D366] text-white rounded-2xl p-4 hover:bg-[#1ebe5d] transition-colors group"
              >
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon.PiWhatsappLogo size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">Track via WhatsApp</p>
                  <p className="text-xs text-white/80">Instant AI support</p>
                </div>
                <Icon.PiArrowRight size={14} className="opacity-70 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Order detail view ──────────────────────────────────────────────────────
  const currentIndex = getStatusIndex(order.status);
  const cfg          = getStatusConfig(order.status);
  const StatusIcon   = cfg.icon;
  const isCancelled  = order.status.toLowerCase() === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Mini header bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="container mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setOrder(null)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <Icon.PiArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-black text-gray-900">Order #{order.orderNumber}</span>
            <span className="hidden sm:inline text-xs text-gray-400 ml-2">{formatDate(order.placedAt)}</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <StatusIcon size={12} />
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-5">

        {/* Progress tracker */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-900 mb-5 flex items-center gap-2">
              <Icon.PiMapPin size={15} className="text-red-700" /> Delivery Progress
            </h2>
            <div className="flex items-start justify-between gap-0 overflow-x-auto pb-1">
              {STATUS_STEPS.map(({ key, label, icon: Ic }, i) => {
                const done    = i <= currentIndex;
                const current = i === currentIndex;
                return (
                  <div key={key} className="flex flex-col items-center flex-1 relative min-w-[64px]">
                    {/* connector */}
                    {i < STATUS_STEPS.length - 1 && (
                      <div
                        className={`absolute top-5 left-1/2 w-full h-0.5 transition-colors ${i < currentIndex ? 'bg-red-600' : 'bg-gray-100'}`}
                        style={{ transform: 'translateX(50%)' }}
                      />
                    )}
                    {/* circle */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 transition-all ${
                      current ? 'bg-red-700 border-red-700 text-white shadow-lg shadow-red-200'
                        : done  ? 'bg-red-100 border-red-300 text-red-700'
                        : 'bg-gray-50 border-gray-200 text-gray-300'
                    }`}>
                      <Ic size={17} />
                    </div>
                    <p className={`mt-2 text-[10px] font-semibold text-center leading-tight ${current ? 'text-red-700' : done ? 'text-gray-600' : 'text-gray-300'}`}>
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 bg-red-100 text-red-700 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon.PiXCircleBold size={22} />
            </div>
            <div>
              <p className="font-bold text-red-800 text-sm">Order Cancelled</p>
              <p className="text-xs text-red-600 mt-0.5">
                This order has been cancelled. If you were charged, a refund will be processed within 3–5 business days.
                {' '}<Link href="/contact" className="underline font-semibold">Contact support</Link> if you need help.
              </p>
            </div>
          </div>
        )}

        {/* Address + Order info */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
              <Icon.PiMapPin size={15} className="text-red-700" /> Delivery Address
            </h3>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p className="font-semibold text-gray-900">{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.addressLine1}</p>
              {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
              <p>{order.shippingAddress.city}, {order.shippingAddress.state}</p>
              <p>{order.shippingAddress.country}</p>
              <p className="flex items-center gap-1.5 text-gray-500 mt-2">
                <Icon.PiPhone size={13} /> {order.shippingAddress.phone}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
              <Icon.PiInfo size={15} className="text-red-700" /> Order Details
            </h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Order Number',    value: <span className="font-mono font-semibold">{order.orderNumber}</span> },
                { label: 'Date Placed',     value: formatDate(order.placedAt) },
                { label: 'Payment Method',  value: (order.paymentMethod || 'Card').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) },
                { label: 'Payment Status',  value: (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusConfig(order.paymentStatus).bg} ${getStatusConfig(order.paymentStatus).border} ${getStatusConfig(order.paymentStatus).color}`}>
                    {order.paymentStatus}
                  </span>
                )},
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-gray-400 text-xs">{label}</span>
                  <span className="text-gray-900 font-medium text-xs text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Icon.PiShoppingBag size={16} className="text-red-700" />
            <h3 className="font-bold text-gray-900 text-sm">
              Items ({order.items.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex-shrink-0 border border-gray-100">
                  {item.product.images?.[0] ? (
                    <Image
                      src={item.product.images[0].url}
                      alt={item.product.images[0].alt || item.product.name}
                      width={64}
                      height={64}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon.PiImage size={20} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/product/${item.product.slug}`}
                    className="font-semibold text-sm text-gray-900 hover:text-red-700 transition-colors line-clamp-1"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatCurrency(item.priceAtPurchase)} × {item.quantity}
                  </p>
                </div>
                <p className="font-bold text-sm text-gray-900 flex-shrink-0">
                  {formatCurrency(item.itemSubtotal)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-sm ml-auto w-full">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4">
            <Icon.PiReceipt size={15} className="text-red-700" /> Summary
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Delivery</span>
              <span className="font-medium text-gray-900">
                {order.shippingFee > 0 ? formatCurrency(order.shippingFee) : <span className="text-green-600">Free</span>}
              </span>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>−{formatCurrency(order.discountTotal)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="font-black text-gray-900">Total</span>
              <span className="font-black text-lg text-gray-900">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-wrap gap-3 justify-between items-center pt-2 pb-6">
          <button
            onClick={() => setOrder(null)}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all"
          >
            <Icon.PiMagnifyingGlass size={15} /> Track Another Order
          </button>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact?subject=order"
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all"
            >
              <Icon.PiHeadset size={15} /> Get Help
            </Link>
            {order.status.toLowerCase() === 'delivered' && (
              <Link
                href="/returns"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
              >
                <Icon.PiArrowCounterClockwise size={15} /> Return Item
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
      </div>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
