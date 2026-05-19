'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  PiX, PiCheckCircle, PiPrinter, PiUser, PiFileText,
  PiCurrencyNgn, PiCreditCard, PiBank, PiDeviceMobile,
  PiArrowLeft, PiArrowRight,
} from 'react-icons/pi';
import { usePOSCart, usePOSAuth, usePOSUI, usePOSSaleSignal, usePOSPricelist } from '@/app/shared/point-of-sale/store';
import { posApi } from '@/app/shared/point-of-sale/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { POSOrderResponse } from '@/app/shared/point-of-sale/types';
import { useTenant } from '@/context/TenantContext';
import cn from '@core/utils/class-names';

// ── Types & constants ─────────────────────────────────────────────────────────

type PaymentLine = { id: string; method: string; label: string; amount: number };

const METHODS = [
  { value: 'cash',          label: 'Cash',          icon: <PiCurrencyNgn className="h-5 w-5" /> },
  { value: 'card',          label: 'Card / POS',    icon: <PiCreditCard   className="h-5 w-5" /> },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: <PiBank         className="h-5 w-5" /> },
  { value: 'mobile_money',  label: 'Mobile Money',  icon: <PiDeviceMobile className="h-5 w-5" /> },
];

// Quick-add denominations (Nigerian naira)
const QUICK = [1_000, 2_000, 5_000];

// ── Receipt ───────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  cash: 'CASH', card: 'CARD / POS', bank_transfer: 'BANK TRANSFER',
  mobile_money: 'MOBILE MONEY', split: 'SPLIT',
};

// All receipt colours are inline — bypasses Next.js dark-mode class overrides.
const R = {
  paper:   { backgroundColor: '#ffffff', color: '#111111' },
  muted:   { color: '#555555' },
  red:     { color: '#b20202' },
  green:   { color: '#15803d' },
  bold:    { fontWeight: 700 as const },
  center:  { textAlign: 'center' as const },
  divider: { borderTop: '1px dashed #aaaaaa', margin: '7px 0' },
  rule:    { borderTop: '2px solid #222222', margin: '7px 0' },
};

