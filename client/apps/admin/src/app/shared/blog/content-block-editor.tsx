'use client';

// Sortable content block editor — the rich-text field for blog posts.
// Each block is a card with a drag handle, type selector, inline formatting
// toolbar (for text blocks), and type-specific inputs. Storage format stays
// the ContentBlock[] shape the public renderer expects.

import { useRef, type CSSProperties } from 'react';
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
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input, Textarea, Select } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiDotsSixVerticalBold,
  PiPlusBold,
  PiQuotesBold,
  PiImageBold,
  PiTextTBold,
  PiTextHBold,
  PiListBulletsBold,
  PiListNumbersBold,
  PiLightbulbBold,
  PiNotepadBold,
} from 'react-icons/pi';
import {
  BLOCK_OPTIONS,
  BLOCK_ACCENT,
  BLOCK_LABEL,
  BLOCK_PLACEHOLDER,
  LIST_TYPES,
  type BlockType,
  type ContentBlock,
  makeBlock,
  toggleInline,
  insertLink,
  type TextEdit,
} from './blog-helpers';
import RichTextToolbar from './rich-text-toolbar';
import { BlockControls, ImageUploadButton, UrlInput } from './editor-primitives';
import SmartImagePreview from './smart-image-preview';

const BLOCK_ICON: Record<BlockType, any> = {
  p: PiTextTBold,
  h2: PiTextHBold,
  h3: PiTextHBold,
  ul: PiListBulletsBold,
  ol: PiListNumbersBold,
  quote: PiQuotesBold,
  tip: PiLightbulbBold,
  image: PiImageBold,
};

// Per-type visual cues so blocks feel different, not identical cards.
const BLOCK_BODY_CLS: Record<BlockType, string> = {
  p: '',
  h2: 'bg-blue-50/30',
  h3: 'bg-blue-50/20',
  ul: 'bg-emerald-50/30',
  ol: 'bg-emerald-50/20',
  quote: 'bg-amber-50/30',
  tip: 'bg-violet-50/30',
  image: 'bg-sky-50/20',
};

const TEXTAREA_ROWS: Record<BlockType, number> = {
  p: 4,
  h2: 2,
  h3: 2,
  quote: 3,
  tip: 3,
  ul: 3,
  ol: 3,
  image: 0,
};

