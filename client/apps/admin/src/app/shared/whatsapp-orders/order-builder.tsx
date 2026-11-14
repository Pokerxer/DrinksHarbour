'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useAuthorization } from '@/hooks/use-authorization';
import { routes } from '@/config/routes';
import BuilderHeader from './builder-header';
import BuilderCustomerBar from './builder-customer-bar';
import BuilderReviewPanel from './builder-review-panel';
import BuilderTotalsCard from './builder-totals-card';
import BuilderLineTable from './builder-line-table';
import BuilderCatalogModal from './builder-catalog-modal';
import BuilderScanDrawer from './builder-scan-drawer';
import BuilderTenantPicker from './builder-tenant-picker';
import { useBarcodeScanner } from '@/app/shared/point-of-sale/hooks/useBarcodeScanner';
import useBuilderLines from './use-builder-lines';
import DeliveryCard, { type DeliveryDraft } from './delivery-card';
import { printOrderDocuments } from '@/utils/print/whatsapp-order-print';
import {
  whatsappOrderService, type BuilderLine, type ManualPrintLine,
} from '@/services/whatsapp-order.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const DRAFT_KEY = 'dh:wa-builder-draft-v2';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

/** Idempotency key survives retries of the same submission (checkout pattern). */
function attemptKey(): string {
  let v = window.sessionStorage.getItem('dh:wa-order-attempt');
  if (!v) {
    v = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem('dh:wa-order-attempt', v);
  }
  return v;
}
function finishAttempt() { window.sessionStorage.removeItem('dh:wa-order-attempt'); }

interface DraftShape {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: DeliveryDraft;
  lines: BuilderLine[];
}