function ReceiptScreen({
  order,
  paymentLines = [],
  onNewSale,
}: {
  order: POSOrderResponse;
  paymentLines?: PaymentLine[];
  onNewSale: () => void;
}) {
  const { tenant }  = useTenant();
  const { staff }   = usePOSAuth();
  const { subtotal: cartSubtotal, discountAmount: cartDiscount, customer, note: cartNote } = usePOSCart();
  const printRef    = useRef<HTMLDivElement>(null);

  const storeName   = tenant?.name?.toUpperCase() || 'DRINKS HARBOUR';
  const staffName   = staff ? (staff.posName || `${staff.firstName} ${staff.lastName}`.trim()) : '—';
  const hasCustomer = customer.firstName !== 'Walk-in';
  const custName    = hasCustomer ? `${customer.firstName} ${customer.lastName}`.trim() : null;

  const displaySubtotal = order.subtotal     ?? cartSubtotal;
  const displayDiscount = order.discountTotal ?? cartDiscount;
  const displayNote     = order.note          || cartNote;

  const receiptDate = new Date(order.placedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=400,height=750,scrollbars=yes');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${order.receiptNumber}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',Courier,monospace;font-size:12px;
             background:#fff;color:#111;width:360px;margin:0 auto;padding:12px 16px}
        @media print{body{width:100%;padding:4px 8px}}
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  // Shared row: label left, value right — all inline styles
  function Row({ label, value, vStyle }: { label: string; value: string; vStyle?: React.CSSProperties }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', lineHeight: '1.7' }}>
        <span style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
        <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...vStyle }}>{value}</span>
      </div>
    );
  }

  return (
    /* Transparent overlay — the sell page shows through the blur behind */
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: '24px 16px', overflow: 'hidden' }}>

      {/* Receipt card — scrollable when tall */}
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%', width: 380, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>

        {/* Success banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#16a34a', padding: '12px 20px', flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PiCheckCircle style={{ width: 20, height: 20, color: '#fff' }} />
          </div>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Payment successful</p>
            <p style={{ color: '#bbf7d0', fontSize: 12 }}>
              {formatCurrency(order.total)} &nbsp;·&nbsp; {METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
            </p>
          </div>
        </div>

        {/* Receipt paper — scrollable */}
        <div style={{ overflowY: 'auto', backgroundColor: '#ffffff' }}>
        <div
          ref={printRef}
          style={{
            ...R.paper,
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 12,
            lineHeight: 1.6,
            padding: '24px 20px 20px',
          }}
        >
          {/* Store header */}
          <div style={{ ...R.center, marginBottom: 8 }}>
            <p style={{ ...R.bold, fontSize: 15, letterSpacing: '0.1em' }}>{storeName}</p>
            <p style={{ ...R.muted, fontSize: 10, marginTop: 2 }}>39 GANA ST, MAITAMA, ABUJA</p>
            <p style={{ ...R.muted, fontSize: 10 }}>NIGERIA</p>
            <p style={{ color: '#888', fontSize: 10 }}>drinksharbour.com</p>
          </div>

          <div style={R.rule} />

          {/* Order meta */}
          <Row label="Receipt #" value={order.receiptNumber} />
          {order.orderNumber && <Row label="Order #" value={order.orderNumber} />}
          <Row label="Date"     value={receiptDate} />
          <Row label="Cashier"  value={staffName} />
          {custName && <Row label="Customer" value={custName} />}

          <div style={R.rule} />

          {/* Column headers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', ...R.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ flex: 1 }}>Description</span>
            <span>Amount</span>
          </div>
          <div style={R.divider} />

          {/* Items */}
          {(order.items || []).map((item, i) => {
            const price     = item.priceAtPurchase ?? 0;
            const lineTotal = item.itemSubtotal ?? price * item.quantity;
            const label     = (item.name || 'Item') + (item.variant ? ` (${item.variant})` : '');
            const truncated = label.length > 26 ? label.slice(0, 25) + '…' : label;
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...R.bold }}>
                  <span style={{ flex: 1, paddingRight: 8 }}>{truncated}</span>
                  <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
                <div style={{ paddingLeft: 8, fontSize: 10, ...R.muted }}>
                  {item.quantity} x {formatCurrency(price)}
                  {item.discountAmount > 0 && (
                    <span style={{ marginLeft: 8, ...R.red }}>disc -{formatCurrency(item.discountAmount)}</span>
                  )}
                </div>
              </div>
            );
          })}

          <div style={R.divider} />

          {/* Totals */}
          {displayDiscount > 0 && (
            <>
              <Row label="Subtotal" value={formatCurrency(displaySubtotal)} />
              <Row label="Discount" value={`-${formatCurrency(displayDiscount)}`} vStyle={R.red} />
            </>
          )}
          <div style={R.rule} />
          <div style={{ display: 'flex', justifyContent: 'space-between', ...R.bold, fontSize: 14 }}>
            <span>TOTAL</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(order.total)}</span>
          </div>
          <div style={R.rule} />

          {/* Payment */}
          {paymentLines.length > 1 ? (
            paymentLines.map((ln, i) => (
              <Row key={i} label={ln.label} value={formatCurrency(ln.amount)} />
            ))
          ) : (
            <Row
              label={METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
              value={formatCurrency(order.amountTendered && order.amountTendered > order.total
                ? order.amountTendered : order.total)}
            />
          )}
          {order.change > 0 && (
            <Row label="CHANGE" value={formatCurrency(order.change)} vStyle={{ ...R.green, ...R.bold }} />
          )}

          {/* Note */}
          {displayNote && (
            <>
              <div style={R.divider} />
              <p style={{ fontSize: 10, fontStyle: 'italic', ...R.muted }}>Note: {displayNote}</p>
            </>
          )}

          <div style={R.rule} />

          {/* Footer */}
          <div style={{ ...R.center, fontSize: 10, ...R.muted, marginTop: 4 }}>
            <p style={{ ...R.bold, color: '#222' }}>*** THANK YOU FOR YOUR PURCHASE ***</p>
            <p style={{ marginTop: 3 }}>Goods are not returnable unless defective.</p>
            <p>Please retain this receipt for reference.</p>
            <p style={{ marginTop: 8, fontSize: 9, color: '#aaa' }}>{order.receiptNumber}</p>
          </div>
        </div>
        </div>{/* end scrollable */}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderTop: '1px solid #e5e7eb', padding: '14px 0', fontSize: 13, fontWeight: 600, color: '#374151', backgroundColor: '#f9fafb', cursor: 'pointer' }}
          >
            <PiPrinter style={{ width: 15, height: 15 }} /> Print
          </button>
          <button
            type="button"
            onClick={onNewSale}
            style={{ flex: 1, border: 'none', borderTop: '1px solid #b20202', padding: '14px 0', fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: '#b20202', cursor: 'pointer' }}
          >
            New Sale
          </button>
        </div>

      </div>{/* end receipt card */}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function POSPaymentModal() {
  const { items, total, subtotal, discountAmount, customer, note,
          discountType, discountValue, clearCart } = usePOSCart();
  const { setActiveView } = usePOSUI();
  const { token, terminal } = usePOSAuth();
  const { notifySale } = usePOSSaleSignal();
  const { selectedPricelist } = usePOSPricelist();

  const [lines,       setLines]       = useState<PaymentLine[]>([]);
  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [inputStr,    setInputStr]    = useState('0');
  // When true, the next digit typed replaces inputStr instead of appending
  const [freshInput,  setFreshInput]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [orderResult, setOrderResult] = useState<POSOrderResponse | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const paidTotal   = lines.reduce((s, l) => s + l.amount, 0);
  const remaining   = total - paidTotal;
  const change      = Math.max(0, paidTotal - total);
  const canValidate = remaining <= 0.01 && lines.length > 0;
  const activeLine  = lines.find((l) => l.id === activeId) ?? null;

  // ── Line helpers ─────────────────────────────────────────────────────────────

  function applyAmount(id: string, amount: number) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, amount } : l)));
  }

  function addMethod(method: string, label: string) {
    // If method already has a line, just select it (no duplicates)
    const existing = lines.find((l) => l.method === method);
    if (existing) {
      setActiveId(existing.id);
      setInputStr(String(existing.amount));
      setFreshInput(true); // ready to replace on first digit
      return;
    }
    const amt = parseFloat(Math.max(0, remaining).toFixed(2));
    const id  = `ln-${Date.now()}`;
    setLines((prev) => [...prev, { id, method, label, amount: amt }]);
    setActiveId(id);
    setInputStr(amt === 0 ? '0' : String(amt));
    setFreshInput(true); // pre-filled amount — first digit replaces it
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (activeId === id) { setActiveId(null); setInputStr('0'); setFreshInput(false); }
  }

  function selectLine(line: PaymentLine) {
    setActiveId(line.id);
    setInputStr(line.amount === 0 ? '0' : String(line.amount));
    setFreshInput(true);
  }

  function setExact() {
    if (!activeId || remaining <= 0) return;
    const amt = parseFloat(remaining.toFixed(2));
    setInputStr(String(amt));
    setFreshInput(false);
    applyAmount(activeId, amt);
  }

  // ── Numpad callbacks ─────────────────────────────────────────────────────────

  const pushDigit = useCallback((d: string) => {
    if (!activeId) return;
    let next: string;
    if (freshInput) {
      // First keystroke after selecting — replace the pre-filled value
      next = d === '.' ? '0.' : d === '0' ? '0' : d;
      setFreshInput(false);
    } else if (d === '.') {
      next = inputStr.includes('.') ? inputStr : (inputStr === '0' ? '0.' : inputStr + '.');
    } else {
      next = inputStr === '0' ? d : inputStr.length >= 10 ? inputStr : inputStr + d;
    }
    setInputStr(next);
    applyAmount(activeId, parseFloat(next) || 0);
  }, [activeId, inputStr, freshInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushBackspace = useCallback(() => {
    if (!activeId) return;
    setFreshInput(false);
    const next = inputStr.length > 1 ? inputStr.slice(0, -1) : '0';
    setInputStr(next);
    applyAmount(activeId, parseFloat(next) || 0);
  }, [activeId, inputStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushClear = useCallback(() => {
    if (!activeId) return;
    setInputStr('0');
    setFreshInput(false);
    applyAmount(activeId, 0);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addQuick = useCallback((delta: number) => {
    if (!activeId) return;
    const base = parseFloat(inputStr) || 0;
    const next = parseFloat((base + delta).toFixed(2));
    setInputStr(String(next));
    setFreshInput(false);
    applyAmount(activeId, next);
  }, [activeId, inputStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Physical keyboard ────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key))       { e.preventDefault(); pushDigit(e.key); }
      else if (e.key === '.')           { e.preventDefault(); pushDigit('.'); }
      else if (e.key === 'Backspace')   { e.preventDefault(); pushBackspace(); }
      else if (e.key === 'Delete')      { e.preventDefault(); pushClear(); }
      else if (e.key === 'Enter' && canValidate) { e.preventDefault(); handleValidate(); }
      else if (e.key === 'Escape')      { e.preventDefault(); setActiveView('sell'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushDigit, pushBackspace, pushClear, canValidate]); // eslint-disable-line

  // ── Validate ─────────────────────────────────────────────────────────────────

  async function handleValidate() {
    if (!canValidate || loading || !token) return;
    setLoading(true);
    try {
      const orderItems = items.map((item) => ({
        subProductId: item.subProductId,
        productId:    item.productId,
        sizeId:       item.sizeId || undefined,
        quantity:     item.quantity,
        price:        item.price,
        discount:     item.discount,
        sku:          item.sku,
        variant:      item.variant,
        name:         item.name,
      }));

      let paymentMethod: string;
      let amountTendered = 0;
      let splitPayments: { method: string; amount: number }[] = [];

      if (lines.length === 1) {
        paymentMethod  = lines[0].method;
        amountTendered = lines[0].amount;
      } else {
        paymentMethod  = 'split';
        splitPayments  = lines.map((l) => ({ method: l.method, amount: l.amount }));
        amountTendered = lines.find((l) => l.method === 'cash')?.amount ?? 0;
      }

      const result = await posApi.createOrder(token, {
        items:        orderItems,
        customer,
        paymentMethod,
        amountTendered,
        splitPayments,
        discountType:  discountValue > 0 ? discountType  : undefined,
        discountValue: discountValue > 0 ? discountValue : 0,
        note:          note || undefined,
        terminalType:  terminal ?? 'retail',
        pricelistId:   selectedPricelist?._id ?? undefined,
      });
      setOrderResult(result.order);
      // Signal session bar + product grid to refresh their data
      notifySale();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  function handleNewSale() {
    clearCart();
    setActiveView('sell');
    setOrderResult(null);
    setLines([]);
    setActiveId(null);
    setInputStr('0');
    setFreshInput(false);
  }

  // ── Receipt ───────────────────────────────────────────────────────────────────

  if (orderResult) return <ReceiptScreen order={orderResult} paymentLines={lines} onNewSale={handleNewSale} />;

  // ── Numpad display value ──────────────────────────────────────────────────────

  const displayValue = activeId
    ? formatCurrency(parseFloat(inputStr) || 0)
    : '—';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex bg-[#f0f0f0]">

      {/* ══ LEFT PANEL ════════════════════════════════════════════════════════ */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-gray-200 bg-[#f0f0f0]">

        {/* Payment method buttons */}
        <div className="flex-1 overflow-y-auto space-y-1.5 px-3 pt-3">
          {METHODS.map((m) => {
            const inUse = lines.some((l) => l.method === m.value);
            const isActive = activeLine?.method === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => addMethod(m.value, m.label)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-semibold shadow-sm transition-all active:scale-[0.98]',
                  isActive
                    ? 'border-[#b20202] bg-red-50 text-[#b20202]'
                    : inUse
                    ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-[#b20202] hover:shadow-md'
                )}
              >
                <span className={isActive ? 'text-[#b20202]' : inUse ? 'text-green-600' : 'text-gray-400'}>
                  {m.icon}
                </span>
                <span className="flex-1">{m.label}</span>
                {inUse && (
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wide',
                    isActive ? 'text-[#b20202]' : 'text-green-600'
                  )}>
                    {isActive ? 'editing' : 'added'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Customer / Invoice */}
        <div className="grid grid-cols-2 gap-1.5 border-t border-gray-200 px-3 py-2">
          <button type="button"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <PiUser className="h-3.5 w-3.5" /> Customer
          </button>
          <button type="button"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <PiFileText className="h-3.5 w-3.5" /> Invoice
          </button>
        </div>

        {/* ── Calculator display ── */}
        <div className="mx-3 mb-2 overflow-hidden rounded-xl bg-gray-900">
          <div className="px-4 pb-3 pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {activeLine ? activeLine.label : 'Select a method'}
            </p>
            <p className={cn(
              'mt-0.5 text-right text-3xl font-bold tabular-nums transition-colors',
              freshInput ? 'text-gray-400' : 'text-white'
            )}>
              {displayValue}
            </p>
          </div>

          {/* Exact shortcut inside display */}
          {activeId && remaining > 0.01 && (
            <button
              type="button"
              onClick={setExact}
              className="flex w-full items-center justify-between border-t border-gray-700 px-4 py-2 text-xs font-semibold text-green-400 hover:bg-gray-800"
            >
              <span className="flex items-center gap-1.5">
                <PiArrowRight className="h-3 w-3" /> Exact amount
              </span>
              <span>{formatCurrency(remaining)}</span>
            </button>
          )}
        </div>

        {/* ── Numpad ── */}
        <div className="shrink-0 px-3 pb-2">
          <div className="grid grid-cols-4 gap-1.5">
            {/* Rows 1-3: digits + quick-add */}
            {(['1','2','3'] as const).map((d) => (
              <button key={d} type="button" onClick={() => pushDigit(d)}
                className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95">{d}</button>
            ))}
            <button type="button" onClick={() => addQuick(QUICK[0])} disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-600 active:scale-95 disabled:opacity-30">
              +{QUICK[0] / 1000}k
            </button>

            {(['4','5','6'] as const).map((d) => (
              <button key={d} type="button" onClick={() => pushDigit(d)}
                className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95">{d}</button>
            ))}
            <button type="button" onClick={() => addQuick(QUICK[1])} disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-600 active:scale-95 disabled:opacity-30">
              +{QUICK[1] / 1000}k
            </button>

            {(['7','8','9'] as const).map((d) => (
              <button key={d} type="button" onClick={() => pushDigit(d)}
                className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95">{d}</button>
            ))}
            <button type="button" onClick={() => addQuick(QUICK[2])} disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl bg-green-500 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-600 active:scale-95 disabled:opacity-30">
              +{QUICK[2] / 1000}k
            </button>

            {/* Row 4 */}
            <button type="button" onClick={pushClear} disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-sm font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-200 active:scale-95 disabled:opacity-30">
              C
            </button>
            <button type="button" onClick={() => pushDigit('0')}
              className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-50 active:scale-95">
              0
            </button>
            <button type="button" onClick={() => pushDigit('.')}
              className="flex h-12 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-base font-semibold text-orange-500 shadow-sm transition-all hover:bg-orange-100 active:scale-95">
              .
            </button>
            <button type="button" onClick={pushBackspace} disabled={!activeId}
              className="flex h-12 items-center justify-center rounded-xl border border-red-200 bg-red-100 text-red-600 shadow-sm transition-all hover:bg-red-200 active:scale-95 disabled:opacity-30">
              ⌫
            </button>
          </div>
        </div>

        {/* ── Back + Validate ── */}
        <div className="grid grid-cols-2 border-t border-gray-300">
          <button type="button" onClick={() => setActiveView('sell')}
            className="flex items-center justify-center gap-2 bg-gray-200 py-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300">
            <PiArrowLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" onClick={handleValidate}
            disabled={!canValidate || loading}
            className={cn(
              'flex items-center justify-center gap-2 py-4 text-sm font-bold text-white transition-all hover:opacity-90',
              canValidate ? 'opacity-100' : 'opacity-40 cursor-not-allowed'
            )}
            style={{ backgroundColor: '#b20202' }}>
            {loading
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : 'Validate'
            }
          </button>
        </div>
      </div>

      {/* ══ RIGHT PANEL ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col bg-white">

        {/* Order total */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Order Total</p>
          <p className={cn(
            'text-6xl font-bold tabular-nums transition-colors',
            canValidate ? 'text-green-600' : 'text-gray-900'
          )}>
            {formatCurrency(total)}
          </p>
          {change > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5">
              <span className="text-sm font-semibold text-green-600">
                Change: {formatCurrency(change)}
              </span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="mt-2 text-sm text-gray-400">
              Subtotal {formatCurrency(subtotal)} − discount {formatCurrency(discountAmount)}
            </div>
          )}
        </div>

        {/* Payment lines + remaining */}
        <div className="shrink-0 space-y-1.5 border-t border-gray-100 px-8 pb-8 pt-5">

          {/* Remaining */}
          <div className={cn(
            'flex items-center justify-between rounded-xl px-5 py-3 text-sm font-bold transition-colors',
            remaining <= 0.01
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          )}>
            <span>{remaining <= 0.01 ? 'Fully paid' : 'Remaining'}</span>
            <span>{formatCurrency(Math.max(0, remaining))}</span>
          </div>

          {/* Applied lines */}
          {lines.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
              Select a payment method on the left to continue
            </div>
          ) : (
            lines.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => selectLine(line)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-5 py-3.5 text-left text-sm transition-all',
                  activeId === line.id
                    ? 'border-[#b20202] bg-red-50 shadow-sm'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                )}
              >
                <span className={cn(
                  'font-semibold',
                  activeId === line.id ? 'text-[#b20202]' : 'text-gray-800'
                )}>
                  {line.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-base font-bold tabular-nums',
                    activeId === line.id ? 'text-[#b20202]' : 'text-gray-700'
                  )}>
                    {activeId === line.id
                      ? formatCurrency(parseFloat(inputStr) || 0)
                      : formatCurrency(line.amount)}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeLine(line.id); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), removeLine(line.id))}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
                  >
                    <PiX className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
