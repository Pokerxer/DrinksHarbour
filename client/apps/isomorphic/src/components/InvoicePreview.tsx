// @ts-nocheck
'use client';

/**
 * InvoicePreview — renders a pixel-accurate React JSX preview of the invoice.
 * Matches buildInvoice() output exactly so what-you-see = what-you-print.
 *
 * Usage:
 *   <InvoicePreview order={order} store={store} />
 *   <InvoicePreview order={order} onPrint={() => printInvoice(order)} />
 */

import React from 'react';
import { PiPrinter } from 'react-icons/pi';
import { deriveInvoiceData, printInvoice, DEFAULT_STORE } from '@/utils/invoice';
import type { InvoiceOrder, InvoiceStore } from '@/utils/invoice';

interface InvoicePreviewProps {
  order: InvoiceOrder;
  store?: InvoiceStore;
  /** If provided, shown as a footer action button instead of the default print. */
  onPrint?: () => void;
  /** Extra class on the outer wrapper */
  className?: string;
}

export default function InvoicePreview({ order, store = DEFAULT_STORE, onPrint, className = '' }: InvoicePreviewProps) {
  const d    = deriveInvoiceData(order, store);
  const fmt  = (v: number) => `₦${Number(v || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const handlePrint = onPrint ?? (() => printInvoice(order, store));

  return (
    <div className={`flex flex-col overflow-hidden ${className}`} style={{ flex: 1 }}>
      {/* Scrollable preview area */}
      <div className="flex-1 overflow-y-auto bg-gray-200 p-4">
        <div style={{ background: '#fff', maxWidth: 520, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,.15)', fontFamily: 'Arial,Helvetica,sans-serif', fontSize: 12, color: '#111' }}>

          {/* Accent bar */}
          <div style={{ height: 5, background: 'linear-gradient(90deg,#b20202,#7f1d1d)' }} />

          <div style={{ padding: '24px 28px' }}>

            {/* Logo + store address */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <img
                src={d.logoSrc}
                alt={d.storeName}
                style={{ height: 48, objectFit: 'contain', objectPosition: 'left' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fb = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                  if (fb) fb.removeAttribute('hidden');
                }}
              />
              <span hidden style={{ fontSize: 18, fontWeight: 900, color: '#b20202' }}>{d.storeName}</span>
              <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.8, color: '#4b5563' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#111', marginBottom: 2 }}>{d.storeName}</div>
                {d.address.map((l, i) => <div key={i}>{l}</div>)}
                {d.bankAccounts.map((b, i) => (
                  <div key={i} style={{ marginTop: 2 }}>
                    {b.bankName}{b.accountNumber ? ` - ${b.accountNumber}` : ''}
                    {b.accountName && <span style={{ color: '#9ca3af', fontSize: 11 }}> · {b.accountName}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #e5e7eb', marginBottom: 20 }} />

            {/* Receipt number + status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Invoice</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#b20202', letterSpacing: '-0.5px', lineHeight: 1 }}>{d.receiptRef}</div>
                {d.hasOrderNum && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Order # {d.orderNumber}</div>}
              </div>
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', background: `${d.statusColor}18`, color: d.statusColor, border: `1px solid ${d.statusColor}40`, marginTop: 4 }}>
                {d.statusLabel}
              </span>
            </div>

            {/* Meta strip */}
            <div style={{ display: 'flex', margin: '18px 0', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <MetaCell label="Order Date" value={d.dateStr} />
              {d.cashier && <MetaCell label="Cashier" value={d.cashier} />}
              <MetaCell label="Payment" value={d.payLabel || '—'} sub={d.change > 0 ? `Change: ${fmt(d.change)}` : undefined} />
              <MetaCell label="Customer" value={d.customerName} sub={d.customerPhone || undefined} last />
            </div>

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Description', 'Quantity', 'Unit Price', 'Taxes', 'Amount'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.items.map((it, i) => {
                  const qty     = it.quantity ?? 0;
                  const price   = it.priceAtPurchase ?? 0;
                  const total   = it.itemSubtotal ?? price * qty;
                  const ret     = it.refundedQty ?? 0;
                  const crossed = ret >= qty && ret > 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : undefined, opacity: crossed ? 0.38 : 1 }}>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: '#111', textDecoration: crossed ? 'line-through' : undefined }}>
                        <span style={{ fontWeight: 500 }}>
                          {it.product?.name || it.name || '—'}
                        </span>
                        {it.variant && <span style={{ color: '#888', fontSize: 11 }}> · {it.variant}</span>}
                        {ret > 0 && !crossed && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2, fontWeight: 600 }}>↩ {ret} returned</div>}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{qty}.00 Units</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{fmt(price)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, color: '#d1d5db' }}>—</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals block */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
              <div style={{ width: 300 }}>
                {d.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>Discount</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>−{fmt(d.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Untaxed Amount</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>{fmt(d.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: '#b20202' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>Total</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{fmt(d.amount)}</span>
                </div>
                {d.totalRefunded > 0 && <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #fee2e2', background: '#fff5f5', fontSize: 11 }}>
                    <span style={{ color: '#dc2626' }}>Total Returned</span>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>−{fmt(d.totalRefunded)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: '#fff5f5', borderTop: '1px dashed #fecaca', fontSize: 11 }}>
                    <span style={{ color: '#6b7280' }}>Net Paid</span>
                    <span style={{ fontWeight: 700, color: '#111' }}>{fmt(Math.max(0, d.amount - d.totalRefunded))}</span>
                  </div>
                </>}
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 10, fontSize: 10, color: '#6b7280' }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Terms &amp; Conditions: </span>
              <span style={{ color: '#b20202' }}>https://www.drinksharbour.com/terms</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
              <span>No Return Of Drinks</span><span>Page 1 / 1</span>
            </div>

          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex shrink-0 gap-2 border-t border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={handlePrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#b20202' }}
        >
          <PiPrinter className="h-4 w-4" /> Print Invoice
        </button>
      </div>
    </div>
  );
}

// ── Meta cell helper ──────────────────────────────────────────────────────────
function MetaCell({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '10px 14px', borderRight: last ? undefined : '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b20202', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#111', textTransform: 'capitalize' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
