// client/apps/admin/src/app/shared/sales/sales-line-table.tsx
'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PiPlus,
  PiTrash,
  PiArrowSquareOut,
  PiPencilSimple,
  PiSquaresFour,
  PiCamera,
  PiTextT,
  PiBookmarkSimple,
  PiDotsSixVertical,
  PiChartBar,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { resolveDiscount } from './sales-create-pricing-helpers';
import ProductLineSearch, {
  type ProductLineSelection,
} from './product-line-search';
import SalesLineSectionRow from './sales-line-section-row';
import SalesLineNoteRow from './sales-line-note-row';
import SalesNumberInput from './sales-number-input';

const INLINE_CELL_CLS =
  'w-full border-0 border-b border-transparent bg-transparent px-1 py-1 text-right text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-0';

const DESC_CLS =
  'w-full resize-y border-0 border-b border-transparent bg-gray-50/60 px-2 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-0';

export type LineType = 'product' | 'section' | 'note';

export interface DraftLine {
  key: string;
  lineType: LineType;
  subProductId: string;
  product?: string;
  name: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  baseUnitPrice: number;
  discount: number;
  /** 'fixed' = flat ₦ off the whole line; 'percentage' = % of each unit. */
  discountType: 'fixed' | 'percentage';
  taxRate: number;
  costPrice: number;
  /** True once the operator has typed a manual unit price for this line — it
   * then ignores the live pricelist/bundle computation and the server trusts
   * it verbatim. Reset to false whenever a new product/size is picked. */
  priceOverridden: boolean;
  /** True when baseUnitPrice came from the server's authoritative pricing
   * engine (price-lines endpoint or a stored order line). Engine prices are
   * final — pricelist/bundle rules are already folded in — so the client
   * displays them verbatim instead of re-running its own pricelist math. */
  enginePriced?: boolean;
  availableStock?: number;
  /** Operator-entered per-line note (newline of the line; shown under the product). */
  description?: string;
  activeBundles?: unknown;
  originalPrice?: number;
}

export interface PricedLine extends DraftLine {
  unitPrice: number;
  lineTotal: number;
  taxAmount: number;
}

export interface SalesLineTableProps {
  token: string;
  lines: PricedLine[];
  onUpdate: (key: string, patch: Partial<DraftLine>) => void;
  onAdd: () => void;
  onAddSection: () => void;
  onAddNote: () => void;
  onOpenCatalog: () => void;
  onOpenScan: () => void;
  onRemove: (key: string) => void;
  /** Reorder lines by drag-and-drop. Receives the dragged key + the target key. */
  onReorder: (activeKey: string, overKey: string) => void;
  warehouseId?: string;
  /** Display name of the selected warehouse (for the stock tooltip). */
  warehouseName?: string;
}

/**
 * Order-lines table for the Sales create/edit page. Lines are discriminated by
 * `lineType`: 'product' (priced line), 'section' (titled header + running
 * subtotal), or 'note' (standalone free-text). All line types are draggable to
 * reorder via a grip handle in the leading column. Each product line renders
 * its name as a link to the SubProduct's edit (inventory) page plus an inline
 * description beneath the name. The action row exposes Add a product / section
 * / note / Catalogue.
 */
export default function SalesLineTable({
  token,
  lines,
  onUpdate,
  onAdd,
  onAddSection,
  onAddNote,
  onOpenCatalog,
  onOpenScan,
  onRemove,
  onReorder,
  warehouseId,
  warehouseName,
}: SalesLineTableProps) {
  const sectionSubtotals = computeSectionSubtotals(lines);
  const hasEmptyProductRow = lines.some(
    (l) => l.lineType === 'product' && !l.subProductId
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={lines.map((l) => l.key)}
          strategy={verticalListSortingStrategy}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-6 px-1 py-2" />
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                  Product
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                  Qty
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                  Unit Price
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                  Discount
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                  Tax %
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                  Line Total
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line) => (
                <SortableLineRow
                  key={line.key}
                  token={token}
                  line={line}
                  subtotal={sectionSubtotals.get(line.key) ?? 0}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  warehouseId={warehouseId}
                  warehouseName={warehouseName}
                />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onAdd}
          disabled={hasEmptyProductRow}
          title={
            hasEmptyProductRow
              ? 'Select a product on the empty row first'
              : undefined
          }
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PiPlus className="h-3.5 w-3.5" /> Add a product
        </button>
        <button
          type="button"
          onClick={onAddSection}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <PiBookmarkSimple className="h-3.5 w-3.5" /> Add a section
        </button>
        <button
          type="button"
          onClick={onAddNote}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <PiTextT className="h-3.5 w-3.5" /> Add a note
        </button>
        <button
          type="button"
          onClick={onOpenCatalog}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <PiSquaresFour className="h-3.5 w-3.5" /> Catalogue
        </button>
        <button
          type="button"
          onClick={onOpenScan}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <PiCamera className="h-3.5 w-3.5" /> Scan &amp; Match
        </button>
      </div>
    </>
  );
}

