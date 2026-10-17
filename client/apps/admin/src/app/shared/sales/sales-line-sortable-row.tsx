'use client';
import type { CSSProperties } from 'react';
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PiDotsSixVertical } from 'react-icons/pi';
import type { DraftLine, PricedLine } from './sales-line-types';
import SalesLineProductRow from './sales-line-product-row';
import SalesLineSectionRow from './sales-line-section-row';
import SalesLineNoteRow from './sales-line-note-row';
/** A drag handle bound to the sortable item's listeners. */
function DragHandle({
  listeners,
  attributes,
}: {
  attributes: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
}) {
  return (
    <button
      type="button"
      className="flex h-6 w-4 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500 active:cursor-grabbing"
      aria-label="Move line"
      title="Drag or use arrow keys to reorder"
      {...attributes}
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
export default function SortableLineRow({
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
  const dragHandle = (
    <DragHandle listeners={listeners} attributes={attributes} />
  );

  if (line.lineType === 'section') {
    return (
      <tr ref={setNodeRef} style={style} className="bg-gray-50/70">
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
      <tr ref={setNodeRef} style={style}>
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
