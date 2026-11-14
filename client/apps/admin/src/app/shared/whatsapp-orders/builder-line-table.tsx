'use client';
import React from 'react';
import * as Icon from 'react-icons/pi';
import type { BuilderLine } from '@/services/whatsapp-order.service';
import BuilderProductRow from './builder-line-rows';
import styles from './builder-line-responsive.module.css';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function BuilderLineTable({ lines, previewing, onAddProduct, onAddSection, onAddNote,
  onOpenCatalog, onOpenScan, onUpdate, onSetQuantity, onRemove }: {
  lines: BuilderLine[]; previewing: boolean;
  onAddProduct: () => void; onAddSection: () => void; onAddNote: () => void;
  onOpenCatalog: () => void; onOpenScan: () => void;
  onUpdate: (key: string, patch: Partial<BuilderLine>) => void;
  onSetQuantity: (key: string, q: number) => void; onRemove: (key: string) => void;
}) {
  // Section running subtotals: sum product lines beneath a section until the
  // next section (computeSectionSubtotals pattern from sales-line-table.tsx:198).
  const sectionSubtotals = new Map<string, number>();
  let acc: { key: string; total: number } | null = null;
  for (const l of lines) {
    if (l.lineType === 'section') { if (acc) sectionSubtotals.set(acc.key, acc.total); acc = { key: l.key, total: 0 }; }
    else if (l.lineType === 'product' && acc) acc.total += (l.unitPrice || 0) * l.quantity;
  }
  if (acc) sectionSubtotals.set(acc.key, acc.total);

  const emptyProductRow = lines.some((l) => l.lineType === 'product' && !l.subProductId);
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3 font-lexend text-sm font-bold text-gray-900">Order lines</div>
      <div className={styles.lines}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-right">Unit price</th>
              <th className="px-3 py-2 text-right">Line total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                No lines yet — use Catalogue, Scan &amp; Match, or “Add a product”.
              </td></tr>
            )}
            {lines.map((l) => (
              <BuilderProductRow key={l.key} line={l} sectionSubtotal={sectionSubtotals.get(l.key)}
                onUpdate={onUpdate} onSetQuantity={onSetQuantity} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-2.5 text-xs">
        <button type="button" disabled={emptyProductRow} onClick={onAddProduct} title={emptyProductRow ? 'Fill the empty product row first' : undefined}
          className="flex items-center gap-1 font-semibold text-brand hover:underline disabled:opacity-40 disabled:no-underline">
          <Icon.PiPlusBold size={12} /> Add a product
        </button>
        <button type="button" onClick={onAddSection} className="flex items-center gap-1 font-semibold text-brand hover:underline">
          <Icon.PiBookmarkSimple size={12} /> Add a section
        </button>
        <button type="button" onClick={onAddNote} className="flex items-center gap-1 font-semibold text-brand hover:underline">
          <Icon.PiTextT size={12} /> Add a note
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button type="button" onClick={onOpenCatalog} className="flex items-center gap-1 font-semibold text-brand hover:underline">
          <Icon.PiSquaresFour size={12} /> Catalogue
        </button>
        <button type="button" onClick={onOpenScan} className="flex items-center gap-1 font-semibold text-brand hover:underline">
          <Icon.PiCamera size={12} /> Scan &amp; Match
        </button>
        {previewing && <span className="ml-auto flex items-center gap-1 text-gray-400"><span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" /> updating prices…</span>}
      </div>
    </div>
  );
}