function SortableBlock({
  block,
  index,
  total,
  token,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
}: {
  block: ContentBlock;
  index: number;
  total: number;
  token: string;
  onUpdate: (patch: Partial<ContentBlock>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertAfter: (type: BlockType) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  const applyEdit = (edit: TextEdit) => {
    onUpdate({ text: edit.text });
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.selStart, edit.selEnd);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const s = el.selectionStart;
    const end = el.selectionEnd;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyEdit(toggleInline(block.text || '', s, end, '**'));
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyEdit(toggleInline(block.text || '', s, end, '*'));
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const url = window.prompt('Link URL', '/');
      if (url != null) applyEdit(insertLink(block.text || '', s, end, url));
      return;
    }
    // Enter on an empty paragraph/heading inserts a new paragraph — quick authoring.
    if (e.key === 'Enter' && !e.shiftKey) {
      const value = block.text || '';
      if (
        value.trim() === '' &&
        (block.type === 'p' || block.type === 'h2' || block.type === 'h3')
      ) {
        e.preventDefault();
        onInsertAfter('p');
        return;
      }
    }
  };

  const Icon = BLOCK_ICON[block.type];
  const isEmpty =
    block.type !== 'image'
      ? !block.text && !(block.items?.length)
      : !block.src;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-l-[3px] bg-white shadow-sm transition',
        'hover:shadow-md hover:border-gray-200',
        BLOCK_ACCENT[block.type] ?? 'border-l-gray-300',
        isDragging && 'z-50 shadow-lg ring-2 ring-violet-300',
      )}
    >
      {/* Subtle tinted body backdrop by type */}
      <div className={cn('absolute inset-0', BLOCK_BODY_CLS[block.type])} />

      <div className="relative p-2.5">
        {/* Block header: drag handle + type + controls */}
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md text-gray-300 transition hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <PiDotsSixVerticalBold className="h-4 w-4" />
          </button>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-gray-500 ring-1 ring-gray-100">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <Select
            options={BLOCK_OPTIONS}
            value={block.type}
            onChange={(v: any) => {
              const next = (v?.value ?? v) as BlockType;
              if (next === block.type) return;
              if (next === 'image') onUpdate(makeBlock('image'));
              else if (LIST_TYPES.includes(next))
                onUpdate({ type: next, items: [], text: '' });
              else onUpdate({ type: next, items: [], text: block.text || '' });
            }}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) =>
              BLOCK_OPTIONS.find((o) => o.value === v)?.label ?? v
            }
            className="w-36"
            size="sm"
          />
          <span className="ms-1 hidden text-[11px] font-medium text-gray-300 sm:inline">
            #{index + 1}
          </span>
          <div className="ms-auto">
            <BlockControls
              onUp={onMoveUp}
              onDown={onMoveDown}
              onDelete={onRemove}
              upDisabled={index === 0}
              downDisabled={index === total - 1}
            />
          </div>
        </div>

        {/* Block body — type-specific */}
        {block.type === 'image' ? (
          <div className="space-y-2 px-1 pb-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-gray-500">
                Image URL
              </label>
              <ImageUploadButton
                token={token}
                label="Upload"
                onUploaded={(url) => onUpdate({ src: url })}
              />
            </div>
            <UrlInput
              value={block.src || ''}
              onChange={(v) => onUpdate({ src: v })}
              placeholder="https://… or upload a file"
              size="sm"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                size="sm"
                placeholder="Alt text (accessibility & SEO)"
                value={block.alt || ''}
                onChange={(e) => onUpdate({ alt: e.target.value })}
              />
              <Input
                size="sm"
                placeholder="Caption (optional)"
                value={block.caption || ''}
                onChange={(e) => onUpdate({ caption: e.target.value })}
              />
            </div>
            {block.src ? (
              <SmartImagePreview
                src={block.src}
                alt={block.alt || 'Block image preview'}
                aspectClassName="aspect-[16/9]"
                fit="contain"
                className="mt-1"
              />
            ) : (
              <SmartImagePreview
                src=""
                alt=""
                aspectClassName="h-24"
                fit="contain"
                emptyLabel="Upload or paste an image URL"
                className="mt-1"
              />
            )}
          </div>
        ) : LIST_TYPES.includes(block.type) ? (
          <Textarea
            rows={3}
            placeholder="One list item per line"
            value={(block.items || []).join('\n')}
            onChange={(e) => onUpdate({ items: e.target.value.split('\n') })}
            className="[&>textarea]:resize-y"
          />
        ) : (
          <div>
            <RichTextToolbar
              value={block.text || ''}
              textareaRef={textareaRef}
              onEdit={applyEdit}
              onInsertImage={() => onInsertAfter('image')}
              onTurnIntoList={(t) => onUpdate({ type: t, items: [], text: '' })}
              onTurnIntoQuote={() => onUpdate({ type: 'quote' })}
            />
            <Textarea
              ref={textareaRef as any}
              rows={TEXTAREA_ROWS[block.type]}
              placeholder={BLOCK_PLACEHOLDER[block.type] ?? 'Text…'}
              value={block.text || ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
              onKeyDown={handleKeyDown}
              className={cn(
                'rounded-t-none [&>textarea]:resize-y',
                block.type === 'quote' && '[&>textarea]:italic',
              )}
            />
          </div>
        )}

        {/* Empty hint for first block */}
        {isEmpty && index === 0 && total === 1 ? (
          <p className="mt-2 px-1 text-xs text-gray-400">
            Start writing, or use the toolbar above to format. Drag the handle
            to reorder blocks.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Add-block palette ───────────────────────────────────────────────────────

const ADD_PALETTE: { type: BlockType; icon: any; label: string }[] = [
  { type: 'p', icon: PiTextTBold, label: 'Paragraph' },
  { type: 'h2', icon: PiTextHBold, label: 'Heading' },
  { type: 'h3', icon: PiTextHBold, label: 'Subheading' },
  { type: 'ul', icon: PiListBulletsBold, label: 'Bullets' },
  { type: 'ol', icon: PiListNumbersBold, label: 'Numbered' },
  { type: 'quote', icon: PiQuotesBold, label: 'Quote' },
  { type: 'tip', icon: PiLightbulbBold, label: 'Pro tip' },
  { type: 'image', icon: PiImageBold, label: 'Image' },
];

export default function ContentBlockEditor({
  content,
  token,
  onUpdate,
  onAdd,
  onRemove,
  onMove,
  onReorder,
}: {
  content: ContentBlock[];
  token: string;
  onUpdate: (i: number, patch: Partial<ContentBlock>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorder(Number(active.id), Number(over.id));
  };

  const insertAfter = (i: number, type: BlockType) => {
    onAdd();
    const last = content.length;
    if (i + 1 !== last) {
      onReorder(last, i + 1);
    }
    requestAnimationFrame(() => onUpdate(i + 1, makeBlock(type)));
  };

  const addTyped = (type: BlockType) => {
    onAdd();
    const last = content.length;
    requestAnimationFrame(() => onUpdate(last, makeBlock(type)));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={content.map((_, i) => i)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2.5">
          {content.map((block, i) => (
            <SortableBlock
              key={i}
              block={block}
              index={i}
              total={content.length}
              token={token}
              onUpdate={(patch) => onUpdate(i, patch)}
              onRemove={() => onRemove(i)}
              onMoveUp={() => onMove(i, -1)}
              onMoveDown={() => onMove(i, 1)}
              onInsertAfter={(type) => insertAfter(i, type)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add-block palette */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="me-1 flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <PiPlusBold className="h-3.5 w-3.5" /> Add
        </span>
        {ADD_PALETTE.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => addTyped(type)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition',
              'hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-700',
            )}
            title={`Add ${BLOCK_LABEL[type]}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
    </DndContext>
  );
}