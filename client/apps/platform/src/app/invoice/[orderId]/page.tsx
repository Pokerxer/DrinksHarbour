// client/apps/platform/src/app/invoice/[orderId]/page.tsx
'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

interface InvoiceData {
  orderId: string;
  orderNumber: string;
  customer: { name: string; phone: string };
  items: { name: string; size: string | null; tenant: string | null; quantity: number; unitPrice: number; itemSubtotal: number }[];
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  issuedAt: string | null;
  pay: { authorizationUrl: string } | null;
  payState: 'unpaid' | 'ready' | 'stale' | 'paid';
}

function InvoicePageInner() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const reference = searchParams.get('reference') || '';

  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  // Korapay's redirect may rewrite the query string and drop `token`. In that
  // case we can't load the full invoice, but the settlement call below still
  // works reference-only (fail-closed on the claim binding) — show a compact
  // confirmation instead of the itemised page.
  const [confirmed, setConfirmed] = useState<{ orderNumber: string; paymentStatus: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/whatsapp-orders/${params.orderId}/invoice?token=${encodeURIComponent(token)}`);
      if (res.status === 404) { setNotFound(true); return; }
      const body = await res.json();
      if (!res.ok || !body.success) { setError(body.message || 'Could not load the invoice'); return; }
      setData(body.data);
    } catch { setError('Could not load the invoice'); }
    finally { setLoading(false); }
  }, [params.orderId, token]);

  useEffect(() => {
    if (token) { load(); return; }
    if (reference) { setLoading(false); return; } // redirect return, no token → confirm-only
    setNotFound(true); setLoading(false);
  }, [load, token, reference]);

  // Korapay redirects back with ?reference= — verify and settle the order.
  useEffect(() => {
    if (!reference || !params.orderId || confirmed || verifying) return;
    setVerifying(true);
    fetch(`${API_URL}/api/whatsapp-orders/${params.orderId}/pay-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, ...(token ? { token } : {}) }),
    })
      .then(r => r.json())
      .then(body => {
        if (!body.success) { setError(body.message || 'Payment verification failed'); return; }
        setConfirmed({ orderNumber: body.data.orderNumber, paymentStatus: body.data.paymentStatus });
        if (token) load(); // token survived the redirect — refresh the full page
      })
      .catch(() => setError('Payment verification failed'))
      .finally(() => setVerifying(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, token, confirmed]);

  if (notFound) return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        <Icon.PiReceiptBold size={48} className="mx-auto text-gray-200 mb-3" />
        <h1 className="text-lg font-black text-gray-900 mb-1">Invoice not found</h1>
        <p className="text-sm text-gray-500">This invoice link is invalid or has expired. Please ask us to re-send it.</p>
      </div>
    </div>
  );

  if (loading || !data) return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
    </div>
  );

  // Redirect return without a token: we cannot load the full invoice, but the
  // settlement call above already confirmed payment — show a compact receipt.
  if (confirmed) return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        <Icon.PiCheckCircleBold size={56} className="mx-auto text-green-500 mb-3" />
        <h1 className="text-lg font-black text-gray-900 mb-1">Payment confirmed</h1>
        <p className="text-sm text-gray-500">Thank you — order {confirmed.orderNumber} is paid and being prepared.</p>
      </div>
    </div>
  );

  const paid = data.paymentStatus === 'paid';

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 to-red-950 px-6 py-5 text-white">
          <p className="text-xs text-red-200 font-semibold uppercase tracking-wide">DrinksHarbour Invoice</p>
          <h1 className="text-xl font-black mt-1">{data.orderNumber}</h1>
          {data.customer.name && <p className="text-xs text-stone-300 mt-0.5">For {data.customer.name}</p>}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <Icon.PiWarningCircleBold size={16} /> {error}
            </div>
          )}
          {verifying && (
            <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700">
              <span className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" /> Verifying your payment…
            </div>
          )}

          {paid ? (
            <div className="mb-5 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-bold text-green-700">
              <Icon.PiCheckCircleBold size={18} /> Paid — thank you! Your order is being prepared.
            </div>
          ) : data.payState === 'ready' && data.pay ? (
            <a href={data.pay.authorizationUrl}
              className="mb-5 w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all">
              <Icon.PiLockKeyBold size={16} /> Pay {fmt(data.totalAmount)} securely
            </a>
          ) : (
            <div className="mb-5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <Icon.PiWarningBold size={16} /> {data.payState === 'stale'
                ? 'This payment link has expired — please contact us for a fresh invoice.'
                : 'Payment link is being prepared — please refresh shortly.'}
            </div>
          )}

          <div className="space-y-2.5 text-sm">
            {data.items.map((item, i) => (
              <div key={i} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{item.name}{item.size ? ` · ${item.size}` : ''}</p>
                  <p className="text-xs text-gray-400">
                    Qty {item.quantity}{item.tenant ? ` · Sold by ${item.tenant}` : ''}
                  </p>
                </div>
                <span className="font-semibold text-gray-900 flex-shrink-0">{fmt(item.itemSubtotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-sm text-gray-600">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(data.subtotal)}</span></div>
            {data.discountTotal > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(data.discountTotal)}</span></div>}
            <div className="flex justify-between"><span>Delivery</span><span>{data.shippingFee === 0 ? 'Free' : fmt(data.shippingFee)}</span></div>
            <div className="flex justify-between pt-2 border-t border-gray-100 text-base font-black text-gray-900">
              <span>Total</span><span>{fmt(data.totalAmount)}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Icon.PiShieldCheckBold size={13} className="text-green-500" /> Secure payment</span>
            <span className="flex items-center gap-1"><Icon.PiLockKeyBold size={13} className="text-blue-500" /> Kora Pay</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" /></div>}>
      <InvoicePageInner />
    </Suspense>
  );
}