/** Map of section-line key → sum of lineTotal for product lines beneath it
 *  until the next section (or end). Lines before the first section are ignored. */
function computeSectionSubtotals(lines: PricedLine[]): Map<string, number> {
  const out = new Map<string, number>();
  let currentKey: string | null = null;
  for (const l of lines) {
    if (l.lineType === 'section') {
      currentKey = l.key;
      out.set(currentKey, 0);
      continue;
    }
    if (l.lineType !== 'product') continue;
    if (currentKey) {
      out.set(currentKey, (out.get(currentKey) ?? 0) + l.lineTotal);
    }
  }
  return out;
}

/** A drag handle bound to the sortable item's listeners. */
function DragHandle({
  listeners,
}: {
  listeners?: DraggableSyntheticListeners;
}) {
  return (
    <button
      type="button"
      className="flex h-6 w-4 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500 active:cursor-grabbing"
      title="Drag to reorder"
      {...listeners}
    >
      <PiDotsSixVertical className="h-3.5 w-3.5" />
    </button>
  );
}

interface SortableLineRowProps {
  token: string;
  line: PricedLine;
  subtotal: number;
  onUpdate: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
  warehouseId?: string;
  warehouseName?: string;
}

/** Sortable wrapper that applies the dnd-kit transform to the <tr> and renders
 *  the appropriate row type (section / note / product) with a drag handle. */
function SortableLineRow({
  token,
  line,
  subtotal,
  onUpdate,
  onRemove,
  warehouseId,
  warehouseName,
}: SortableLineRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.key });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const dragHandle = <DragHandle listeners={listeners} />;

  if (line.lineType === 'section') {
    return (
      <tr
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="bg-gray-50/70"
      >
        <SalesLineSectionRow
          line={line}
          subtotal={subtotal}
          onUpdate={onUpdate}
          onRemove={onRemove}
          dragHandle={dragHandle}
        />
      </tr>
    );
  }

  if (line.lineType === 'note') {
    return (
      <tr ref={setNodeRef} style={style} {...attributes}>
        <SalesLineNoteRow
          line={line}
          onUpdate={onUpdate}
          onRemove={onRemove}
          dragHandle={dragHandle}
        />
      </tr>
    );
  }

  return (
    <SalesLineProductRow
      token={token}
      line={line}
      hasProduct={!!line.subProductId}
      onUpdate={onUpdate}
      onRemove={onRemove}
      setNodeRef={setNodeRef}
      style={style}
      attributes={attributes}
      dragHandle={dragHandle}
      warehouseId={warehouseId}
      warehouseName={warehouseName}
    />
  );
}

interface SalesLineProductRowProps {
  token: string;
  line: PricedLine;
  hasProduct: boolean;
  onUpdate: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: DraggableAttributes;
  dragHandle: ReactNode;
  warehouseId?: string;
  warehouseName?: string;
}

/** A product line rendered as a single sortable <tr>: the product cell holds
 *  the name/link + the inline description beneath it, keeping it one row so the
 *  dnd-kit transform applies cleanly. */
