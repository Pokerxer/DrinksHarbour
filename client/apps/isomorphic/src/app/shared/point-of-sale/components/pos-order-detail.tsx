'use client';

import { useState } from 'react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth, usePOSSettings } from '@/app/shared/point-of-sale/store';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type {
  POSRefundRecord,
  POSRefundResponse,
} from '@/app/shared/point-of-sale/types';
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
  bxgyRole?: 'buy' | 'get'; // BXGY reward item role — for receipt display
}

interface DetailOrder {
  _id: string;
  receiptNumber?: string;
  orderNumber?: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  placedAt: string;
  createdAt: string;
  posStaff?: {
    _id: string;
    firstName: string;
    lastName: string;
    posName?: string;
  };
  isVoided?: boolean;
  paymentStatus?: string;
  paymentDetails?: {
    splitPayments?: { method: string; amount: number }[];
    change?: number;
    amount?: number;
  };
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
  { value: 'cash', label: 'Cash', icon: <PiCurrencyNgn className="h-4 w-4" /> },
  { value: 'card', label: 'Card', icon: <PiCreditCard className="h-4 w-4" /> },
  {
    value: 'bank_transfer',
    label: 'Bank',
    icon: <PiBank className="h-4 w-4" />,
  },
  {
    value: 'mobile_money',
    label: 'Mobile',
    icon: <PiDeviceMobile className="h-4 w-4" />,
  },
];

