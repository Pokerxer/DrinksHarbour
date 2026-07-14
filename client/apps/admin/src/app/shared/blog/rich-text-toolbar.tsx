'use client';

// Inline markdown formatting toolbar for a textarea-backed content block.
// Operates on raw value + selection, so the parent stays the single source
// of truth for the block state.

import { useRef, useState, useEffect } from 'react';
import {
  PiTextBBold,
  PiTextItalicBold,
  PiLinkBold,
  PiQuotesBold,
  PiListBulletsBold,
  PiListNumbersBold,
  PiImageBold,
} from 'react-icons/pi';
import {
  toggleInline,
  insertLink,
  type TextEdit,
} from './blog-helpers';

interface Props {
  value: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onEdit: (edit: TextEdit) => void;
  onInsertImage?: () => void;
  onTurnIntoList?: (type: 'ul' | 'ol') => void;
  onTurnIntoQuote?: () => void;
}

type Tool = 'bold' | 'italic' | 'link' | 'quote' | 'ul' | 'ol' | 'image';

const TOOLBtn: { tool: Tool; icon: any; label: string }[] = [
  { tool: 'bold', icon: PiTextBBold, label: 'Bold  (Ctrl+B)' },
  { tool: 'italic', icon: PiTextItalicBold, label: 'Italic  (Ctrl+I)' },
  { tool: 'link', icon: PiLinkBold, label: 'Link  (Ctrl+K)' },
  { tool: 'quote', icon: PiQuotesBold, label: 'Blockquote' },
  { tool: 'ul', icon: PiListBulletsBold, label: 'Bullet list' },
  { tool: 'ol', icon: PiListNumbersBold, label: 'Numbered list' },
  { tool: 'image', icon: PiImageBold, label: 'Insert image block' },
];

export default function RichTextToolbar({
  value,
  textareaRef,
  onEdit,
  onInsertImage,
  onTurnIntoList,
  onTurnIntoQuote,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkOpen) {
      setUrl('');
      requestAnimationFrame(() => linkInputRef.current?.focus());
    }
  }, [linkOpen]);

  const getSel = (): { s: number; e: number } => {
    const el = textareaRef.current;
    if (!el) return { s: 0, e: 0 };
    return { s: el.selectionStart ?? 0, e: el.selectionEnd ?? 0 };
  };

  const focusRestore = (edit: TextEdit) => {
    onEdit(edit);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.selStart, edit.selEnd);
    });
  };

  const apply = (tool: Tool) => {
    const { s, e } = getSel();
    switch (tool) {
      case 'bold':
        focusRestore(toggleInline(value, s, e, '**'));
        break;
      case 'italic':
        focusRestore(toggleInline(value, s, e, '*'));
        break;
      case 'link':
        setLinkOpen(true);
        break;
      case 'quote':
        onTurnIntoQuote?.();
        break;
      case 'ul':
        onTurnIntoList?.('ul');
        break;
      case 'ol':
        onTurnIntoList?.('ol');
        break;
      case 'image':
        onInsertImage?.();
        break;
    }
  };

  const confirmLink = () => {
    const { s, e } = getSel();
    const u = url.trim() || '/';
    focusRestore(insertLink(value, s, e, u));
    setLinkOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-gray-200 bg-gray-50/80 px-2 py-1.5 backdrop-blur-sm">
      {TOOLBtn.map(({ tool, icon: Icon, label }) => (
        <button
          key={tool}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => apply(tool)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition hover:bg-white hover:text-gray-900 hover:shadow-sm"
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:block" />

      <span className="hidden text-[11px] text-gray-400 sm:inline">
        Bold <code className="rounded bg-white px-1">**</code> · Italic{' '}
        <code className="rounded bg-white px-1">*</code> · Link{' '}
        <code className="rounded bg-white px-1">[t](/p)</code>
      </span>

      {linkOpen ? (
        <div className="ms-auto flex w-full items-center gap-2 rounded-lg bg-white p-1.5 shadow-sm sm:w-auto">
          <input
            ref={linkInputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmLink();
              }
              if (e.key === 'Escape') setLinkOpen(false);
            }}
            placeholder="/product/slug or https://…"
            className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300 sm:w-56"
          />
          <button
            type="button"
            onClick={confirmLink}
            className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700"
          >
            Link
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}