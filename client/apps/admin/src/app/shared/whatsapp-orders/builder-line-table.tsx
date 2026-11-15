'use client';
import React from 'react';
import PurchaseLineActions from '../purchases/purchase-line-actions';
import type { BuilderLine } from '@/services/whatsapp-order.service';
import BuilderProductRow from './builder-line-rows';
import styles from './builder-line-responsive.module.css';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n);

export default function BuilderLineTable({
  lines,
  previewing,
  onAddProduct,
  onAddSection,
  onAddNote,
  onOpenCatalog,
  onOpenScan,
  onUpdate,
  onSetQuantity,
  onRemove,
}: {
  lines: BuilderLine[];
  previewing: boolean;
  onAddProduct: () => void;
  onAddSection: () => void;
  onAddNote: () => void;
  onOpenCatalog: () => void;
  onOpenScan: () => void;
  onUpdate: (key: string, patch: Partial<BuilderLine>) => void;
  onSetQuantity: (key: string, q: number) => void;
  onRemove: (key: string) => void;
}) {
  // Section running subtotals: sum product lines beneath a section until the
  // next section (computeSectionSubtotals pattern from sales-line-table.tsx:198).
  const sectionSubtotals = new Map<string, number>();
  let acc: { key: string; total: number } | null = null;
  for (const l of lines) {
    if (l.lineType === 'section') {
      if (acc) sectionSubtotals.set(acc.key, acc.total);
      acc = { key: l.key, total: 0 };
    } else if (l.lineType === 'product' && acc)
      acc.total += (l.unitPrice || 0) * l.quantity;
  }
  if (acc) sectionSubtotals.set(acc.key, acc.total);

  const emptyProductRow = lines.some(
    (l) => l.lineType === 'product' && !l.subProductId
  );
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-800">Order Lines</h2>
        {previewing && (
          <span role="status" className="text-xs text-gray-500">
            Updating prices…
          </span>
        )}
      </div>
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
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No lines yet — use Catalogue, Scan &amp; Match, or “Add a
                  product”.
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <BuilderProductRow
                key={l.key}
                line={l}
                sectionSubtotal={sectionSubtotals.get(l.key)}
                onOpenCatalog={onOpenCatalog}
                onUpdate={onUpdate}
                onSetQuantity={onSetQuantity}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>
      </div>
      <PurchaseLineActions
        hasEmptyProductRow={emptyProductRow}
        onAddProduct={onAddProduct}
        onAddPresentationLine={(type) =>
          type === 'section' ? onAddSection() : onAddNote()
        }
        onOpenCatalogue={onOpenCatalog}
        onOpenScan={onOpenScan}
        scanTitle="Photograph, upload or paste an order list"
      />
    </div>
  );
}
