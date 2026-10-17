'use client';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  PiPlus,
  PiBookmarkSimple,
  PiTextT,
  PiSquaresFour,
  PiCamera,
} from 'react-icons/pi';
import SortableLineRow from './sales-line-sortable-row';
import styles from './sales-line-responsive.module.css';
import type { PricedLine, SalesLineTableProps } from './sales-line-types';
export type {
  LineType,
  DraftLine,
  PricedLine,
  SalesLineTableProps,
} from './sales-line-types';
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
    (l) => l.lineType === 'product' && !l.subProductId,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  return (
    <>
      <div className={`${styles.lines} rounded-lg border border-gray-200`}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={lines.map((l) => l.key)}
            strategy={verticalListSortingStrategy}
          >
            <table
              aria-label="Sales document lines"
              className="w-full min-w-[1200px] table-fixed text-sm"
            >
              <colgroup>
                <col className="w-7" />
                <col />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-24" />
                <col className="w-40" />
                <col className="w-24" />
                <col className="w-20" />
                <col className="w-44" />
                <col className="w-9" />
              </colgroup>
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
                    Pack Size
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                    Packs
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
                    Untaxed total
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
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 [&>button]:min-h-10">
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
      out.set(
        currentKey,
        Math.round(
          ((out.get(currentKey) ?? 0) +
            Math.max(0, l.lineTotal - (l.promoDiscount || 0))) *
            100,
        ) / 100,
      );
    }
  }
  return out;
}
