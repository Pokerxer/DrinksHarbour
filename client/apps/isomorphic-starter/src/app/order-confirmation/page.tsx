'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  product: { name: string; slug: string; images: Array<{ url: string; alt?: string }> } | null;
  subproduct: { name: string; sku: string } | null;
  size: { name: string } | null;
  tenant: { name: string } | null;
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
  discountTotal: number;
  shippingFee: number;
  totalAmount: number;
  placedAt: string;
  paidAt?: string;
  paymentDetails?: { channel?: string; transactionId?: string };
  shippingAddress: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
  };
  coupon: { code: string; discountType: string; discountValue: number } | null;
  items: OrderItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STEPS = ['pending', 'processing', 'shipped', 'delivered'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  processing: 'Processing',
  partially_shipped: 'Partially Shipped',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Credit / Debit Card',
  bank_transfer: 'Bank Transfer (Paystack)',
  cash_on_delivery: 'Cash on Delivery',
  mobile_money: 'Mobile Money',
  wallet: 'Wallet',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStepIndex(status: string) {
  if (status === 'cancelled' || status === 'refunded') return -1;
  const idx = STATUS_STEPS.indexOf(status);
  return idx === -1 ? 1 : idx; // default processing
}

// ─── Order Timeline ───────────────────────────────────────────────────────────

function OrderTimeline({ status }: { status: string }) {
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-3">
        <Icon.PiXCircle size={20} />
        <span className="font-semibold text-sm capitalize">{STATUS_LABELS[status] ?? status}</span>
      </div>
    );
  }

  const currentStep = getStepIndex(status);

  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= currentStep;
        const active = i === currentStep;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
                ${done
                  ? active
                    ? 'bg-red-700 text-white shadow-md shadow-red-200'
                    : 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < currentStep ? (
                  <Icon.PiCheck size={14} />
                ) : active ? (
                  <Icon.PiCircleNotch size={14} className="animate-spin" />
                ) : (
                  <span className="text-[10px] font-bold">{i + 1}</span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium text-center leading-tight max-w-[56px]
                ${done ? (active ? 'text-red-700' : 'text-green-600') : 'text-gray-400'}`}
              >
                {STATUS_LABELS[step]}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors
                ${i < currentStep ? 'bg-green-400' : 'bg-gray-200'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 text-gray-400 hover:text-gray-700 transition-colors"
      title="Copy order number"
    >
      {copied ? <Icon.PiCheck size={14} className="text-green-500" /> : <Icon.PiCopy size={14} />}
    </button>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('orderId');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrder = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const customerEmail = localStorage.getItem('customerEmail') || sessionStorage.getItem('customerEmail');

      let url = `${API_URL}/api/orders/${orderId}`;
      if (!token && customerEmail) url += `?email=${encodeURIComponent(customerEmail)}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch order');

      setOrder(data.data?.order || data.order || data);
      localStorage.removeItem('customerEmail');
      sessionStorage.removeItem('customerEmail');
    } catch (err: any) {
      setError(err.message || 'Could not load order details.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-red-50 to-white">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-red-100 border-t-red-700 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your order…</p>
        </div>
      </div>
    );
  }

  // ── No order ID ────────────────────────────────────────────────────────────
  if (!orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon.PiShoppingCart size={36} className="text-red-700" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Order Found</h2>
          <p className="text-gray-500 mb-6 text-sm">No order ID was provided.</p>
          <Link href="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-lg font-semibold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md">
            <Icon.PiArrowLeft size={16} />
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon.PiWarningCircle size={36} className="text-red-700" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Order</h2>
          <p className="text-gray-500 mb-6 text-sm">{error || 'Order not found.'}</p>
          <div className="flex flex-col gap-3">
            <button onClick={fetchOrder} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-lg font-semibold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md">
              <Icon.PiArrowClockwise size={16} />
              Try Again
            </button>
            <Link href="/my-account/orders" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
              View My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const isPaid = order.paymentStatus === 'paid';
  const isCOD = order.paymentMethod === 'cash_on_delivery';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero banner ────────────────────────────────────────────────── */}
      <div className={`py-10 px-4 text-center ${isCancelled ? 'bg-gradient-to-br from-red-100 to-red-50' : 'bg-gradient-to-br from-green-50 to-white'}`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg
          ${isCancelled ? 'bg-red-100' : 'bg-white'}`}
        >
          {isCancelled ? (
            <Icon.PiXCircle size={44} className="text-red-600" />
          ) : (
            <Icon.PiCheckCircle size={44} className="text-green-500" />
          )}
        </div>

        <h1 className={`text-2xl sm:text-3xl font-black mb-1 ${isCancelled ? 'text-red-800' : 'text-gray-900'}`}>
          {isCancelled ? 'Order Cancelled' : 'Order Confirmed!'}
        </h1>
        <p className="text-gray-500 text-sm mb-4">
          {isCancelled
            ? 'This order has been cancelled.'
            : isCOD
            ? 'Your order has been placed. Pay on delivery.'
            : 'Payment received. We\'ll get your order ready.'}
        </p>

        {/* Order number pill */}
        <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">Order</span>
          <span className="text-base font-black text-gray-900 tracking-wide">{order.orderNumber}</span>
          <CopyButton text={order.orderNumber} />
        </div>

        {order.placedAt && (
          <p className="mt-3 text-xs text-gray-400">{formatDate(order.placedAt)}</p>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">

        {/* Order Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
              <Icon.PiPackage size={16} className="text-red-700" />
              Order Status
            </h2>
            <OrderTimeline status={order.status} />
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Icon.PiShoppingBag size={16} className="text-red-700" />
              Items ({order.items?.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {order.items?.map((item, idx) => {
              const imgSrc = item.product?.images?.[0]?.url;
              const name = item.product?.name ?? 'Product';
              const lineTotal = item.priceAtPurchase * item.quantity;
              return (
                <div key={idx} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                    {imgSrc ? (
                      <Image src={imgSrc} alt={name} width={56} height={56} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiImage size={20} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={item.product?.slug ? `/product/${item.product.slug}` : '#'}
                      className="font-semibold text-sm text-gray-900 truncate block hover:text-red-700 transition-colors"
                    >
                      {name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {item.size?.name && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.size.name}</span>
                      )}
                      {item.tenant?.name && (
                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{item.tenant.name}</span>
                      )}
                      <span className="text-xs text-gray-400">× {item.quantity}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm text-gray-900">₦{lineTotal.toLocaleString()}</p>
                    {item.quantity > 1 && (
                      <p className="text-[10px] text-gray-400">₦{item.priceAtPurchase.toLocaleString()} each</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing + Payment side by side on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Price breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Icon.PiReceipt size={16} className="text-red-700" />
              Summary
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">₦{(order.subtotal ?? 0).toLocaleString()}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Icon.PiTag size={13} />
                    {order.coupon?.code ? `Coupon (${order.coupon.code})` : 'Discount'}
                  </span>
                  <span className="font-medium">−₦{(order.discountTotal ?? 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span className={`font-medium ${order.shippingFee === 0 ? 'text-green-600' : ''}`}>
                  {order.shippingFee === 0 ? 'Free' : `₦${(order.shippingFee ?? 0).toLocaleString()}`}
                </span>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2.5 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-lg font-black text-gray-900">₦{(order.totalAmount ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Payment status badge */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Payment</span>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold
                  ${isPaid ? 'bg-green-100 text-green-700' : isCOD ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {isPaid ? <Icon.PiCheckCircle size={12} /> : <Icon.PiClock size={12} />}
                  {isPaid ? 'Paid' : isCOD ? 'Pay on Delivery' : order.paymentStatus}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Method</span>
                <span className="text-gray-700 font-medium">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
                </span>
              </div>
              {order.paymentDetails?.transactionId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Reference</span>
                  <span className="font-mono text-gray-700 text-[11px]">{order.paymentDetails.transactionId}</span>
                </div>
              )}
              {(order.paidAt || order.paymentDetails?.channel) && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Channel</span>
                  <span className="text-gray-700 font-medium capitalize">{order.paymentDetails?.channel ?? '—'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping address */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Icon.PiMapPin size={16} className="text-red-700" />
              Delivery Address
            </h2>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-gray-900">{order.shippingAddress?.fullName}</p>
              <p className="text-gray-600">{order.shippingAddress?.addressLine1}</p>
              {order.shippingAddress?.addressLine2 && (
                <p className="text-gray-600">{order.shippingAddress.addressLine2}</p>
              )}
              <p className="text-gray-600">
                {[order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.postalCode]
                  .filter(Boolean).join(', ')}
              </p>
              <p className="text-gray-600">{order.shippingAddress?.country}</p>

              <div className="pt-2 border-t border-dashed border-gray-200 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Icon.PiPhone size={13} />
                  {order.shippingAddress?.phone}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Icon.PiEnvelope size={13} />
                  {order.shippingAddress?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COD notice */}
        {isCOD && !isCancelled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <Icon.PiInfo size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-0.5">Cash on Delivery</p>
              <p className="text-xs text-amber-700">
                Please have <strong>₦{(order.totalAmount ?? 0).toLocaleString()}</strong> ready when your delivery arrives.
                Our delivery team will contact you beforehand.
              </p>
            </div>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Link
            href="/shop"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-br from-red-700 to-red-900 text-white font-semibold rounded-xl hover:from-red-800 hover:to-red-950 transition-all shadow-md text-sm"
          >
            <Icon.PiShoppingBag size={18} />
            Continue Shopping
          </Link>
          <Link
            href="/my-account/orders"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm"
          >
            <Icon.PiClipboardText size={18} />
            View All Orders
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-red-50 to-white">
          <div className="w-12 h-12 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
        </div>
      }
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}
