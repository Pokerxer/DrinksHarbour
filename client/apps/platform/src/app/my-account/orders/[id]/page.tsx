'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../../AccountShell';
import { useOrderDetail } from '../../_hooks/useOrders';
import { STATUS_CONFIG } from '../../_constants';
import InlineAlert from '../../_components/InlineAlert';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── Status timeline ───────────────────────────────────────────────────────────

const STEPS = [
  { key: 'pending',    label: 'Order Placed', icon: Icon.PiShoppingCartBold },
  { key: 'confirmed',  label: 'Confirmed',    icon: Icon.PiCheckCircleBold },
  { key: 'processing', label: 'Packing',      icon: Icon.PiPackageBold },
  { key: 'shipped',    label: 'On the Way',   icon: Icon.PiTruckBold },
  { key: 'delivered',  label: 'Delivered',    icon: Icon.PiHouseBold },
];

function StatusTimeline({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower === 'cancelled' || lower === 'refunded') return null;
  const currentIdx = STEPS.findIndex(s => s.key === lower);
  const idx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
      <h2 className="text-sm font-black text-stone-900 mb-5 flex items-center gap-2">
        <Icon.PiMapPinBold size={15} className="text-red-700" /> Delivery Progress
      </h2>
      <div className="flex items-start">
        {STEPS.map(({ key, label, icon: Ic }, i) => {
          const done    = i <= idx;
          const current = i === idx;
          const isLast  = i === STEPS.length - 1;
          return (
            <React.Fragment key={key}>
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all ${
                  current ? 'bg-red-700 border-red-700 text-white shadow-lg shadow-red-200'
                  : done   ? 'bg-red-50 border-red-300 text-red-600'
                  :          'bg-stone-50 border-stone-200 text-stone-300'
                }`}>
                  {done && !current ? <Icon.PiCheckBold size={16} /> : <Ic size={16} />}
                </div>
                <p className={`mt-2 text-[10px] font-semibold text-center leading-tight px-0.5 ${
                  current ? 'text-red-700' : done ? 'text-stone-600' : 'text-stone-300'
                }`}>{label}</p>
                {current && (
                  <span className="mt-1 text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Now</span>
                )}
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mt-5 mx-1 rounded-full transition-colors ${i < idx ? 'bg-red-300' : 'bg-stone-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Cancel dialog ─────────────────────────────────────────────────────────────

function CancelConfirm({ onConfirm, onDismiss, loading }: { onConfirm: () => void; onDismiss: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Icon.PiWarningBold size={22} className="text-red-600" />
        </div>
        <h3 className="font-black text-stone-900 text-center mb-2">Cancel this order?</h3>
        <p className="text-sm text-stone-500 text-center mb-6">This action cannot be undone. If you already paid, a refund will be processed within 3–5 business days.</p>
        <div className="flex gap-3">
          <button onClick={onDismiss} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50">Keep Order</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold hover:bg-red-800 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Cancelling…' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { token, user } = useAccount();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : null;

  const { order, loading, error, cancel } = useOrderDetail(token, id);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-stone-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-stone-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-stone-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-stone-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/my-account/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800">
          <Icon.PiArrowLeftBold size={13} /> Back to orders
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <Icon.PiWarningCircleBold size={36} className="mx-auto text-red-400 mb-3" />
          <p className="font-semibold text-red-700">{error || 'Order not found'}</p>
        </div>
      </div>
    );
  }

  const status   = (order as any).status as string;
  const statusLo = status?.toLowerCase();
  const cfg      = STATUS_CONFIG[statusLo] || STATUS_CONFIG.pending;
  const StatusIc = cfg.icon;
  const canCancel = statusLo === 'pending';
  const isCancelled = statusLo === 'cancelled' || statusLo === 'refunded';
  const orderNum = (order as any).orderNumber || (order as any)._id?.slice(-8).toUpperCase();
  const items: any[] = (order as any).items || [];
  const shipping: any = (order as any).shippingAddress || (order as any).shipping || {};
  const subtotal = (order as any).subtotal || 0;
  const shippingFee = (order as any).shippingFee || 0;
  const discountTotal = (order as any).discountTotal || 0;
  const total = (order as any).totalAmount || (order as any).total || 0;
  const paymentStatus = (order as any).paymentStatus;
  const paymentMethod = (order as any).paymentMethod;
  const placedAt = (order as any).placedAt || (order as any).createdAt;
  const trackHref = `/order-tracking?orderId=${orderNum}&email=${encodeURIComponent(user?.email || '')}`;

  const handleCancel = async () => {
    setCancelling(true);
    const res = await cancel();
    setCancelling(false);
    setShowCancel(false);
    setMsg({ ok: res.ok, text: res.ok ? 'Order cancelled successfully.' : (res.message || 'Cancellation failed') });
  };

  return (
    <>
      {showCancel && <CancelConfirm onConfirm={handleCancel} onDismiss={() => setShowCancel(false)} loading={cancelling} />}

      <div className="space-y-5">
        {/* Back + header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/my-account/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800 mb-2">
              <Icon.PiArrowLeftBold size={13} /> Back to orders
            </Link>
            <h1 className="text-xl font-black text-stone-900">Order #{orderNum}</h1>
            {placedAt && <p className="text-xs text-stone-400 mt-0.5">{fmtDateTime(placedAt)}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
              <StatusIc size={11} /> {statusLo.charAt(0).toUpperCase() + statusLo.slice(1)}
            </span>
            <Link href={trackHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-stone-200 bg-white text-stone-700 hover:border-red-200 hover:text-red-700 transition-colors">
              <Icon.PiMagnifyingGlassBold size={11} /> Live Tracking
            </Link>
          </div>
        </div>

        {msg && <InlineAlert variant={msg.ok ? 'success' : 'error'}>{msg.text}</InlineAlert>}

        {/* Cancelled / refunded banner */}
        {isCancelled && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <Icon.PiXCircleBold size={18} className="text-red-600" />
            </div>
            <div>
              <p className="font-bold text-red-800 text-sm">Order {statusLo.charAt(0).toUpperCase() + statusLo.slice(1)}</p>
              <p className="text-xs text-red-600 mt-0.5">
                {statusLo === 'refunded'
                  ? 'A refund has been issued and should reflect in your account within 3–5 business days.'
                  : 'This order was cancelled. If you were charged, a refund will be processed within 3–5 business days.'}
                {' '}<Link href="/contact?subject=order" className="underline font-semibold">Contact support</Link> if you need help.
              </p>
            </div>
          </div>
        )}

        {/* Status timeline */}
        <StatusTimeline status={status} />

        {/* Items */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Icon.PiShoppingBagBold size={15} className="text-red-700" />
            <h2 className="font-black text-stone-900 text-sm">Items ({items.length})</h2>
          </div>
          <ul className="divide-y divide-stone-50">
            {items.map((item: any, i: number) => {
              const product = typeof item.product === 'object' ? item.product : null;
              const subproduct = typeof item.subproduct === 'object' ? item.subproduct : null;
              const size = typeof item.size === 'object' ? item.size : null;
              const name = subproduct?.name || product?.name || 'Product';
              const img = subproduct?.imagesOverride?.[0]?.url || product?.images?.[0]?.url || null;
              const slug = product?.slug;
              const price = item.priceAtPurchase || 0;
              const qty = item.quantity || 1;
              const subtotalItem = item.itemSubtotal || price * qty;
              const sizeName = size?.displayName || size?.size;
              return (
                <li key={i} className="flex items-center gap-4 p-4 hover:bg-stone-50/60 transition-colors">
                  <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-100 overflow-hidden flex-shrink-0 relative">
                    {img ? (
                      <Image src={img} alt={name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiPackageBold size={20} className="text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {slug ? (
                      <Link href={`/product/${slug}`} className="text-sm font-semibold text-stone-900 hover:text-red-700 transition-colors line-clamp-1">{name}</Link>
                    ) : (
                      <p className="text-sm font-semibold text-stone-900 line-clamp-1">{name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-stone-400">{fmt(price)} × {qty}</span>
                      {sizeName && <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-medium">{sizeName}</span>}
                    </div>
                  </div>
                  <p className="font-bold text-sm text-stone-900 flex-shrink-0">{fmt(subtotalItem)}</p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Address + order info grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <h3 className="font-black text-stone-900 text-sm flex items-center gap-2 mb-4">
              <Icon.PiMapPinBold size={14} className="text-red-700" /> Delivery Address
            </h3>
            <div className="text-sm text-stone-600 space-y-1 leading-relaxed">
              {shipping.fullName && <p className="font-semibold text-stone-900">{shipping.fullName}</p>}
              {shipping.addressLine1 && <p>{shipping.addressLine1}</p>}
              {shipping.addressLine2 && <p>{shipping.addressLine2}</p>}
              {shipping.address && <p>{shipping.address}</p>}
              {(shipping.city || shipping.state) && <p>{[shipping.city, shipping.state].filter(Boolean).join(', ')}</p>}
              {shipping.country && <p>{shipping.country}</p>}
              {shipping.phone && (
                <p className="flex items-center gap-1.5 text-stone-500 mt-2 text-xs">
                  <Icon.PiPhoneBold size={12} /> {shipping.phone}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
            <h3 className="font-black text-stone-900 text-sm flex items-center gap-2 mb-4">
              <Icon.PiInfoBold size={14} className="text-red-700" /> Order Info
            </h3>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: 'Order Number', value: <span className="font-mono font-bold">{orderNum}</span> },
                paymentStatus && { label: 'Payment', value: (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${(STATUS_CONFIG[paymentStatus?.toLowerCase()] || STATUS_CONFIG.pending).bg} ${(STATUS_CONFIG[paymentStatus?.toLowerCase()] || STATUS_CONFIG.pending).border} ${(STATUS_CONFIG[paymentStatus?.toLowerCase()] || STATUS_CONFIG.pending).color}`}>
                    {paymentStatus}
                  </span>
                )},
                paymentMethod && { label: 'Method', value: paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) },
              ].filter(Boolean).map(({ label, value }: any) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-stone-400">{label}</dt>
                  <dd className="text-xs font-medium text-stone-800 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 sm:max-w-xs sm:ml-auto w-full">
          <h3 className="font-black text-stone-900 text-sm flex items-center gap-2 mb-4">
            <Icon.PiReceiptBold size={14} className="text-red-700" /> Summary
          </h3>
          <div className="space-y-2.5 text-sm">
            {subtotal > 0 && (
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span className="font-medium text-stone-800">{fmt(subtotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-500">
              <span>Delivery</span>
              <span className="font-medium text-stone-800">
                {shippingFee > 0 ? fmt(shippingFee) : <span className="text-green-600 font-semibold">Free</span>}
              </span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span className="font-semibold">−{fmt(discountTotal)}</span>
              </div>
            )}
            <div className="border-t border-stone-100 pt-3 flex justify-between">
              <span className="font-black text-stone-900">Total</span>
              <span className="font-black text-stone-900 text-base">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <Link href="/my-account/orders"
            className="inline-flex items-center gap-2 border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all">
            <Icon.PiArrowLeftBold size={14} /> All Orders
          </Link>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact?subject=order"
              className="inline-flex items-center gap-2 border border-stone-200 text-stone-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-red-200 hover:text-red-700 transition-all">
              <Icon.PiHeadsetBold size={14} /> Get Help
            </Link>
            {canCancel && (
              <button onClick={() => setShowCancel(true)}
                className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 transition-all">
                <Icon.PiXCircleBold size={14} /> Cancel Order
              </button>
            )}
            {statusLo === 'delivered' && (
              <Link href="/returns"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md">
                <Icon.PiArrowCounterClockwiseBold size={14} /> Return Items
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
