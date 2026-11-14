'use client';
// builder-line-rows.tsx — three row variants dispatched by lineType
import React from 'react';
import * as Icon from 'react-icons/pi';
import type { BuilderLine } from '@/services/whatsapp-order.service';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function BuilderProductRow({ line: l, sectionSubtotal, onUpdate, onSetQuantity, onRemove }: {
  line: BuilderLine; sectionSubtotal?: number;
  onUpdate: (key: string, patch: Partial<BuilderLine>) => void;
  onSetQuantity: (key: string, q: number) => void; onRemove: (key: string) => void;
}) {
  if (l.lineType === 'section') {
    return (
      <tr className="bg-gray-50/70" data-label="Section">
        <td colSpan={4} className="px-4 py-2">
          <input value={l.productName || ''} onChange={(e) => onUpdate(l.key, { productName: e.target.value })}
            placeholder="Section title…" data-label="Section"
            className="w-full bg-transparent font-lexend text-sm font-bold text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400" />
        </td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
          {sectionSubtotal ? fmtNgn(sectionSubtotal) : ''}
          <button type="button" onClick={() => onRemove(l.key)} className="ml-2 text-gray-300 hover:text-red-600"><Icon.PiXBold size={12} /></button>
        </td>
      </tr>
    );
  }
  if (l.lineType === 'note') {
    return (
      <tr className="bg-amber-50/40" data-label="Note">
        <td colSpan={4} className="px-4 py-2">
          <textarea value={l.description || ''} onChange={(e) => onUpdate(l.key, { description: e.target.value })}
            rows={1} placeholder="Note for the quotation / invoice…" data-label="Note"
            className="w-full resize-none bg-transparent text-sm italic text-gray-700 outline-none placeholder:text-gray-400" />
        </td>
        <td className="px-3 py-2 text-right">
          <button type="button" onClick={() => onRemove(l.key)} className="text-gray-300 hover:text-red-600"><Icon.PiXBold size={12} /></button>
        </td>
      </tr>
    );
  }
  const total = (l.unitPrice || 0) * l.quantity;
  return (
    <tr className="border-t border-gray-50 align-top" data-label="Product">
      <td className="px-4 py-2" data-label="Product">
        <p className="font-semibold text-gray-900">{l.productName || <span className="text-gray-400">Select from catalogue…</span>}</p>
        <p className="text-xs text-gray-400">{[l.tenantName, l.sizeName].filter(Boolean).join(' · ')}{l.availableStock === 0 ? ' · out of stock' : ''}</p>
        <textarea value={l.description || ''} onChange={(e) => onUpdate(l.key, { description: e.target.value })}
          rows={1} placeholder="Add a line note (printed on the documents)…" data-label="Line note"
          className="mt-1 w-full resize-none rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 outline-none focus:bg-white focus:ring-1 focus:ring-brand/40" />
      </td>
      <td className="px-3 py-2" data-label="Qty">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onSetQuantity(l.key, Math.max(1, l.quantity - 1))} className="h-6 w-6 rounded border border-gray-200 font-bold text-gray-600">−</button>
          <input type="number" min={1} value={l.quantity} onChange={(e) => onSetQuantity(l.key, Math.max(1, Number(e.target.value) || 1))}
            className="w-12 rounded border border-gray-200 px-1 py-0.5 text-center text-sm" />
          <button type="button" onClick={() => onSetQuantity(l.key, l.quantity + 1)} className="h-6 w-6 rounded border border-gray-200 font-bold text-gray-600">+</button>
        </div>
      </td>
      <td className="px-3 py-2 text-right" data-label="Unit price">
        {l.unitPrice == null ? <span className="text-xs text-gray-400">pricing…</span> : fmtNgn(l.unitPrice)}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-gray-900" data-label="Line total">
        {l.unitPrice == null ? '—' : fmtNgn(total)}
      </td>
      <td className="px-2 py-2 text-right">
        <button type="button" onClick={() => onRemove(l.key)} className="text-gray-300 hover:text-red-600"><Icon.PiXBold size={14} /></button>
      </td>
    </tr>
  );
}
