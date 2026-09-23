// @ts-nocheck
'use client';
import React, { useState } from 'react';
import { PiInfo, PiPackage, PiX } from 'react-icons/pi';
import { fmt, fmtDate, fmtTime, fmtDateTime } from './history-format';
export default function PODetail({ po, productId, onClose }: { po: any; productId: string; onClose: ()=>void }) {
  const [tab, setTab] = useState<'details'|'items'>('details');

  const lines   = (po.items||[]).filter((i: any)=>String(i.subProductId?._id||i.subProductId)===productId);
  const qty     = lines.reduce((s: number,l: any)=>s+(l.quantity??l.packQty??0),0);
  const lineTotal = lines.reduce((s: number,l: any)=>s+(l.totalCost??(l.unitCost??l.unitPrice??0)*(l.quantity??l.packQty??0)),0);
  const unitP = qty ? lines.reduce((sum: number, line: any) => sum + (line.unitCost ?? line.unitPrice ?? 0) * (line.quantity ?? line.packQty ?? 0), 0) / qty : 0;
  const poTotal = po.totalAmount ?? po.total ?? (po.items||[]).reduce((s: number,l: any)=>s+(l.totalCost??(l.unitCost??l.unitPrice??0)*(l.quantity??l.packQty??0)),0);
  const allQty  = (po.items||[]).reduce((s: number,l: any)=>s+(l.quantity??l.packQty??0),0);

  const stCls = po.status==='received'?'bg-green-50 text-green-600':po.status==='confirmed'||po.status==='approved'?'bg-blue-50 text-blue-600':'bg-gray-100 text-gray-500';

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-gray-900">{po.poNumber||po._id?.slice(-8)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stCls}`}>{po.status||'—'}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">{fmtDate(po.confirmedAt||po.createdAt)}{po.vendor?.name?` · ${po.vendor.name}`:''}</p>
        </div>
        <button type="button" aria-label="Close order details" onClick={onClose} className="text-gray-400 hover:text-gray-600"><PiX className="h-5 w-5"/></button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id:'details', label:'Details', icon:<PiInfo className="h-3.5 w-3.5"/> },
          { id:'items',   label:`Items (${(po.items||[]).length})`, icon:<PiPackage className="h-3.5 w-3.5"/> },
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
              { label:'PO Total',  value:fmt(poTotal), red:true },
              { label:'This Item', value:fmt(lineTotal) },
              { label:'All Units', value:String(allQty) },
            ].map(({label,value,red})=>(
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums" style={red?{color:'#b20202'}:{color:'#111827'}}>{value}</p>
              </div>
            ))}
          </div>

          {/* Fields */}
          <div className="border-b border-gray-100 px-5 py-3 space-y-1.5 text-xs">
            {([
              { label:'Vendor',           value: po.vendor?.name || '—' },
              po.vendor?.contactPerson  && { label:'Contact',          value: po.vendor.contactPerson },
              po.vendor?.email          && { label:'Email',            value: po.vendor.email },
              po.vendor?.phone          && { label:'Phone',            value: po.vendor.phone },
              { label:'Status',           value: po.status || '—' },
              { label:'PO Number',        value: po.poNumber || '—' },
              { label:'Order Date',       value: fmtDate(po.confirmedAt||po.createdAt) },
              po.expectedDelivery       && { label:'Expected Delivery', value: fmtDate(po.expectedDelivery) },
              po.receivedAt             && { label:'Received',          value: fmtDate(po.receivedAt) },
              { label:'Qty (this item)',  value: String(qty) },
              unitP > 0                 && { label:'Avg. Unit Price',        value: fmt(unitP) },
              lineTotal > 0             && { label:'Item Total',        value: fmt(lineTotal) },
              po.notes                  && { label:'Notes',             value: po.notes },
            ] as any[]).filter(Boolean).map(({label,value}: any)=>(
              <div key={label} className="flex justify-between gap-4">
                <span className="font-semibold text-gray-500 shrink-0">{label}</span>
                <span className="font-medium text-gray-800 text-right capitalize truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* This-item highlight */}
          {qty > 0 && (
            <div className="mx-5 my-4 rounded-xl border border-[#b20202]/20 bg-[#b20202]/4 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{color:'#b20202'}}>This Product in PO</p>
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900">{qty} units</p>
                  {unitP > 0 && <p className="text-xs text-gray-500">@ {fmt(unitP)} / unit</p>}
                </div>
                <p className="text-base font-bold" style={{color:'#b20202'}}>{fmt(lineTotal)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items tab */}
      {tab === 'items' && (
        <div className="flex-1 overflow-auto">
          {(po.items||[]).length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <PiPackage className="h-8 w-8 text-gray-200"/>
              <p className="text-sm text-gray-400">No items on this PO</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400 shadow-[0_1px_0_#e5e7eb]">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Product</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(po.items||[]).map((item: any, i: number)=>{
                    const isThis = String(item.subProductId?._id||item.subProductId)===productId;
                    const itemQty = item.quantity??item.packQty??0;
                    const itemTotal = item.totalCost??(item.unitCost??item.unitPrice??0)*itemQty;
                    return (
                      <tr key={i} className={isThis?'bg-[#b20202]/4':''}>
                        <td className="px-5 py-2.5">
                          <span className={`font-medium ${isThis?'text-[#b20202]':'text-gray-800'}`}>{item.subProductName||item.name||item.subProductId?.name||'—'}</span>
                          {isThis && <span className="ml-1.5 rounded bg-[#b20202]/10 px-1 py-0.5 text-[9px] font-bold text-[#b20202]">this</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{itemQty}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{fmt(item.unitCost??item.unitPrice??0)}</td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gray-900">{fmt(itemTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
              <div className="border-t border-gray-100 px-5 py-3 text-xs">
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>PO Total</span>
                  <span className="tabular-nums" style={{color:'#b20202'}}>{fmt(poTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