export default function OrderBuilder() {
  const { user } = useAuthorization() as unknown as { user: { token?: string } };
  const token = user?.token || '';

  const [customer, setCustomer] = useState<DraftShape['customer']>({ firstName: '', lastName: '', email: '', phone: '' });
  const [delivery, setDelivery] = useState<DeliveryDraft>({ address: '', lga: '', state: '', zipCode: '', country: 'Nigeria' });
  // Lines are owned by useBuilderLines (line mutators + live server-priced
  // preview). The draft below restores/saves through its setLines/lines.
  const {
    lines, setLines, addProductLine, addLines, addSection, addNote, remove, update, setQuantity, previewing,
  } = useBuilderLines([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ orderId: string; orderNumber: string; totalAmount: number } | null>(null);
  // Lifted customer-match status — BuilderCustomerBar's lookup effect reports it.
  const [customerStatusText, setCustomerStatusText] = useState('Checking…');
  // Overlays mounted by Tasks 6–7 (catalogue modal, scan drawer).
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  // Barcode wedge offer target — a scan opens the shared tenant picker for the
  // matched product (per-tenant offers resolve inside it).
  const [barcodeTarget, setBarcodeTarget] = useState<{ productId: string; productName: string } | null>(null);
  const [scanLookup, setScanLookup] = useState<string | null>(null);

  // ── Barcode wedge: hardware scanners type the code + Enter anywhere on the
  // page; the platform barcode endpoint returns data.product (verified in
  // server/controllers/product.controller.js getProductByBarcode). ──
  const handleBarcode = useCallback(async (code: string) => {
    if (!token || scanLookup) return;
    setScanLookup(code);
    try {
      const res = await fetch(`${API_URL}/api/products/barcode/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean; message?: string;
        data?: { product?: { _id?: string; name?: string } };
      };
      const product = body.data?.product;
      if (!body.success || !product?._id) {
        toast.error(body.message || `No product for barcode ${code}`, { duration: 5000 });
        return;
      }
      setBarcodeTarget({ productId: product._id, productName: product.name || '' });
    } catch {
      toast.error(`Barcode lookup failed for ${code}`, { duration: 5000 });
    } finally { setScanLookup(null); }
  }, [token, scanLookup]);
  useBarcodeScanner(handleBarcode);

  // ── sessionStorage draft (restore once on mount; save on change) ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as DraftShape;
        setCustomer(d.customer); setDelivery(d.delivery); setLines(d.lines || []);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (created) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ customer, delivery, lines })); } catch { /* ignore */ }
  }, [customer, delivery, lines, created]);

  const productLines = lines.filter((l) => l.lineType === 'product');
  const subtotal = productLines.reduce((s, l) => s + (l.unitPrice || 0) * l.quantity, 0);
  const total = subtotal + shippingFee;
  const canSubmit = Boolean(
    customer.firstName.trim() && customer.phone.trim() && customer.email.trim() &&
    delivery.address.trim() && delivery.state.trim() && delivery.lga.trim() &&
    productLines.length > 0 && token && !submitting &&
    !productLines.some((l) => l.unitPrice == null)   // every product line has a server price
  );

  const submit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      // printLines: presentation layout in client line order; product entries
      // carry their index into the items array (only product lines are items).
      const productIndexByKey = new Map<string, number>();
      let idx = 0;
      for (const l of lines) if (l.lineType === 'product') productIndexByKey.set(l.key, idx++);
      const printLines: ManualPrintLine[] = lines.map((l) => ({
        lineType: l.lineType,
        name: l.lineType === 'product' ? '' : (l.productName || l.description || ''),
        description: l.description || '',
        productIndex: l.lineType === 'product' ? (productIndexByKey.get(l.key) ?? null) : null,
      }));
      const order = await whatsappOrderService.createOrder(token, {
        customer: { firstName: customer.firstName.trim(), lastName: customer.lastName.trim(), email: customer.email.trim(), phone: customer.phone.trim() },
        shipping: { address: delivery.address.trim(), city: delivery.lga, lga: delivery.lga, state: delivery.state, zipCode: delivery.zipCode, country: delivery.country },
        paymentMethod: 'bank_transfer',
        items: productLines.map((l) => ({ subProductId: l.subProductId!, productId: l.productId, sizeId: l.sizeId!, quantity: l.quantity, price: l.unitPrice! })),
        subtotal, shippingFee, total,
        manualOrder: { originChannel: 'whatsapp', printLines },
      }, attemptKey());
      finishAttempt();
      sessionStorage.removeItem(DRAFT_KEY);
      setCreated({ orderId: (order as { _id: string })._id, orderNumber: order.orderNumber, totalAmount: order.totalAmount });
      toast.success(`Order ${order.orderNumber} created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the order', { duration: 6000 });
    } finally { setSubmitting(false); }
  }, [canSubmit, submitting, lines, customer, delivery, subtotal, shippingFee, total, token]);

  if (created) {
    return (
      <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <Icon.PiCheckCircleBold size={52} className="mx-auto mb-3 text-green-600" />
        <h2 className="font-lexend text-xl font-bold text-gray-900">Order {created.orderNumber} created</h2>
        <p className="mt-1 text-sm text-gray-500">
          {fmtNgn(created.totalAmount)} · tenants have been alerted and can fulfil it.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href={routes.eCommerce.orderDetails(created.orderId)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            View order
          </Link>
          <Link href={`${routes.eCommerce.orderDetails(created.orderId)}#whatsapp-invoice`}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Issue invoice →
          </Link>
          <button onClick={() => printOrderDocuments(created.orderId, token, 'quotation')}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Print quotation
          </button>
          <button onClick={() => printOrderDocuments(created.orderId, token, 'invoice')}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Print invoice
          </button>
          <button onClick={() => { setCreated(null); setLines([]); setCustomer({ firstName: '', lastName: '', email: '', phone: '' }); setDelivery({ address: '', lga: '', state: '', zipCode: '', country: 'Nigeria' }); setShippingFee(0); }}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5">
            Create another
          </button>
        </div>
      </div>
    );
  }

  const customerStatus = customerStatusText; // from BuilderCustomerBar lookup state, lifted here
  return (
    <div>
      <BuilderHeader customerStatus={customerStatus} busy={submitting} canSubmit={canSubmit}
        onSubmit={submit} onOpenCatalog={() => setCatalogOpen(true)} onOpenScan={() => setScanOpen(true)} />
      <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_288px]">
        <fieldset disabled={submitting} className="min-w-0 space-y-4">
          <BuilderCustomerBar value={customer} onChange={setCustomer} token={token} onStatus={setCustomerStatusText} />
          <BuilderLineTable lines={lines} previewing={previewing}
            onAddProduct={() => addProductLine({})} onAddSection={addSection} onAddNote={addNote}
            onOpenCatalog={() => setCatalogOpen(true)} onOpenScan={() => setScanOpen(true)}
            onUpdate={update} onSetQuantity={setQuantity} onRemove={remove} />
          {/* Totals under the lines table (SalesTotals placement), its own card. */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <BuilderTotalsCard subtotal={subtotal} shippingFee={shippingFee} total={total} />
          </div>
          <DeliveryCard value={delivery} onChange={setDelivery} subtotal={subtotal} onFee={setShippingFee} token={token} />
        </fieldset>
        <aside className="min-w-0 space-y-4 2xl:sticky 2xl:top-4 2xl:self-start">
          <BuilderReviewPanel customerName={`${customer.firstName} ${customer.lastName}`.trim()}
            customerPhone={customer.phone} productCount={productLines.length}
            unitCount={productLines.reduce((s, l) => s + l.quantity, 0)}
            subtotal={subtotal} shippingFee={shippingFee} total={total}
            deliverySummary={delivery.state ? `${delivery.address} · ${delivery.lga}, ${delivery.state}` : ''} />
        </aside>
      </div>
      {/* Catalog (Task 6) + scan drawer / barcode wedge (Task 7) overlays */}
      <BuilderCatalogModal open={catalogOpen} onClose={() => setCatalogOpen(false)} token={token}
        lines={lines}
        onAdd={(ls) => { addLines(ls); setCatalogOpen(false); }} />
      <BuilderScanDrawer open={scanOpen} onClose={() => setScanOpen(false)} token={token}
        onAdd={(ls) => { addLines(ls); setScanOpen(false); }} />
      <BuilderTenantPicker open={Boolean(barcodeTarget)} onClose={() => setBarcodeTarget(null)} token={token}
        productId={barcodeTarget?.productId ?? null} productName={barcodeTarget?.productName ?? ''}
        onAdd={(ls) => { addLines(ls); setBarcodeTarget(null); }} />
      {scanLookup && (
        <div className="fixed bottom-6 right-6 z-[110] flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Looking up barcode <span className="font-mono">{scanLookup}</span>…
        </div>
      )}
    </div>
  );
}
