'use client';

import { useState } from 'react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type { POSRefundRecord, POSRefundResponse } from '@/app/shared/point-of-sale/types';
import {
  PiInfo,
  PiReceipt,
  PiPrinter,
  PiBackspace,
  PiClockCounterClockwise,
  PiX,
  PiCheckCircle,
  PiWarning,
  PiCurrencyNgn,
  PiCreditCard,
  PiBank,
  PiDeviceMobile,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

// ── Local cn ─────────────────────────────────────────────────────────────────
function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
}

interface DetailOrder {
  _id: string;
  receiptNumber?: string;
  orderNumber?: string;
  total: number;
  paymentMethod: string;
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  placedAt: string;
  createdAt: string;
  posStaff?: { _id: string; firstName: string; lastName: string; posName?: string };
  isVoided?: boolean;
  paymentStatus?: string;
  // Use a looser type so both POSRefundRecord and HistoryRefund are accepted
  refunds?: (POSRefundRecord & { paymentMethod?: string })[];
  items?: HistoryItem[];
  status?: string;
}

type RefundMode = 'qty' | 'disc' | 'price';

interface RefundLine {
  qty: number;
  discPct: number;
  unitPrice: number;
  restock: boolean;
  reason: string;
}

const REFUND_METHODS = [
  { value: 'cash',          label: 'Cash',    icon: <PiCurrencyNgn className="h-4 w-4" /> },
  { value: 'card',          label: 'Card',    icon: <PiCreditCard   className="h-4 w-4" /> },
  { value: 'bank_transfer', label: 'Bank',    icon: <PiBank         className="h-4 w-4" /> },
  { value: 'mobile_money',  label: 'Mobile',  icon: <PiDeviceMobile className="h-4 w-4" /> },
];

