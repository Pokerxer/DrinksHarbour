'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAuthorization } from '@/hooks/use-authorization';
import { routes } from '@/config/routes';
import { whatsappOrderService } from '@/services/whatsapp-order.service';
import CustomerCard, { type CustomerDraft } from './customer-card';
import ProductPickerModal, { type PickedLine } from './product-picker-modal';
import DeliveryCard, { type DeliveryDraft } from './delivery-card';
import TotalsPanel from './totals-panel';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

/** Idempotency key survives retries of the same submission (checkoutAttemptKey pattern). */
function attemptKey(): string {
  const KEY = 'dh:wa-order-attempt';
  let v = window.sessionStorage.getItem(KEY);
  if (!v) { v = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; window.sessionStorage.setItem(KEY, v); }
  return v;
}
function finishAttempt() { window.sessionStorage.removeItem('dh:wa-order-attempt'); }

export default function OrderBuilder() {
  const { user } = useAuthorization();
  const token = user?.token || '';

  const [pickerOpen, setPickerOpen] = useState(false);
  const [lines, setLines] = useState<PickedLine[]>([]);
  const [customer, setCustomer] = useState<CustomerDraft>({ firstName: '', lastName: '', email: '', phone: '' });
  const [delivery, setDelivery] = useState<DeliveryDraft>({ address: '', lga: '', state: '', zipCode: '', country: 'Nigeria' });
  const [shippingFee, setShippingFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ orderId: string; orderNumber: string; totalAmount: number } | null>(null);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [lines]);
  const total = subtotal + shippingFee;

  const canSubmit = Boolean(
    customer.firstName.trim() && customer.phone.trim() && customer.email.trim() &&
    delivery.address.trim() && delivery.state.trim() && delivery.lga.trim() && lines.length > 0 && token
  );

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true); setError('');
    try {
      // Server-priced preview first — the same validation checkout uses — so
      // stale price/stock problems surface before the order is created. The
      // endpoint is public and prices items itself from subProductId/sizeId.
      // NOTE: the marketplace price routinely differs from the tenant retail
      // price the picker displays, so `price_changed` is EXPECTED for most
      // lines — we adopt the server-corrected price/quantity (mirroring
      // checkout's "Accept & Continue" modal) and only block on lines that
      // are truly unbuyable.
      const preview = await fetch(`${API_URL}/api/cart/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: lines.map(l => ({
          subProductId: l.subProductId, sizeId: l.sizeId, quantity: l.quantity, price: l.unitPrice,
        })) }),
      });
      const previewBody = (await preview.json()) as {
        success?: boolean;
        data?: { items?: Array<{ subProductId?: string; sizeId?: string | null; status: string; name?: string; currentPrice?: number | null; maxQuantity?: number | null }> };
      };
      let corrected = lines;
      let shippingFeeForOrder = shippingFee;
      if (previewBody.success) {
        const results = previewBody.data?.items || [];
        const blocked: string[] = [];
        let adjusted = false;
        corrected = lines.map((l) => {
          const v = results.find(r =>
            r.subProductId === l.subProductId && (r.sizeId || null) === (l.sizeId || null));
          if (!v || v.status === 'ok') return l;
          if (v.status === 'out_of_stock' || v.status === 'unavailable') {
            blocked.push(`${l.productName}${l.sizeName ? ` (${l.sizeName})` : ''} — unavailable`);
            return l;
          }
          const next = { ...l };
          if (v.status === 'price_changed' && v.currentPrice != null && v.currentPrice > 0) next.unitPrice = v.currentPrice;
          if (v.status === 'quantity_reduced' && v.maxQuantity != null) next.quantity = Math.max(1, v.maxQuantity);
          if (next.unitPrice !== l.unitPrice || next.quantity !== l.quantity) adjusted = true;
          return next;
        });
        if (blocked.length) {
          throw new Error(`Some items cannot be ordered: ${blocked.join(', ')}. Please remove or replace them.`);
        }
        if (adjusted) {
          setLines(corrected);
          // The delivery fee was quoted against the pre-correction subtotal —
          // re-quote so the order never posts a stale fee below the zone floor.
          const cSubtotal = corrected.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
          const requote = await fetch(`${API_URL}/api/shipping/calculate?${new URLSearchParams({
            state: delivery.state, lga: delivery.lga, subtotal: String(cSubtotal),
          })}`);
          const requoteBody = (await requote.json()) as { success?: boolean; data?: { fee?: number } };
          if (requoteBody.success && typeof requoteBody.data?.fee === 'number') {
            setShippingFee(requoteBody.data.fee);
            shippingFeeForOrder = requoteBody.data.fee;
          }
        }
      }
      const orderSubtotal = corrected.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
      const orderShipping = shippingFeeForOrder;
      const order = await whatsappOrderService.createOrder(token, {
        customer: { firstName: customer.firstName.trim(), lastName: customer.lastName.trim(), email: customer.email.trim(), phone: customer.phone.trim() },
        shipping: { address: delivery.address.trim(), city: delivery.lga, lga: delivery.lga, state: delivery.state, zipCode: delivery.zipCode, country: delivery.country },
        paymentMethod: 'bank_transfer',
        items: corrected.map(l => ({ subProductId: l.subProductId, productId: l.productId, sizeId: l.sizeId, quantity: l.quantity, price: l.unitPrice })),
        subtotal: orderSubtotal, shippingFee: orderShipping, total: orderSubtotal + orderShipping,
        manualOrder: { originChannel: 'whatsapp' },
      }, attemptKey());
      finishAttempt();
      setCreated({ orderId: order._id, orderNumber: order.orderNumber, totalAmount: order.totalAmount });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the order');
    } finally { setSubmitting(false); }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
        <Icon.PiCheckCircleBold size={56} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-xl font-black text-gray-900 mb-1">Order {created.orderNumber} created</h2>
        <p className="text-sm text-gray-500 mb-6">
          {fmtNgn(created.totalAmount)} · tenants have been alerted and can fulfil it.
          Next: issue the invoice so the customer can pay.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={routes.eCommerce.orderDetails(created.orderId)}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50">
            View order
          </Link>
          <Link href={`${routes.eCommerce.orderDetails(created.orderId)}#whatsapp-invoice`}
            className="px-5 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl text-sm hover:from-red-800 hover:to-red-950">
            Issue invoice →
          </Link>
          <button onClick={() => { setCreated(null); setLines([]); setPickerOpen(false); }}
            className="px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 rounded-xl">
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <CustomerCard value={customer} onChange={setCustomer} token={token} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-black text-gray-900 flex items-center gap-2"><Icon.PiPackageBold size={16} className="text-red-700" /> Items</h3>
          <button type="button" onClick={() => setPickerOpen(true)}
            className="text-xs font-bold text-red-700 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100">
            + Add products
          </button>
        </div>
        <div className="p-5 space-y-2">
          {lines.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No items yet — pick from any tenant&apos;s catalogue.</p>}
          {lines.map((l, idx) => (
            <div key={`${l.subProductId}-${l.sizeId}-${idx}`} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{l.productName}{l.sizeName ? ` · ${l.sizeName}` : ''}</p>
                <p className="text-xs text-gray-400">{l.tenantName} · {fmtNgn(l.unitPrice)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setLines(ls => ls.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 font-bold">−</button>
                <span className="w-8 text-center font-bold">{l.quantity}</span>
                <button type="button" onClick={() => setLines(ls => ls.map((x, i) => i === idx ? { ...x, quantity: x.quantity + 1 } : x))}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 font-bold">+</button>
              </div>
              <span className="w-24 text-right font-bold text-gray-900">{fmtNgn(l.unitPrice * l.quantity)}</span>
              <button type="button" onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-600">
                <Icon.PiXBold size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <DeliveryCard value={delivery} onChange={setDelivery} subtotal={subtotal} onFee={(fee) => setShippingFee(fee)} token={token} />

      <TotalsPanel subtotal={subtotal} shippingFee={shippingFee} total={total} submitting={submitting} disabled={!canSubmit} onSubmit={submit} />

      <ProductPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} token={token}
        onAdd={(picked) => { setLines(ls => [...ls, ...picked]); setPickerOpen(false); }} />
    </div>
  );
}