function SalesLineProductRow({
  token,
  line,
  hasProduct,
  onUpdate,
  onRemove,
  setNodeRef,
  style,
  attributes,
  dragHandle,
  warehouseId,
  warehouseName,
}: SalesLineProductRowProps) {
  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      <td className="w-6 px-1 py-2 align-top">{dragHandle}</td>
      <td className="px-2 py-2 align-top">
        {hasProduct ? (
          <SelectedProductCell
            line={line}
            onChange={() =>
              onUpdate(line.key, {
                subProductId: '',
                product: undefined,
                name: '',
                sku: '',
                sizeId: undefined,
                sizeName: undefined,
                baseUnitPrice: 0,
                costPrice: 0,
                taxRate: 0,
                priceOverridden: false,
                description: '',
              })
            }
          />
        ) : (
          <ProductLineSearch
            token={token}
            query={line.name}
            warehouseId={warehouseId}
            onSelect={(info: ProductLineSelection) =>
              onUpdate(line.key, {
                subProductId: info.subProductId,
                product: info.productId,
                name: info.name,
                sku: info.sku,
                sizeId: info.sizeId,
                sizeName: info.sizeName,
                baseUnitPrice: info.sellingPrice,
                costPrice: info.costPrice,
                taxRate: info.taxRate,
                priceOverridden: false,
                activeBundles: info.bundleDeals,
                originalPrice: info.originalPrice,
                description: '',
              })
            }
          />
        )}
        {hasProduct && warehouseId && line.availableStock === 0 && (
          <p className="mt-1 inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
            Not available in this warehouse
          </p>
        )}
        {hasProduct && (
          <input
            type="text"
            value={line.description ?? ''}
            onChange={(e) =>
              onUpdate(line.key, { description: e.target.value })
            }
            placeholder="Add a description / note for this line…"
            className={DESC_CLS}
          />
        )}
      </td>
      <td className="px-2 py-2 align-top">
        <div className="flex items-center gap-1.5">
          <SalesNumberInput
            value={line.quantity}
            min={1}
            fallback={1}
            onCommit={(v) => onUpdate(line.key, { quantity: Math.round(v) })}
            className={`${INLINE_CELL_CLS} w-16`}
          />
          {line.availableStock != null &&
            (() => {
              const ok = line.availableStock >= line.quantity;
              return (
                <span className="group relative flex items-center">
                  <PiChartBar
                    className={`h-3.5 w-3.5 shrink-0 ${ok ? 'text-emerald-500' : 'text-red-500'}`}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 rounded-lg border border-gray-100 bg-white p-2.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-700">
                      Stock
                    </span>
                    {line.sizeName && (
                      <span className="mb-1.5 block text-[10px] text-gray-400">
                        {line.sizeName}
                      </span>
                    )}
                    <span className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">
                        Available{warehouseName ? ` · ${warehouseName}` : ''}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {line.availableStock}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">Ordering</span>
                      <span
                        className={`font-semibold ${ok ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {line.quantity}
                      </span>
                    </span>
                    {!ok && (
                      <span className="mt-1.5 block rounded bg-red-50 px-1.5 py-1 text-[10px] font-medium text-red-600">
                        {line.quantity - line.availableStock} unit
                        {line.quantity - line.availableStock !== 1
                          ? 's'
                          : ''}{' '}
                        short
                      </span>
                    )}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white" />
                  </span>
                </span>
              );
            })()}
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="flex items-center justify-end gap-1.5">
          {line.priceOverridden && (
            <span
              title="Manually set"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            />
          )}
          <SalesNumberInput
            value={line.unitPrice}
            min={0}
            onCommit={(v) =>
              onUpdate(line.key, { baseUnitPrice: v, priceOverridden: true })
            }
            className={`${INLINE_CELL_CLS} w-24`}
          />
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="flex items-center justify-end gap-1">
          <SalesNumberInput
            value={line.discount}
            min={0}
            max={line.discountType === 'percentage' ? 100 : undefined}
            step={line.discountType === 'percentage' ? 0.5 : undefined}
            onCommit={(v) => onUpdate(line.key, { discount: v })}
            className={`${INLINE_CELL_CLS} w-16`}
          />
          <button
            type="button"
            onClick={() =>
              // Switching ₦→% keeps the typed number, so clamp it into the
              // 0–100 range a percentage allows (mirrors the server clamp).
              onUpdate(line.key, {
                discountType:
                  line.discountType === 'percentage' ? 'fixed' : 'percentage',
                ...(line.discountType === 'fixed'
                  ? { discount: Math.min(100, line.discount) }
                  : {}),
              })
            }
            title="Toggle discount type"
            className="shrink-0 rounded border border-gray-200 px-1 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-50"
          >
            {line.discountType === 'percentage' ? '%' : '₦'}
          </button>
        </div>
        {line.discount > 0 && line.discountType === 'percentage' && (
          <p className="mt-0.5 text-right text-[10px] text-gray-400">
            −{fmtCur(resolveDiscount(line.unitPrice, line), 'NGN')}
          </p>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        <SalesNumberInput
          value={line.taxRate}
          min={0}
          max={100}
          step="0.5"
          onCommit={(v) => onUpdate(line.key, { taxRate: v })}
          className={`${INLINE_CELL_CLS} w-16`}
        />
      </td>
      <td className="px-2 py-2 text-right align-top text-sm font-semibold text-gray-900">
        {fmtCur(line.lineTotal, 'NGN')}
      </td>
      <td className="px-2 py-2 text-right align-top">
        <button
          type="button"
          onClick={() => onRemove(line.key)}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <PiTrash className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

/** The picked product's name shown as a link to its SubProduct edit (inventory) page. */
function SelectedProductCell({
  line,
  onChange,
}: {
  line: PricedLine;
  onChange: () => void;
}) {
  const href = routes.eCommerce.editSubProduct(line.subProductId);
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          title="Open subproduct inventory"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-brand hover:underline"
        >
          <span className="truncate">{line.name}</span>
          <PiArrowSquareOut className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Link>
        {line.sku && (
          <p className="mt-0.5 font-mono text-[10px] text-gray-400">
            {line.sku}
          </p>
        )}
        {line.sizeName && (
          <p className="mt-0.5 text-[10px] text-gray-400">
            Size: {line.sizeName}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onChange}
        title="Change product"
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <PiPencilSimple className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