function formatOrderDate(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

// ── Helpers: compute already-refunded qty per item index ──────────────────────

function computeRefundedMap(refunds?: POSRefundRecord[]): Record<number, number> {
  const map: Record<number, number> = {};
  if (!refunds) return map;
  for (const r of refunds) {
    for (const line of r.items) {
      const idx = line.orderItemIndex;
      map[idx] = (map[idx] || 0) + line.quantity;
    }
  }
  return map;
}

// ── Refund badge component ────────────────────────────────────────────────────

function QtyBadge({
  original,
  refunded,
  remaining,
  isActive,
  isSelected,
  mode,
  modeVal,
}: {
  original: number;
  refunded: number;
  remaining: number;
  isActive: boolean;
  isSelected: boolean;
  mode: RefundMode;
  modeVal: string | null;
}) {
  if (isSelected && modeVal !== null && mode === 'qty') {
    return (
      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-amber-700">
        {modeVal}
      </span>
    );
  }
  if (isActive && mode === 'qty') {
    return (
      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-[#b20202] bg-[#b20202]/10 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#b20202]">
        {remaining}
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-gray-700">
      {remaining}
    </span>
  );
}

// ── Refund History Row ────────────────────────────────────────────────────────

function RefundHistoryRow({ refund }: { refund: POSRefundRecord }) {
  const [expanded, setExpanded] = useState(false);
  const cashierName = refund.refundedBy
    ? (refund.refundedBy.posName || `${refund.refundedBy.firstName} ${refund.refundedBy.lastName}`)
    : '—';
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900">
            {refund.receiptNumber || 'Refund'}
          </p>
          <p className="text-[10px] text-gray-400">
            {formatOrderDate(refund.refundedAt)} · {cashierName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-[#b20202]">
            −{formatCurrency(refund.totalRefunded)}
          </p>
          {refund.paymentMethod && (
            <p className="text-[10px] capitalize text-gray-400">
              {refund.paymentMethod.replace(/_/g, ' ')}
            </p>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-dashed border-gray-100 bg-gray-50/50 px-4 py-2">
          {refund.items.map((line, li) => (
            <div key={li} className="flex items-center justify-between py-1 text-xs text-gray-600">
              <span>
                #{line.orderItemIndex + 1} × {line.quantity}
                {line.discPct > 0 && (
                  <span className="ml-1 text-[#b20202]">(−{line.discPct}% disc)</span>
                )}
                {line.reason && <span className="ml-1 text-gray-400">· {line.reason}</span>}
              </span>
              <span className="tabular-nums font-medium text-gray-800">
                {formatCurrency(line.amount)}
              </span>
            </div>
          ))}
          {refund.reason && (
            <p className="mt-1 border-t border-gray-200 pt-1 text-[10px] italic text-gray-400">
              Note: {refund.reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Return Confirmation Dialog ────────────────────────────────────────────────

interface PendingReturnLine {
  orderItemIndex: number;
  quantity: number;
  discPct?: number;
  unitPrice?: number;
  restock?: boolean;
  reason?: string;
}

function ReturnConfirmDialog({
  order,
  lines,
  items,
  total,
  defaultMethod,
  onConfirm,
  onCancel,
}: {
  order: DetailOrder;
  lines: PendingReturnLine[];
  items: HistoryItem[];
  total: number;
  defaultMethod: string;
  onConfirm: (method: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [method,     setMethod]     = useState(defaultMethod || order.paymentMethod || 'cash');
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Return Products</h2>
            <p className="text-xs text-gray-400">{order.receiptNumber} · {order.orderNumber}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Items to return */}
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-5 py-2">Product</th>
                <th className="px-3 py-2 text-center">Ordered</th>
                <th className="px-3 py-2 text-center">Returning</th>
                <th className="px-3 py-2 text-right">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line, i) => {
                const item = items[line.orderItemIndex];
                const price = line.unitPrice ?? item?.priceAtPurchase ?? 0;
                const amt   = price * line.quantity * (1 - (line.discPct ?? 0) / 100);
                return (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-gray-900 truncate max-w-[180px]">
                        {item?.name}{item?.variant ? ` · ${item.variant}` : ''}
                      </p>
                      {(line.discPct ?? 0) > 0 && (
                        <p className="text-[10px] text-[#b20202]">{line.discPct}% deduction applied</p>
                      )}
                      {line.reason && (
                        <p className="text-[10px] text-gray-400 italic">{line.reason}</p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        {line.restock === false ? '⚠ Not restocked' : '✓ Restocked'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-gray-500">{item?.quantity ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-red-50 text-sm font-bold tabular-nums text-[#b20202]">
                        {line.quantity}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                      {formatCurrency(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Options */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-4">
          {/* Refund via */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Refund via
            </label>
            <div className="grid grid-cols-4 gap-2">
              {REFUND_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition-all',
                    method === m.value
                      ? 'border-[#b20202] bg-red-50 text-[#b20202]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Global reason */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Return reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer changed mind, wrong item delivered…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20"
            />
          </div>
        </div>

        {/* Total + actions */}
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total return amount</span>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try { await onConfirm(method, reason); }
                finally { setSubmitting(false); }
              }}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: '#b20202' }}
            >
              {submitting
                ? <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing…
                  </span>
                : 'Confirm Return'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Return Receipt Screen ─────────────────────────────────────────────────────

function ReturnReceiptScreen({
  result,
  originalOrder,
  items,
  onClose,
}: {
  result: POSRefundResponse;
  originalOrder: DetailOrder;
  items: HistoryItem[];
  onClose: () => void;
}) {
  const dateStr = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  function handlePrint() {
    const win = window.open('', '_blank', 'width=400,height=700,scrollbars=yes');
    if (!win) return;
    const rows = result.refundLines.map((line) => {
      const item = items[line.orderItemIndex];
      return `<tr>
        <td style="padding:4px 0;border-bottom:1px solid #eee">${item?.name ?? ''}${item?.variant ? ` · ${item.variant}` : ''}</td>
        <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee">${line.quantity}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${line.unitPrice?.toLocaleString('en-NG',{style:'currency',currency:'NGN'})}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${line.amount?.toLocaleString('en-NG',{style:'currency',currency:'NGN'})}</td>
      </tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>${result.returnNumber}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;width:380px;margin:0 auto}</style>
    </head><body>
      <div style="text-align:center;margin-bottom:12px">
        <strong style="font-size:14px;letter-spacing:2px">DRINKS HARBOUR</strong><br>
        <span style="font-size:11px;font-weight:bold;color:#b20202">RETURN RECEIPT</span>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px;margin-bottom:8px">
        <tr><td style="color:#555;width:90px">Return #</td><td><strong>${result.returnNumber}</strong></td></tr>
        <tr><td style="color:#555">Original</td><td>${originalOrder.receiptNumber}</td></tr>
        <tr><td style="color:#555">Date</td><td>${dateStr}</td></tr>
        <tr><td style="color:#555">Refund via</td><td style="text-transform:capitalize">${(result.refundRecord?.paymentMethod || 'cash').replace(/_/g,' ')}</td></tr>
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px">
        <thead><tr style="color:#888"><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:2px solid #333;margin:8px 0">
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;color:#b20202">
        <span>TOTAL RETURNED</span><span>−${result.totalRefunded?.toLocaleString('en-NG',{style:'currency',currency:'NGN'})}</span>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <div style="text-align:center;font-size:10px;color:#666;margin-top:8px">
        This is your return confirmation.<br>Please retain for your records.
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Green success header */}
        <div className="flex items-center gap-3 bg-green-600 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <PiCheckCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white">Return Processed</p>
            <p className="text-sm text-green-100">{result.returnNumber}</p>
          </div>
        </div>

        {/* Receipt body */}
        <div className="overflow-y-auto max-h-[55vh]">
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, padding: '20px 20px 4px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.1em' }}>DRINKS HARBOUR</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#b20202' }}>RETURN RECEIPT</p>
            </div>
            <div style={{ borderTop: '1px dashed #bbb', margin: '8px 0' }} />
            {/* Meta */}
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              {[
                ['Return #',  result.returnNumber],
                ['Original',  originalOrder.receiptNumber || '—'],
                ['Date',      dateStr],
                ['Refund via', (result.refundRecord?.paymentMethod || 'cash').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', lineHeight: '1.7' }}>
                  <span style={{ color: '#555' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px dashed #bbb', margin: '8px 0' }} />
            {/* Items */}
            <div style={{ marginBottom: 8 }}>
              {result.refundLines.map((line, i) => {
                const item = items[line.orderItemIndex];
                return (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 11 }}>
                      <span style={{ flex: 1, paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item?.name}{item?.variant ? ` · ${item.variant}` : ''}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', color: '#b20202' }}>−{formatCurrency(line.amount)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#555', paddingLeft: 8 }}>
                      {line.quantity} × {formatCurrency(line.unitPrice ?? 0)}
                      {(line.discPct ?? 0) > 0 && ` (−${line.discPct}%)`}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: '2px solid #222', margin: '8px 0' }} />
            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
              <span>TOTAL RETURNED</span>
              <span style={{ color: '#b20202' }}>−{formatCurrency(result.totalRefunded)}</span>
            </div>
            {result.cumulativeRefunded > result.totalRefunded && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginTop: 4 }}>
                <span>Cumulative refunded</span>
                <span>−{formatCurrency(result.cumulativeRefunded)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px dashed #bbb', margin: '8px 0' }} />
            <p style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
              Thank you for your patience.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <PiPrinter className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90"
            style={{ backgroundColor: '#b20202' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function POSOrderDetail({
  order,
  onRefund,
  onLoadOrder,
  onClose,
}: {
  order: DetailOrder;
  onRefund: (order: DetailOrder, lines: { orderItemIndex: number; quantity: number; discPct?: number; unitPrice?: number; restock?: boolean; reason?: string }[], refundPaymentMethod?: string) => void;
  onLoadOrder: (order: DetailOrder) => void;
  onClose: () => void;
}) {
  const { token } = usePOSAuth();

  const [activeTab, setActiveTab] = useState<'details' | 'invoice' | 'returns'>('details');
  const [refundData, setRefundData] = useState<Record<number, RefundLine>>({});
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [numInput, setNumInput] = useState('0');
  const [refundMode, setRefundMode] = useState<RefundMode>('qty');
  const [fresh, setFresh] = useState(false);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState('');

  // Odoo-style two-step: confirm dialog → return receipt
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [returnResult,      setReturnResult]      = useState<POSRefundResponse | null>(null);

  const items = order.items || [];
  const refunds: POSRefundRecord[] = (order.refunds as POSRefundRecord[]) || [];
  const isPaid = !order.isVoided;

  // Compute already-refunded qty per item index
  const refundedMap = computeRefundedMap(refunds);

  function getRemainingQty(idx: number): number {
    const item = items[idx];
    if (!item) return 0;
    const refunded = refundedMap[idx] || 0;
    return Math.max(0, item.quantity - refunded);
  }

  function isFullyRefunded(idx: number): boolean {
    return getRemainingQty(idx) <= 0;
  }

  const activeItem = activeIdx !== null ? items[activeIdx] : null;

  // ── Derived refund lines ──────────────────────────────────────────────────

  const refundLines = Object.entries(refundData)
    .filter(([, d]) => d.qty > 0)
    .map(([idx]) => {
      const d = refundData[Number(idx)];
      return {
        orderItemIndex: Number(idx),
        quantity: d.qty,
        discPct: d.discPct > 0 ? d.discPct : undefined,
        unitPrice: d.unitPrice > 0 ? d.unitPrice : undefined,
        restock: d.restock,
        reason: d.reason || undefined,
      };
    });

  const refundTotal = Object.entries(refundData).reduce((sum, [idx, d]) => {
    const item = items[Number(idx)];
    if (!item || d.qty <= 0) return sum;
    const price = d.unitPrice > 0 ? d.unitPrice : item.priceAtPurchase;
    return sum + price * d.qty * (1 - d.discPct / 100);
  }, 0);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getLineData(idx: number): RefundLine {
    const remaining = getRemainingQty(idx);
    return refundData[idx] ?? {
      qty: remaining,
      discPct: 0,
      unitPrice: 0,
      restock: true,
      reason: '',
    };
  }

  function getModeValue(idx: number): string {
    const d = getLineData(idx);
    if (refundMode === 'qty') return String(d.qty);
    if (refundMode === 'disc') return String(d.discPct);
    if (refundMode === 'price') return d.unitPrice > 0 ? String(d.unitPrice) : String(items[idx]?.priceAtPurchase ?? 0);
    return '0';
  }

  function applyInput(idx: number, raw: string) {
    const val = parseFloat(raw) || 0;
    const item = items[idx];
    const remaining = getRemainingQty(idx);
    setRefundData((prev) => {
      const existing = prev[idx] ?? { qty: remaining, discPct: 0, unitPrice: 0, restock: true, reason: '' };
      if (refundMode === 'qty') return { ...prev, [idx]: { ...existing, qty: Math.min(Math.max(0, Math.round(val)), remaining) } };
      if (refundMode === 'disc') return { ...prev, [idx]: { ...existing, discPct: Math.min(Math.max(0, val), 100) } };
      if (refundMode === 'price') return { ...prev, [idx]: { ...existing, unitPrice: Math.max(0, val) } };
      return prev;
    });
  }

  // ── Item selection ────────────────────────────────────────────────────────

  function handleSelectItem(idx: number) {
    if (isFullyRefunded(idx)) return;
    const item = items[idx];
    if (!item) return;

    if (activeIdx === idx) {
      setRefundData((prev) => { const n = { ...prev }; delete n[idx]; return n; });
      setActiveIdx(null);
      setNumInput('0');
      return;
    }

    const d = getLineData(idx);
    setRefundData((prev) => ({ ...prev, [idx]: d }));
    setActiveIdx(idx);
    setNumInput(getModeValue(idx));
    setFresh(true);
  }

  function handleToggleRestock(idx: number) {
    setRefundData((prev) => {
      const existing = prev[idx];
      if (!existing) return prev;
      return { ...prev, [idx]: { ...existing, restock: !existing.restock } };
    });
  }

  function handleReasonChange(idx: number, reason: string) {
    setRefundData((prev) => {
      const existing = prev[idx];
      if (!existing) return prev;
      return { ...prev, [idx]: { ...existing, reason } };
    });
  }

  function changeMode(m: RefundMode) {
    setRefundMode(m);
    if (activeIdx !== null) {
      setNumInput(getModeValue(activeIdx));
      setFresh(true);
    }
  }

  // ── Numpad ────────────────────────────────────────────────────────────────

  function pushDigit(d: string) {
    if (activeIdx === null) return;
    let next: string;
    if (d === '⌫') {
      next = numInput.length > 1 ? numInput.slice(0, -1) : '0';
      setFresh(false);
    } else if (d === '.') {
      next = numInput.includes('.') ? numInput : (numInput || '0') + '.';
      setFresh(false);
    } else if (fresh) {
      next = d === '0' ? '0' : d;
      setFresh(false);
    } else {
      next = numInput === '0' ? d : numInput.length >= 8 ? numInput : numInput + d;
    }
    setNumInput(next);
    applyInput(activeIdx, next);
  }

  // ── Print ─────────────────────────────────────────────────────────────────

  function handlePrint() {
    const cashierName = order.posStaff
      ? (order.posStaff.posName || `${order.posStaff.firstName} ${order.posStaff.lastName}`)
      : '—';
    const customerName = (order.customer?.firstName && order.customer.firstName !== 'Walk-in')
      ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
      : 'Walk-in';
    const win = window.open('', '_blank', 'width=400,height=700,scrollbars=yes');
    if (!win) return;
    const rows = items.map(it =>
      `<tr>
        <td style="padding:4px 0;border-bottom:1px solid #eee">${it.name}${it.variant ? ` · ${it.variant}` : ''}</td>
        <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee">${it.quantity}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${it.priceAtPurchase?.toLocaleString('en-NG',{style:'currency',currency:'NGN'})}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${it.itemSubtotal?.toLocaleString('en-NG',{style:'currency',currency:'NGN'})}</td>
      </tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>${order.receiptNumber}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;width:380px;margin:0 auto}</style>
    </head><body>
      <div style="text-align:center;margin-bottom:12px">
        <strong style="font-size:14px;letter-spacing:2px">DRINKS HARBOUR</strong><br>
        <span style="font-size:10px;color:#555">39 Gana St, Maitama, Abuja</span>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px;margin-bottom:8px">
        <tr><td style="color:#555;width:90px">Receipt</td><td><strong>${order.receiptNumber || '—'}</strong></td></tr>
        <tr><td style="color:#555">Order</td><td>${order.orderNumber || '—'}</td></tr>
        <tr><td style="color:#555">Date</td><td>${new Date(order.placedAt).toLocaleString('en-GB')}</td></tr>
        <tr><td style="color:#555">Cashier</td><td>${cashierName}</td></tr>
        ${customerName !== 'Walk-in' ? `<tr><td style="color:#555">Customer</td><td>${customerName}</td></tr>` : ''}
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px">
        <thead><tr style="color:#888"><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:2px solid #333;margin:8px 0">
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px">
        <span>TOTAL</span><span>${order.total?.toLocaleString('en-NG',{style:'currency',currency:'NGN'})}</span>
      </div>
      ${refunds.length > 0 ? `
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <div style="font-size:10px;color:#b20202;margin-top:4px">
        ${refunds.map(r => `${r.receiptNumber}: −${r.totalRefunded.toLocaleString('en-NG',{style:'currency',currency:'NGN'})}`).join('<br>')}
      </div>` : ''}
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <div style="text-align:center;font-size:10px;color:#666;margin-top:8px">
        Thank you for your purchase!<br>Goods not returnable unless defective.
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  // ── Submit refund — Odoo flow: open dialog first ──────────────────────────

  function handleRefundClick() {
    if (refundLines.length === 0) return;
    setShowConfirmDialog(true);
  }

  async function handleConfirmReturn(method: string, globalReason: string) {
    if (!token) { toast.error('Not authenticated'); return; }
    try {
      const linesWithReason = refundLines.map((l) => ({
        ...l,
        reason: l.reason || globalReason || undefined,
      }));
      const result = await posApi.refundOrder(
        token,
        order._id,
        linesWithReason,
        globalReason || 'Return from POS',
        method,
      );
      setShowConfirmDialog(false);
      setReturnResult(result);
      setRefundData({});
      setActiveIdx(null);
      setNumInput('0');
      // Also notify parent to refresh order list
      onRefund(order, [], method);
    } catch (err: any) {
      toast.error(err.message || 'Return failed');
      throw err; // re-throw so dialog knows to stop spinner
    }
  }

  if (!order) return null;

  const cashierName = order.posStaff
    ? (order.posStaff.posName || `${order.posStaff.firstName} ${order.posStaff.lastName}`)
    : '—';
  const customerName = (order.customer?.firstName && order.customer.firstName !== 'Walk-in')
    ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
    : null;

  // Count refunded items for status badge
  const totalRefunded = refunds.reduce((s, r) => s + r.totalRefunded, 0);
  const isPartiallyRefunded = totalRefunded > 0 && totalRefunded < (order.total || 0);
  const isFullyRefundedStatus = totalRefunded > 0 && totalRefunded >= (order.total || 0);

  return (
    <div className="flex h-full flex-col bg-white">

      {/* ── Tabs ── */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id: 'details', label: 'Details', icon: <PiInfo className="h-3.5 w-3.5" /> },
          { id: 'invoice', label: 'Invoice', icon: <PiReceipt className="h-3.5 w-3.5" /> },
          { id: 'returns', label: `Returns${refunds.length ? ` (${refunds.length})` : ''}`, icon: <PiClockCounterClockwise className="h-3.5 w-3.5" /> },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1 py-2.5 transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-[#b20202] text-[#b20202]'
                : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ══ DETAILS TAB ══ */}
      {activeTab === 'details' && (
        <>
          {/* Status badge */}
          {isFullyRefundedStatus && (
            <div className="shrink-0 bg-red-50 px-4 py-2 text-xs font-semibold text-[#b20202]">
              Fully refunded — {refunds.length} return{refunds.length > 1 ? 's' : ''}
            </div>
          )}
          {isPartiallyRefunded && (
            <div className="shrink-0 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
              Partially refunded — {formatCurrency(totalRefunded)} returned
            </div>
          )}

          {/* Items list */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="mt-12 text-center text-sm text-gray-400">No item details available</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((item, i) => {
                  const isActive = activeIdx === i;
                  const lineData = refundData[i];
                  const remaining = getRemainingQty(i);
                  const refunded = refundedMap[i] || 0;
                  const isSelected = !!lineData && lineData.qty > 0;
                  const modeVal = isActive ? numInput : (lineData ? getModeValue(i) : null);
                  const fullyRefunded = isFullyRefunded(i);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => isPaid && !fullyRefunded && handleSelectItem(i)}
                      disabled={!isPaid || fullyRefunded}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors relative',
                        isActive ? 'bg-red-50 border-l-4 border-l-[#b20202]'
                          : isSelected ? 'bg-orange-50 border-l-4 border-l-amber-400'
                          : fullyRefunded ? 'bg-gray-50 border-l-4 border-l-gray-300 opacity-60'
                          : 'bg-white border-l-4 border-l-transparent hover:bg-gray-50',
                        !isPaid && 'cursor-default',
                        fullyRefunded && 'cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-semibold truncate',
                            isActive ? 'text-[#b20202]' : fullyRefunded ? 'text-gray-400' : 'text-gray-900'
                          )}>
                            {item.name}{item.variant ? ` - ${item.variant}` : ''}
                          </p>
                          {/* Odoo-style: original qty | refunded | remaining */}
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                            {/* Three-part qty display */}
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="tabular-nums text-gray-400">Ord: {item.quantity}</span>
                              {refunded > 0 && (
                                <span className="tabular-nums text-[#b20202]">Ret: {refunded}</span>
                              )}
                              {!fullyRefunded && (
                                <span className={cn(
                                  'tabular-nums font-semibold',
                                  remaining > 0 ? 'text-emerald-600' : 'text-gray-300'
                                )}>
                                  Rem: {remaining}
                                </span>
                              )}
                            </div>
                            {/* Qty badge (mode display) */}
                            {(isActive || isSelected) && (
                              <>
                                <span className="text-gray-300">|</span>
                                <QtyBadge
                                  original={item.quantity}
                                  refunded={refunded}
                                  remaining={remaining}
                                  isActive={isActive}
                                  isSelected={isSelected}
                                  mode={refundMode}
                                  modeVal={modeVal}
                                />
                              </>
                            )}
                          </div>
                          {/* Odoo-style price row */}
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                            <span className={cn(
                              'tabular-nums',
                              isActive && refundMode === 'price' ? 'font-bold text-[#b20202]' : ''
                            )}>
                              {formatCurrency(item.priceAtPurchase)} / Units
                            </span>
                            {(item.discountAmount ?? 0) > 0 && (
                              <span className="text-[#b20202]">
                                (disc −{formatCurrency(item.discountAmount!)})
                              </span>
                            )}
                          </div>
                          {/* Odoo-style: restock toggle + reason (when selected) */}
                          {isSelected && lineData && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={lineData.restock}
                                  onChange={() => handleToggleRestock(i)}
                                  className="h-3 w-3 accent-[#b20202]"
                                />
                                Restock
                              </label>
                              <input
                                type="text"
                                value={lineData.reason}
                                onChange={(e) => handleReasonChange(i, e.target.value)}
                                placeholder="Reason..."
                                className="h-6 min-w-0 flex-1 rounded border border-gray-200 bg-white px-1.5 text-[10px] text-gray-600 outline-none focus:border-[#b20202]"
                                maxLength={80}
                              />
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          'shrink-0 text-sm font-semibold',
                          fullyRefunded ? 'text-gray-300 line-through' : 'text-gray-800'
                        )}>
                          {formatCurrency(item.itemSubtotal)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Total row */}
          <div className="shrink-0 border-t border-gray-200 px-5 py-3">
            <div className="flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            {order.paymentMethod && (
              <p className="text-xs capitalize text-gray-400">{order.paymentMethod.replace(/_/g, ' ')}</p>
            )}
            {totalRefunded > 0 && (
              <div className="mt-1 flex justify-between text-xs text-[#b20202]">
                <span>Already refunded</span>
                <span className="tabular-nums">−{formatCurrency(totalRefunded)}</span>
              </div>
            )}
          </div>

          {isPaid ? (
            <>
              {/* ── Numpad with mode buttons ── */}
              <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-2">
                {/* Calculator display */}
                <div className={cn(
                  'mb-2 rounded-xl px-4 py-2 text-center',
                  activeItem ? 'bg-white ring-1 ring-[#b20202]/25' : 'bg-white'
                )}>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {activeItem
                      ? `${activeItem.name}${activeItem.variant ? ` · ${activeItem.variant}` : ''}`
                      : 'Tap an item to select for return'}
                  </p>
                  <p className={cn('text-xl font-bold tabular-nums', activeItem ? 'text-[#b20202]' : 'text-gray-300')}>
                    {activeItem
                      ? refundMode === 'qty' ? numInput
                        : refundMode === 'disc' ? `${numInput}%`
                        : formatCurrency(parseFloat(numInput) || 0)
                      : '—'}
                  </p>
                </div>

                {/* 4-column grid */}
                <div className="grid grid-cols-4 gap-1">
                  {['1', '2', '3'].map(d => (
                    <button key={d} type="button" disabled={activeIdx === null} onClick={() => pushDigit(d)}
                      className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30">{d}</button>
                  ))}
                  <button type="button" onClick={() => changeMode('qty')}
                    className={cn('flex h-10 items-center justify-center rounded-lg text-xs font-bold transition-colors',
                      refundMode === 'qty' ? 'border-2 border-[#b20202] bg-white text-[#b20202]' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                    Qty
                  </button>
                  {['4', '5', '6'].map(d => (
                    <button key={d} type="button" disabled={activeIdx === null} onClick={() => pushDigit(d)}
                      className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30">{d}</button>
                  ))}
                  <button type="button" onClick={() => changeMode('disc')}
                    className={cn('flex h-10 items-center justify-center rounded-lg text-xs font-bold transition-colors',
                      refundMode === 'disc' ? 'border-2 border-[#b20202] bg-white text-[#b20202]' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                    % Disc
                  </button>
                  {['7', '8', '9'].map(d => (
                    <button key={d} type="button" disabled={activeIdx === null} onClick={() => pushDigit(d)}
                      className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30">{d}</button>
                  ))}
                  <button type="button" onClick={() => changeMode('price')}
                    className={cn('flex h-10 items-center justify-center rounded-lg text-xs font-bold transition-colors',
                      refundMode === 'price' ? 'border-2 border-[#b20202] bg-white text-[#b20202]' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                    Price
                  </button>
                  <button type="button" disabled={activeIdx === null}
                    onClick={() => { if (activeIdx !== null) { setRefundData(p => { const n = { ...p }; delete n[activeIdx]; return n; }); setActiveIdx(null); setNumInput('0'); } }}
                    className="flex h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100 active:scale-95 disabled:opacity-30">
                    +/-
                  </button>
                  <button type="button" disabled={activeIdx === null} onClick={() => pushDigit('0')}
                    className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30">
                    0
                  </button>
                  <button type="button" disabled={activeIdx === null} onClick={() => pushDigit('.')}
                    className="flex h-10 items-center justify-center rounded-lg border border-orange-100 bg-orange-50 text-sm font-semibold text-orange-500 hover:bg-orange-100 active:scale-95 disabled:opacity-30">
                    .
                  </button>
                  <button type="button" disabled={activeIdx === null} onClick={() => pushDigit('⌫')}
                    className="flex h-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 disabled:opacity-30">
                    <PiBackspace className="h-4 w-4" />
                  </button>
                </div>

                {/* Odoo-style: Refund payment method selector */}
                <div className="mt-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Refund Payment Method
                  </label>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setRefundPaymentMethod('')}
                      className={cn(
                        'flex-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-colors',
                        !refundPaymentMethod
                          ? 'border-gray-300 bg-gray-100 text-gray-700'
                          : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
                      )}
                    >
                      Same as order
                    </button>
                    {REFUND_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setRefundPaymentMethod(m.value)}
                        className={cn(
                          'flex-1 rounded-lg border py-1.5 text-[10px] font-semibold capitalize transition-colors',
                          refundPaymentMethod === m.value
                            ? 'border-[#b20202] bg-[#b20202]/10 text-[#b20202]'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleRefundClick} disabled={refundLines.length === 0}
                className="shrink-0 py-3.5 text-sm font-bold text-white transition-colors disabled:opacity-40 hover:opacity-90"
                style={{ backgroundColor: '#b20202' }}>
                {refundLines.length > 0
                  ? `Return ${refundLines.length} item${refundLines.length > 1 ? 's' : ''} — ${formatCurrency(refundTotal)}`
                  : 'Select items to return'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => onLoadOrder(order)}
              className="shrink-0 py-4 text-base font-bold text-white hover:opacity-90"
              style={{ backgroundColor: '#b20202' }}>
              Load Order
            </button>
          )}
        </>
      )}

      {/* ══ INVOICE TAB ══ */}
      {activeTab === 'invoice' && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Order meta */}
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {isFullyRefundedStatus ? (
                <span className="rounded bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Refunded</span>
              ) : isPartiallyRefunded ? (
                <span className="rounded bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Partially Refunded</span>
              ) : (
                <span className="rounded bg-green-100 px-3 py-1 text-xs font-bold text-green-700">Paid</span>
              )}
              <span className="rounded bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">Posted</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {[
                  ['Order Ref', order.orderNumber || '—'],
                  ['Receipt', order.receiptNumber || '—'],
                  ['Date', new Date(order.placedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
                  ['Cashier', cashierName],
                  ['Customer', customerName || 'Walk-in Customer'],
                  ['Payment', order.paymentMethod?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || '—'],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-1.5 pr-4 text-xs text-gray-500 w-24">{label}</td>
                    <td className="py-1.5 text-xs font-medium text-gray-800">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Products table */}
          <div className="flex-1 overflow-x-auto px-2">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Returned</th>
                  <th className="px-3 py-2 text-right">UoM</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Disc.%</th>
                  <th className="px-3 py-2 text-right">Tax Excl.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const discPct = item.discountAmount && item.itemSubtotal
                    ? ((item.discountAmount / (item.itemSubtotal + item.discountAmount)) * 100).toFixed(2)
                    : '0.00';
                  const refunded = refundedMap[i] || 0;
                  return (
                    <tr key={i} className={cn(
                      'border-b border-gray-50',
                      refunded >= item.quantity ? 'bg-red-50/50' : 'hover:bg-gray-50/50'
                    )}>
                      <td className={cn(
                        'px-3 py-2 font-medium',
                        refunded >= item.quantity ? 'text-gray-400 line-through' : 'text-gray-900'
                      )}>
                        {item.name}{item.variant ? ` - ${item.variant}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{item.quantity}.00</td>
                      <td className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        refunded > 0 ? 'text-[#b20202] font-semibold' : 'text-gray-300'
                      )}>
                        {refunded > 0 ? `${refunded}.00` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">Units</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{formatCurrency(item.priceAtPurchase)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{discPct}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{formatCurrency(item.itemSubtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="shrink-0 border-t border-gray-200 px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Taxes:</span><span className="tabular-nums">₦0.00</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>Total:</span><span className="tabular-nums">{formatCurrency(order.total)}</span>
            </div>
            {totalRefunded > 0 && (
              <div className="flex justify-between text-xs text-[#b20202]">
                <span>Total Refunded:</span><span className="tabular-nums">−{formatCurrency(totalRefunded)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-600">
              <span>Total Paid:</span><span className="tabular-nums">{formatCurrency(order.total)}</span>
            </div>
          </div>

          {/* Invoice actions */}
          <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-3">
            <button type="button" onClick={handlePrint}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <PiPrinter className="h-4 w-4" /> Print
            </button>
            {isPaid && (
              <button type="button" onClick={() => setActiveTab('details')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90"
                style={{ backgroundColor: '#b20202' }}>
                Return Products
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Odoo-style confirmation dialog ── */}
      {showConfirmDialog && (
        <ReturnConfirmDialog
          order={order}
          lines={refundLines}
          items={items}
          total={refundTotal}
          defaultMethod={refundPaymentMethod || order.paymentMethod || 'cash'}
          onConfirm={handleConfirmReturn}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

      {/* ── Odoo-style return receipt ── */}
      {returnResult && (
        <ReturnReceiptScreen
          result={returnResult}
          originalOrder={order}
          items={items}
          onClose={() => { setReturnResult(null); setActiveTab('returns'); }}
        />
      )}

      {/* ══ RETURNS TAB (Refund History — Odoo-style) ══ */}
      {activeTab === 'returns' && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {refunds.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              <PiClockCounterClockwise className="mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">No returns recorded for this order</p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {refunds.length} return{refunds.length > 1 ? 's' : ''} · total refunded: {formatCurrency(totalRefunded)}
                </p>
              </div>
              <div className="flex-1 divide-y divide-gray-100">
                {refunds.map((refund, ri) => (
                  <RefundHistoryRow key={ri} refund={refund} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