function formatOrderDate(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

// ── Helpers: compute already-refunded qty per item index ──────────────────────

function computeRefundedMap(
  refunds?: POSRefundRecord[]
): Record<number, number> {
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
    ? refund.refundedBy.posName ||
      `${refund.refundedBy.firstName} ${refund.refundedBy.lastName}`
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
            <div
              key={li}
              className="flex items-center justify-between py-1 text-xs text-gray-600"
            >
              <span>
                #{line.orderItemIndex + 1} × {line.quantity}
                {line.discPct > 0 && (
                  <span className="ml-1 text-[#b20202]">
                    (−{line.discPct}% disc)
                  </span>
                )}
                {line.reason && (
                  <span className="ml-1 text-gray-400">· {line.reason}</span>
                )}
              </span>
              <span className="font-medium tabular-nums text-gray-800">
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
  const [method, setMethod] = useState(
    defaultMethod || order.paymentMethod || 'cash'
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Return Products
            </h2>
            <p className="text-xs text-gray-400">
              {order.receiptNumber} · {order.orderNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
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
                const amt =
                  price * line.quantity * (1 - (line.discPct ?? 0) / 100);
                return (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5">
                      <p className="max-w-[180px] truncate font-medium text-gray-900">
                        {item?.name}
                        {item?.variant ? ` · ${item.variant}` : ''}
                      </p>
                      {(line.discPct ?? 0) > 0 && (
                        <p className="text-[10px] text-[#b20202]">
                          {line.discPct}% deduction applied
                        </p>
                      )}
                      {line.reason && (
                        <p className="text-[10px] italic text-gray-400">
                          {line.reason}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        {line.restock === false
                          ? '⚠ Not restocked'
                          : '✓ Restocked'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-gray-500">
                      {item?.quantity ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-red-50 text-sm font-bold tabular-nums text-[#b20202]">
                        {line.quantity}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                      {formatCurrency(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Options */}
        <div className="space-y-4 border-t border-gray-100 px-6 py-4">
          {/* Refund via */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
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
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
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
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(total)}
            </span>
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
                try {
                  await onConfirm(method, reason);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#b20202' }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing…
                </span>
              ) : (
                'Confirm Return'
              )}
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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function handlePrint() {
    const win = window.open(
      '',
      '_blank',
      'width=400,height=700,scrollbars=yes'
    );
    if (!win) return;
    const rows = result.refundLines
      .map((line) => {
        const item = items[line.orderItemIndex];
        return `<tr>
        <td style="padding:4px 0;border-bottom:1px solid #eee">${item?.name ?? ''}${item?.variant ? ` · ${item.variant}` : ''}</td>
        <td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee">${line.quantity}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${line.unitPrice?.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</td>
        <td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee">${line.amount?.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</td>
      </tr>`;
      })
      .join('');
    win.document
      .write(`<!DOCTYPE html><html><head><title>${result.returnNumber}</title>
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
        <tr><td style="color:#555">Refund via</td><td style="text-transform:capitalize">${(result.refundRecord?.paymentMethod || 'cash').replace(/_/g, ' ')}</td></tr>
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <table style="width:100%;font-size:11px">
        <thead><tr style="color:#888"><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:2px solid #333;margin:8px 0">
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;color:#b20202">
        <span>TOTAL RETURNED</span><span>−${result.totalRefunded?.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</span>
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0">
      <div style="text-align:center;font-size:10px;color:#666;margin-top:8px">
        This is your return confirmation.<br>Please retain for your records.
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
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
        <div className="max-h-[55vh] overflow-y-auto">
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 12,
              padding: '20px 20px 4px',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.1em',
                }}
              >
                DRINKS HARBOUR
              </p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#b20202' }}>
                RETURN RECEIPT
              </p>
            </div>
            <div style={{ borderTop: '1px dashed #bbb', margin: '8px 0' }} />
            {/* Meta */}
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              {[
                ['Return #', result.returnNumber],
                ['Original', originalOrder.receiptNumber || '—'],
                ['Date', dateStr],
                [
                  'Refund via',
                  (result.refundRecord?.paymentMethod || 'cash')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase()),
                ],
              ].map(([label, val]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    lineHeight: '1.7',
                  }}
                >
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
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          paddingRight: 8,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item?.name}
                        {item?.variant ? ` · ${item.variant}` : ''}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', color: '#b20202' }}>
                        −{formatCurrency(line.amount)}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: 10, color: '#555', paddingLeft: 8 }}
                    >
                      {line.quantity} × {formatCurrency(line.unitPrice ?? 0)}
                      {(line.discPct ?? 0) > 0 && ` (−${line.discPct}%)`}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: '2px solid #222', margin: '8px 0' }} />
            {/* Total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <span>TOTAL RETURNED</span>
              <span style={{ color: '#b20202' }}>
                −{formatCurrency(result.totalRefunded)}
              </span>
            </div>
            {result.cumulativeRefunded > result.totalRefunded && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: '#555',
                  marginTop: 4,
                }}
              >
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
  onRefund: (
    order: DetailOrder,
    lines: {
      orderItemIndex: number;
      quantity: number;
      discPct?: number;
      unitPrice?: number;
      restock?: boolean;
      reason?: string;
    }[],
    refundPaymentMethod?: string
  ) => void;
  onLoadOrder: (order: DetailOrder) => void;
  onClose: () => void;
}) {
  const { token, tenant } = usePOSAuth();
  const settings = usePOSSettings();

  const [activeTab, setActiveTab] = useState<'details' | 'invoice' | 'returns'>(
    'details'
  );
  const [refundData, setRefundData] = useState<Record<number, RefundLine>>({});
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [numInput, setNumInput] = useState('0');
  const [refundMode, setRefundMode] = useState<RefundMode>('qty');
  const [fresh, setFresh] = useState(false);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState('');

  // Odoo-style two-step: confirm dialog → return receipt
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [returnResult, setReturnResult] = useState<POSRefundResponse | null>(
    null
  );

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
    return (
      refundData[idx] ?? {
        qty: remaining,
        discPct: 0,
        unitPrice: 0,
        restock: settings.defaultRestockOnRefund,
        reason: '',
      }
    );
  }

  function getModeValue(idx: number): string {
    const d = getLineData(idx);
    if (refundMode === 'qty') return String(d.qty);
    if (refundMode === 'disc') return String(d.discPct);
    if (refundMode === 'price')
      return d.unitPrice > 0
        ? String(d.unitPrice)
        : String(items[idx]?.priceAtPurchase ?? 0);
    return '0';
  }

  function applyInput(idx: number, raw: string) {
    const val = parseFloat(raw) || 0;
    const item = items[idx];
    const remaining = getRemainingQty(idx);
    setRefundData((prev) => {
      const existing = prev[idx] ?? {
        qty: remaining,
        discPct: 0,
        unitPrice: 0,
        restock: true,
        reason: '',
      };
      if (refundMode === 'qty')
        return {
          ...prev,
          [idx]: {
            ...existing,
            qty: Math.min(Math.max(0, Math.round(val)), remaining),
          },
        };
      if (refundMode === 'disc')
        return {
          ...prev,
          [idx]: { ...existing, discPct: Math.min(Math.max(0, val), 100) },
        };
      if (refundMode === 'price')
        return { ...prev, [idx]: { ...existing, unitPrice: Math.max(0, val) } };
      return prev;
    });
  }

  // ── Item selection ────────────────────────────────────────────────────────

  function handleSelectItem(idx: number) {
    if (isFullyRefunded(idx)) return;
    const item = items[idx];
    if (!item) return;

    if (activeIdx === idx) {
      setRefundData((prev) => {
        const n = { ...prev };
        delete n[idx];
        return n;
      });
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
      next =
        numInput === '0' ? d : numInput.length >= 8 ? numInput : numInput + d;
    }
    setNumInput(next);
    applyInput(activeIdx, next);
  }

  // ── Shared invoice HTML builder (used by both print and preview) ─────────

  function buildInvoiceHTML(forPrint = false) {
    const _cashierName = order.posStaff
      ? order.posStaff.posName ||
        `${order.posStaff.firstName} ${order.posStaff.lastName}`
      : '—';
    const _hasCustomer =
      order.customer?.firstName && order.customer.firstName !== 'Walk-in';
    const _customerName = _hasCustomer
      ? `${order.customer!.firstName} ${order.customer!.lastName || ''}`.trim()
      : 'Walk-in Customer';
    const _customerPhone =
      _hasCustomer && order.customer?.phone ? order.customer.phone : '';
    const _subtotal = order.subtotal ?? order.total;
    const _discount = order.discountTotal ?? 0;
    const _splitPmts = order.paymentDetails?.splitPayments ?? [];
    const _change = order.paymentDetails?.change ?? 0;
    const _orderDate = new Date(
      order.placedAt || order.createdAt
    ).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const _storeName = (tenant?.name || 'DRINKS HARBOUR').toUpperCase();
    const _rawLogo = tenant?.logo;
    const _logoSrc =
      (typeof _rawLogo === 'string'
        ? _rawLogo?.trim()
        : (_rawLogo as any)?.url?.trim()) || '/logo.png';

    const ng = (v: number) =>
      `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const statusLabel = order.isVoided
      ? 'VOID'
      : isFullyRefundedStatus
        ? 'REFUNDED'
        : isPartiallyRefunded
          ? 'PART. REFUNDED'
          : 'PAID';
    const statusColor = order.isVoided
      ? '#64748b'
      : isFullyRefundedStatus
        ? '#dc2626'
        : isPartiallyRefunded
          ? '#d97706'
          : '#16a34a';

    const paymentLabel =
      _splitPmts.length > 0
        ? _splitPmts
            .map(
              (sp: { method: string; amount: number }) =>
                `${sp.method.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} ${ng(sp.amount)}`
            )
            .join(' + ')
        : (order.paymentMethod || '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());

    const itemRowsHtml = items
      .map((it, i) => {
        const ret = refundedMap[i] || 0;
        const crossed = ret >= it.quantity;
        const rowBg = i % 2 === 1 ? 'background:#fafafa;' : '';
        return `
        <tr style="${rowBg}border-bottom:1px solid #f0f0f0;${crossed ? 'opacity:0.38;' : ''}">
          <td style="padding:10px 16px;font-size:13px;color:#111;${crossed ? 'text-decoration:line-through;' : ''}">
            <span style="font-weight:500">${it.name}</span>${it.variant ? `<span style="color:#888;font-size:11px"> · ${it.variant}</span>` : ''}${it.bxgyRole === 'get' ? ' <span style="display:inline-block;background:#d1fae5;color:#059669;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px;margin-left:4px">GET</span>' : ''}
            ${ret > 0 && !crossed ? `<div style="font-size:10px;color:#dc2626;margin-top:2px;font-weight:600">↩ ${ret} returned</div>` : ''}
          </td>
          <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;white-space:nowrap">${it.quantity}.00 Units</td>
          <td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151;font-variant-numeric:tabular-nums">${ng(it.priceAtPurchase)}</td>
          <td style="padding:10px 16px;text-align:right;font-size:12px;color:#d1d5db">—</td>
          <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700;color:#111;font-variant-numeric:tabular-nums">${ng(it.itemSubtotal)}</td>
        </tr>`;
      })
      .join('');

    const scaleStyle = forPrint
      ? ''
      : `transform:scale(0.68);transform-origin:top left;width:147%;`;
    const bodyPad = forPrint ? '0' : '0';

    return `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8">
      <title>Invoice · ${order.receiptNumber || order.orderNumber || ''}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#fff}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;padding:${bodyPad};${scaleStyle}}
        @media print{body{transform:none!important;width:100%!important}@page{size:A4;margin:14mm 16mm}}
        table{width:100%;border-collapse:collapse}
      </style>
    </head><body>

      <!-- ════ Page wrapper ════ -->
      <div style="max-width:820px;margin:0 auto;padding:${forPrint ? '44px 52px 120px' : '36px 42px 80px'}">

        <!-- ── Brand accent bar ── -->
        <div style="height:5px;background:linear-gradient(90deg,#b20202,#7f1d1d);border-radius:3px;margin-bottom:32px"></div>

        <!-- ── Header: logo ↔ company ── -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
          <img src="${_logoSrc}" alt="${_storeName}" style="height:54px;object-fit:contain;object-position:left center">
          <div style="text-align:right;font-size:12px;line-height:1.9;color:#4b5563;max-width:300px">
            <div style="font-size:14px;font-weight:800;color:#111;letter-spacing:0.03em;margin-bottom:2px">${_storeName}</div>
            <div>Nigeria</div>
            ${(tenant?.bankAccounts ?? [])
              .map(
                (b: {
                  bankName: string;
                  accountNumber: string;
                  accountName?: string;
                }) =>
                  `<div style="margin-top:2px">${b.bankName}${b.accountNumber ? ` - ${b.accountNumber}` : ''}${b.accountName ? `<span style="color:#9ca3af;font-size:11px"> · ${b.accountName}</span>` : ''}</div>`
              )
              .join('')}
            <div style="margin-top:2px">ADDRESS - 39 GANA STREET MAITAMA, ABUJA</div>
          </div>
        </div>

        <!-- ── Thin separator ── -->
        <div style="border-top:1px solid #e5e7eb;margin-bottom:24px"></div>

        <!-- ── Invoice label + order number + status ── -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Invoice</div>
            <div style="font-size:28px;font-weight:900;color:#b20202;letter-spacing:-0.5px;line-height:1">${order.receiptNumber || order.orderNumber || '—'}</div>
            ${order.orderNumber && order.receiptNumber ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px">Order # ${order.orderNumber}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding-top:4px">
            <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40">
              ${statusLabel}
            </span>
          </div>
        </div>

        <!-- ── Meta strip ── -->
        <div style="display:flex;gap:0;margin:22px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Order Date</div>
            <div style="font-size:13px;font-weight:600;color:#111">${_orderDate}</div>
          </div>
          <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Cashier</div>
            <div style="font-size:13px;font-weight:600;color:#111">${_cashierName}</div>
          </div>
          <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Payment</div>
            <div style="font-size:13px;font-weight:600;color:#111;text-transform:capitalize">${paymentLabel}</div>
            ${_change > 0 ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">Change: ${ng(_change)}</div>` : ''}
          </div>
          <div style="flex:1;padding:12px 16px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Customer</div>
            <div style="font-size:13px;font-weight:600;color:#111">${_customerName}</div>
            ${_customerPhone ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${_customerPhone}</div>` : ''}
          </div>
        </div>

        <!-- ── Items table ── -->
        <table style="margin-bottom:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Description</th>
              <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Quantity</th>
              <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap">Unit Price</th>
              <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Taxes</th>
              <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;border-bottom:1px solid #e5e7eb">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>

        <!-- ── Totals ── -->
        <div style="display:flex;justify-content:flex-end;margin-top:0;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
          <div style="width:340px">
            ${
              _discount > 0
                ? `
            <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
              <span style="color:#6b7280">Discount</span>
              <span style="color:#dc2626;font-weight:600">−${ng(_discount)}</span>
            </div>`
                : ''
            }
            <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
              <span style="color:#6b7280">Untaxed Amount</span>
              <span style="font-weight:600;color:#111">${ng(_subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:13px 16px;background:#b20202">
              <span style="font-size:14px;font-weight:800;color:#fff;letter-spacing:0.02em">Total</span>
              <span style="font-size:14px;font-weight:800;color:#fff">${ng(order.total)}</span>
            </div>
            ${
              totalRefunded > 0
                ? `
            <div style="display:flex;justify-content:space-between;padding:9px 16px;border-top:1px solid #fee2e2;background:#fff5f5;font-size:12px">
              <span style="color:#dc2626">Total Returned</span>
              <span style="color:#dc2626;font-weight:700">−${ng(totalRefunded)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:9px 16px;background:#fff5f5;border-top:1px dashed #fecaca;font-size:12px">
              <span style="color:#6b7280">Net Paid</span>
              <span style="font-weight:700;color:#111">${ng(Math.max(0, order.total - totalRefunded))}</span>
            </div>`
                : ''
            }
          </div>
        </div>

        <!-- ── Terms ── -->
        <div style="margin-top:28px;font-size:12px;color:#6b7280">
          <span style="font-weight:600;color:#374151">Terms &amp; Conditions: </span>
          <span style="color:#b20202">https://www.drinksharbour.com/terms</span>
        </div>

      </div><!-- end page wrapper -->

      <!-- ── Footer ── -->
      <div style="position:${forPrint ? 'fixed' : 'static'};bottom:0;left:0;right:0;${!forPrint ? 'margin-top:auto;' : ''}">
        <div style="max-width:820px;margin:0 auto;padding:14px 52px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#9ca3af;background:#fff">
          <span>No Return Of Drinks</span>
          <span>Page 1 / 1</span>
        </div>
      </div>

    </body></html>`;
  }

  // ── Print ─────────────────────────────────────────────────────────────────

  function handlePrint() {
    const win = window.open(
      '',
      '_blank',
      'width=900,height=1100,scrollbars=yes'
    );
    if (!win) return;
    win.document.write(buildInvoiceHTML(true));
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  }

  // ── Submit refund — Odoo flow: open dialog first ──────────────────────────

  function handleRefundClick() {
    if (refundLines.length === 0) return;
    setShowConfirmDialog(true);
  }

  async function handleConfirmReturn(method: string, globalReason: string) {
    if (!token) {
      toast.error('Not authenticated');
      return;
    }
    if (order._id.startsWith('offline-')) {
      toast.error(
        'This order has not synced yet. Wait for network and try again.'
      );
      return;
    }
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
        method
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
    ? order.posStaff.posName ||
      `${order.posStaff.firstName} ${order.posStaff.lastName}`
    : '—';
  const customerName =
    order.customer?.firstName && order.customer.firstName !== 'Walk-in'
      ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
      : null;

  // Count refunded items for status badge
  const totalRefunded = refunds.reduce((s, r) => s + r.totalRefunded, 0);
  const isPartiallyRefunded =
    totalRefunded > 0 && totalRefunded < (order.total || 0);
  const isFullyRefundedStatus =
    totalRefunded > 0 && totalRefunded >= (order.total || 0);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Tabs ── */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {(
          [
            {
              id: 'details',
              label: 'Details',
              icon: <PiInfo className="h-3.5 w-3.5" />,
            },
            {
              id: 'invoice',
              label: 'Invoice',
              icon: <PiReceipt className="h-3.5 w-3.5" />,
            },
            {
              id: 'returns',
              label: `Returns${refunds.length ? ` (${refunds.length})` : ''}`,
              icon: <PiClockCounterClockwise className="h-3.5 w-3.5" />,
            },
          ] as const
        ).map((tab) => (
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
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ DETAILS TAB ══ */}
      {activeTab === 'details' && (
        <>
          {/* Status badge */}
          {isFullyRefundedStatus && (
            <div className="shrink-0 bg-red-50 px-4 py-2 text-xs font-semibold text-[#b20202]">
              Fully refunded — {refunds.length} return
              {refunds.length > 1 ? 's' : ''}
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
              <p className="mt-12 text-center text-sm text-gray-400">
                No item details available
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((item, i) => {
                  const isActive = activeIdx === i;
                  const lineData = refundData[i];
                  const remaining = getRemainingQty(i);
                  const refunded = refundedMap[i] || 0;
                  const isSelected = !!lineData && lineData.qty > 0;
                  const modeVal = isActive
                    ? numInput
                    : lineData
                      ? getModeValue(i)
                      : null;
                  const fullyRefunded = isFullyRefunded(i);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        isPaid && !fullyRefunded && handleSelectItem(i)
                      }
                      disabled={!isPaid || fullyRefunded}
                      className={cn(
                        'relative w-full px-4 py-3 text-left transition-colors',
                        isActive
                          ? 'border-l-4 border-l-[#b20202] bg-red-50'
                          : isSelected
                            ? 'border-l-4 border-l-amber-400 bg-orange-50'
                            : fullyRefunded
                              ? 'border-l-4 border-l-gray-300 bg-gray-50 opacity-60'
                              : 'border-l-4 border-l-transparent bg-white hover:bg-gray-50',
                        !isPaid && 'cursor-default',
                        fullyRefunded && 'cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-sm font-semibold',
                              isActive
                                ? 'text-[#b20202]'
                                : fullyRefunded
                                  ? 'text-gray-400'
                                  : 'text-gray-900'
                            )}
                          >
                            {item.name}
                            {item.variant ? ` - ${item.variant}` : ''}
                            {item.bxgyRole === 'get' && (
                              <span className="ml-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                GET
                              </span>
                            )}
                          </p>
                          {/* Odoo-style: original qty | refunded | remaining */}
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                            {/* Three-part qty display */}
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="tabular-nums text-gray-400">
                                Ord: {item.quantity}
                              </span>
                              {refunded > 0 && (
                                <span className="tabular-nums text-[#b20202]">
                                  Ret: {refunded}
                                </span>
                              )}
                              {!fullyRefunded && (
                                <span
                                  className={cn(
                                    'font-semibold tabular-nums',
                                    remaining > 0
                                      ? 'text-emerald-600'
                                      : 'text-gray-300'
                                  )}
                                >
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
                            <span
                              className={cn(
                                'tabular-nums',
                                isActive && refundMode === 'price'
                                  ? 'font-bold text-[#b20202]'
                                  : ''
                              )}
                            >
                              {item.bxgyRole === 'get'
                                ? 'FREE'
                                : `${formatCurrency(item.priceAtPurchase)} / Units`}
                            </span>
                            {(item.discountAmount ?? 0) > 0 && (
                              <span className="text-[#b20202]">
                                (disc −{formatCurrency(item.discountAmount!)})
                              </span>
                            )}
                          </div>
                          {/* Odoo-style: restock toggle + reason (when selected) */}
                          {isSelected && lineData && (
                            <div
                              className="mt-1.5 flex flex-wrap items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <label className="flex cursor-pointer items-center gap-1 text-[10px] text-gray-500">
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
                                onChange={(e) =>
                                  handleReasonChange(i, e.target.value)
                                }
                                placeholder="Reason..."
                                className="h-6 min-w-0 flex-1 rounded border border-gray-200 bg-white px-1.5 text-[10px] text-gray-600 outline-none focus:border-[#b20202]"
                                maxLength={80}
                              />
                            </div>
                          )}
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-sm font-semibold',
                            fullyRefunded
                              ? 'text-gray-300 line-through'
                              : 'text-gray-800'
                          )}
                        >
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
              <p className="text-xs capitalize text-gray-400">
                {order.paymentMethod.replace(/_/g, ' ')}
              </p>
            )}
            {totalRefunded > 0 && (
              <div className="mt-1 flex justify-between text-xs text-[#b20202]">
                <span>Already refunded</span>
                <span className="tabular-nums">
                  −{formatCurrency(totalRefunded)}
                </span>
              </div>
            )}
          </div>

          {isPaid ? (
            <>
              {/* ── Numpad with mode buttons ── */}
              <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-2">
                {/* Calculator display */}
                <div
                  className={cn(
                    'mb-2 rounded-xl px-4 py-2 text-center',
                    activeItem
                      ? 'bg-white ring-1 ring-[#b20202]/25'
                      : 'bg-white'
                  )}
                >
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {activeItem
                      ? `${activeItem.name}${activeItem.variant ? ` · ${activeItem.variant}` : ''}`
                      : 'Tap an item to select for return'}
                  </p>
                  <p
                    className={cn(
                      'text-xl font-bold tabular-nums',
                      activeItem ? 'text-[#b20202]' : 'text-gray-300'
                    )}
                  >
                    {activeItem
                      ? refundMode === 'qty'
                        ? numInput
                        : refundMode === 'disc'
                          ? `${numInput}%`
                          : formatCurrency(parseFloat(numInput) || 0)
                      : '—'}
                  </p>
                </div>

                {/* 4-column grid */}
                <div className="grid grid-cols-4 gap-1">
                  {['1', '2', '3'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={activeIdx === null}
                      onClick={() => pushDigit(d)}
                      className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => changeMode('qty')}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg text-xs font-bold transition-colors',
                      refundMode === 'qty'
                        ? 'border-2 border-[#b20202] bg-white text-[#b20202]'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    Qty
                  </button>
                  {['4', '5', '6'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={activeIdx === null}
                      onClick={() => pushDigit(d)}
                      className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => changeMode('disc')}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg text-xs font-bold transition-colors',
                      refundMode === 'disc'
                        ? 'border-2 border-[#b20202] bg-white text-[#b20202]'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    % Disc
                  </button>
                  {['7', '8', '9'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={activeIdx === null}
                      onClick={() => pushDigit(d)}
                      className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => changeMode('price')}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg text-xs font-bold transition-colors',
                      refundMode === 'price'
                        ? 'border-2 border-[#b20202] bg-white text-[#b20202]'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    Price
                  </button>
                  <button
                    type="button"
                    disabled={activeIdx === null}
                    onClick={() => {
                      if (activeIdx !== null) {
                        setRefundData((p) => {
                          const n = { ...p };
                          delete n[activeIdx];
                          return n;
                        });
                        setActiveIdx(null);
                        setNumInput('0');
                      }
                    }}
                    className="flex h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100 active:scale-95 disabled:opacity-30"
                  >
                    +/-
                  </button>
                  <button
                    type="button"
                    disabled={activeIdx === null}
                    onClick={() => pushDigit('0')}
                    className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 disabled:opacity-30"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={activeIdx === null}
                    onClick={() => pushDigit('.')}
                    className="flex h-10 items-center justify-center rounded-lg border border-orange-100 bg-orange-50 text-sm font-semibold text-orange-500 hover:bg-orange-100 active:scale-95 disabled:opacity-30"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    disabled={activeIdx === null}
                    onClick={() => pushDigit('⌫')}
                    className="flex h-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 disabled:opacity-30"
                  >
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

              {(() => {
                if (!settings.allowRefunds) return null;
                const isPendingSync = order._id.startsWith('offline-');
                const daysSince =
                  (Date.now() -
                    new Date(order.placedAt || order.createdAt).getTime()) /
                  86_400_000;
                const outsideWindow =
                  settings.refundWindowDays > 0 &&
                  daysSince > settings.refundWindowDays;
                return (
                  <button
                    type="button"
                    onClick={
                      outsideWindow || isPendingSync
                        ? undefined
                        : handleRefundClick
                    }
                    disabled={
                      refundLines.length === 0 || outsideWindow || isPendingSync
                    }
                    title={
                      isPendingSync
                        ? 'Order not yet synced — return available once online'
                        : outsideWindow
                          ? `Outside refund window (${settings.refundWindowDays}d)`
                          : undefined
                    }
                    className="shrink-0 py-3.5 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: '#b20202' }}
                  >
                    {isPendingSync
                      ? 'Sync pending — return unavailable'
                      : outsideWindow
                        ? `Outside refund window (${settings.refundWindowDays}d)`
                        : refundLines.length > 0
                          ? `Return ${refundLines.length} item${refundLines.length > 1 ? 's' : ''} — ${formatCurrency(refundTotal)}`
                          : 'Select items to return'}
                  </button>
                );
              })()}
            </>
          ) : (
            <button
              type="button"
              onClick={() => onLoadOrder(order)}
              className="shrink-0 py-4 text-base font-bold text-white hover:opacity-90"
              style={{ backgroundColor: '#b20202' }}
            >
              Load Order
            </button>
          )}
        </>
      )}

      {/* ══ INVOICE TAB ══ */}
      {activeTab === 'invoice' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Iframe preview — renders exact same HTML as the print output */}
          <div className="flex-1 overflow-hidden bg-gray-300">
            <iframe
              srcDoc={buildInvoiceHTML(false)}
              title="Invoice preview"
              className="h-full w-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
          {/* Actions */}
          <div className="flex shrink-0 gap-2 border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <PiPrinter className="h-4 w-4" /> Print Invoice
            </button>
            {isPaid && !order.isVoided && (
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90"
                style={{ backgroundColor: '#b20202' }}
              >
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
          onClose={() => {
            setReturnResult(null);
            setActiveTab('returns');
          }}
        />
      )}

      {/* ══ RETURNS TAB (Refund History — Odoo-style) ══ */}
      {activeTab === 'returns' && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {refunds.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              <PiClockCounterClockwise className="mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">
                No returns recorded for this order
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {refunds.length} return{refunds.length > 1 ? 's' : ''} · total
                  refunded: {formatCurrency(totalRefunded)}
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
