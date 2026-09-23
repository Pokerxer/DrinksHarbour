// @ts-nocheck
'use client';
import React, { useState } from 'react';
import { PiArrowCounterClockwise, PiInfo, PiPrinter, PiReceipt, PiX } from 'react-icons/pi';
import { fmt, fmtDate, fmtTime, fmtDateTime } from './history-format';
import { salesLine, salesStatus } from './history-data';
import InvoicePreview from '@/components/InvoicePreview';
import { printInvoice, DEFAULT_STORE } from '@/utils/invoice';
export default function SoldDetail({ order, productId, onClose }: { order: any; productId: string; onClose: ()=>void }) {
  const [tab, setTab] = useState<'details'|'invoice'|'returns'>('details');

  const line     = salesLine(order, productId);
  const qty      = line?.quantity || 0;
  const lineTotal = line ? (line.itemSubtotal ?? (line.priceAtPurchase||0)*qty) : 0;
  const amount   = order.totalAmount ?? order.total ?? 0;
  const subtotal = order.subtotal ?? amount;
  const discount = order.discountTotal ?? 0;
  const refunded = (order.refunds||[]).reduce((s: number, r: any)=>s+(r.totalRefunded||0), 0);
  const splits   = order.paymentDetails?.splitPayments ?? [];
  const change   = order.paymentDetails?.change ?? 0;
  const custName = order.customer ? `${order.customer.firstName||''} ${order.customer.lastName||''}`.trim()||null : null;
  const cashier  = order.posStaff ? (order.posStaff.posName||`${order.posStaff.firstName||''} ${order.posStaff.lastName||''}`.trim()) : null;
  const payLabel = splits.length>0
    ? splits.map((s: any)=>`${(s.method||'').replace(/_/g,' ').replace(/\b\w/g,(c: string)=>c.toUpperCase())} ${fmt(s.amount)}`).join(' + ')
    : (order.paymentMethod||'').replace(/_/g,' ').replace(/\b\w/g,(c: string)=>c.toUpperCase());

  // Status badge — mirrors POS statusBadge()
  const stLabel = salesStatus(order);
  const stCls = order.isVoided ? 'bg-gray-100 text-gray-500'
    : refunded >= amount && refunded > 0 ? 'bg-red-50 text-red-600'
    : refunded > 0 ? 'bg-amber-50 text-amber-600'
    : 'bg-emerald-50 text-emerald-600';

  const ng = (v: number) => `₦${Number(v||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{order.receiptNumber || order.orderNumber || '—'}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stCls}`}>{stLabel}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">{fmtDateTime(order.placedAt||order.createdAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={()=>printInvoice(order)} title="Print invoice"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#b20202]">
            <PiPrinter className="h-4 w-4"/>
          </button>
          <button type="button" aria-label="Close order details" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5"/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id:'details', label:'Details',  icon:<PiInfo className="h-3.5 w-3.5"/> },
          { id:'invoice', label:'Invoice',  icon:<PiReceipt className="h-3.5 w-3.5"/> },
          { id:'returns', label:`Returns${(order.refunds?.length??0)>0?` (${order.refunds.length})`:''}`, icon:<PiArrowCounterClockwise className="h-3.5 w-3.5"/> },
        ] as const).map(t=>(
          <button key={t.id} type="button" onClick={()=>setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${tab===t.id?'border-b-2 border-[#b20202] text-[#b20202]':'border-b-2 border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && (
        <div className="flex-1 overflow-auto">
          {/* 3-stat row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label:'Total',     value:fmt(amount),              red:true },
              { label:'This Item', value:fmt(lineTotal) },
              { label:'Order Refunded',  value:refunded>0?fmt(refunded):'—', amber:refunded>0 },
            ].map(({label,value,red,amber})=>(
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${red?'text-[#b20202]':amber?'text-amber-600':'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Fields */}
          <div className="border-b border-gray-100 px-5 py-3 space-y-1.5 text-xs">
            {([
              cashier                    && { label:'Cashier',    value: cashier },
              { label:'Customer',          value: custName || 'Walk-in Customer' },
              order.session              && { label:'Session',    value: `#${(order.session._id||'').slice(-8)}${order.session.terminalType?' · '+order.session.terminalType:''}` },
              { label:'Payment',           value: payLabel || '—' },
              change > 0                 && { label:'Change',     value: fmt(change) },
              { label:'Receipt #',         value: order.receiptNumber || '—' },
              { label:'Order #',           value: order.orderNumber || '—' },
              { label:'Status',            value: order.status || '—' },
              { label:'Qty (this item)',    value: String(qty) },
              line && { label:'Avg. Unit Price', value: fmt(line.priceAtPurchase||0) },

            ] as any[]).filter(Boolean).map(({label,value}: any)=>(
              <div key={label} className="flex justify-between gap-4">
                <span className="font-semibold text-gray-500 shrink-0">{label}</span>
                <span className="font-medium text-gray-800 text-right capitalize truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* Items table */}
          {(order.items||[]).length > 0 && (
            <div>
              <div className="border-b border-gray-50 bg-gray-50 px-5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items ({(order.items||[]).length})</p>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-xs">
                <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-5 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-5 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(order.items||[]).map((item: any, i: number)=>{
                    const isThis = String(item.subproduct?._id||item.subproduct)===productId;
                    return (
                      <tr key={i} className={isThis?'bg-[#b20202]/4':''}>
                        <td className="px-5 py-2.5">
                          <span className={`font-medium ${isThis?'text-[#b20202]':'text-gray-800'}`}>{item.product?.name||item.name||'—'}</span>
                          {item.variant && <span className="text-gray-400"> · {item.variant}</span>}
                          {isThis && <span className="ml-1.5 rounded bg-[#b20202]/10 px-1 py-0.5 text-[9px] font-bold text-[#b20202]">this</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{ng(item.priceAtPurchase||0)}</td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gray-900">{ng(item.itemSubtotal||(item.priceAtPurchase||0)*(item.quantity||0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
              <div className="border-t border-gray-100 px-5 py-3 space-y-1 text-xs">
                {discount>0 && <div className="flex justify-between" style={{color:'#b20202'}}><span>Discount</span><span className="font-semibold tabular-nums">−{ng(discount)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>Total</span><span className="tabular-nums">{ng(amount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice tab */}
      {tab === 'invoice' && (
        <InvoicePreview order={order} store={DEFAULT_STORE} className="flex-1" />
      )}

      {/* Returns tab */}
      {tab === 'returns' && (
        <div className="flex-1 overflow-auto">
          {(order.refunds||[]).length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <PiArrowCounterClockwise className="h-8 w-8 text-gray-200"/>
              <p className="text-sm text-gray-400">No returns for this order</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(order.refunds||[]).map((r: any, i: number)=>(
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800">{r.receiptNumber||`Return ${i+1}`}</span>
                    <span className="text-sm font-bold tabular-nums" style={{color:'#b20202'}}>−{fmt(r.totalRefunded)}</span>
                  </div>
                  {r.refundedAt && <p className="text-[11px] text-gray-400">{fmtDateTime(r.refundedAt)}</p>}
                  {r.paymentMethod && <p className="text-[11px] text-gray-400 capitalize mt-0.5">via {r.paymentMethod.replace(/_/g,' ')}</p>}
                  {(r.items||[]).length>0 && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 space-y-1">
                      {r.items.map((ri: any, j: number)=>(
                        <div key={j} className="flex justify-between text-[11px]">
                          <span className="text-gray-600">Item #{ri.orderItemIndex+1} × {ri.quantity}</span>
                          <span className="font-semibold text-gray-800 tabular-nums">−{fmt(ri.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-gray-200 px-5 py-3 text-sm font-bold">
                <span className="text-gray-600">Total Returned</span>
                <span className="tabular-nums" style={{color:'#b20202'}}>−{fmt(refunded)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
