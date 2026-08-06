'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  PiCaretDownBold,
  PiMagnifyingGlassBold,
  PiNotePencilDuotone,
} from 'react-icons/pi';
import { Dropdown, Text } from 'rizzui';
import { routes } from '@/config/routes';
import { useSnippets } from './use-mail';
import type { Snippet } from './types';

/** Enough to tell two canned replies apart in the menu without a preview pane. */
const PREVIEW_LENGTH = 90;

/**
 * A one-line plain-text preview of a snippet body.
 *
 * The body is server-sanitized HTML, but this is a *menu label*, not a rendered
 * body — tags are stripped rather than trusted, so a snippet full of markup
 * cannot make the row unreadable or inject anything into the dropdown.
 */
function preview(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > PREVIEW_LENGTH
    ? `${text.slice(0, PREVIEW_LENGTH)}…`
    : text;
}

const matches = (s: Snippet, term: string) => {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return (
    s.title.toLowerCase().includes(q) ||
    s.tags.some((tag) => tag.includes(q)) ||
    preview(s.body).toLowerCase().includes(q)
  );
};

interface Props {
  onInsert: (body: string) => void;
}

/**
 * Inserts a saved reply into the draft being composed.
 *
 * Deliberately appends rather than replaces: the editor usually already holds a
 * quoted thread or a half-written sentence, and a picker that silently discarded
 * that would lose an operator's work on a mis-click.
 *
 * A load failure renders as a disabled control saying so — never as an empty
 * menu, which would read as "your team has no snippets" and send the operator
 * off to write the reply by hand.
 */
export default function SnippetPicker({ onInsert }: Props) {
  const snippets = useSnippets();
  const [term, setTerm] = useState('');

  const list = snippets.data || [];
  const visible = list.filter((s) => matches(s, term));

  const label = snippets.error
    ? 'Snippets unavailable'
    : snippets.loading
      ? 'Loading snippets…'
      : 'Insert snippet';

  return (
    <Dropdown placement="bottom-start">
      <Dropdown.Trigger disabled={Boolean(snippets.error) || snippets.loading}>
        {/* Visual trigger only — Dropdown.Trigger already renders a <button>,
            so a nested <button> here would throw a hydration error. */}
        <span
          title={snippets.error ?? undefined}
          className="inline-flex items-center gap-2 rounded-lg border border-muted bg-gray-0 px-3 py-2 text-sm text-gray-600 transition-colors duration-200 hover:bg-gray-100 dark:bg-gray-50"
        >
          <PiNotePencilDuotone className="h-4 w-4" />
          {label}
          <PiCaretDownBold className="h-3 w-3 text-gray-500" />
        </span>
      </Dropdown.Trigger>

      <Dropdown.Menu className="w-[22rem] divide-y divide-muted !p-0">
        <div className="p-2">
          <span className="relative block">
            <PiMagnifyingGlassBold className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search snippets"
              aria-label="Search snippets"
              // Typing inside a menu must not be read as menu navigation.
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded-md border border-muted bg-gray-0 py-1.5 pe-2.5 ps-8 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-50"
            />
          </span>
        </div>

        <div className="custom-scrollbar max-h-72 overflow-y-auto py-1">
          {visible.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Text className="text-sm text-gray-500">
                {list.length === 0
                  ? 'No snippets saved yet.'
                  : 'No snippet matches that search.'}
              </Text>
            </div>
          ) : (
            visible.map((s) => (
              <Dropdown.Item
                key={s.id}
                className="flex-col !items-start gap-0.5"
                onClick={() => onInsert(s.body)}
              >
                <span className="w-full truncate text-sm font-medium text-gray-900">
                  {s.title}
                </span>
                <span className="w-full truncate text-xs text-gray-500">
                  {preview(s.body) || 'Empty snippet'}
                </span>
              </Dropdown.Item>
            ))
          )}
        </div>

        <div className="p-2">
          <Link
            href={routes.support.snippets}
            className="block rounded-md px-2 py-1.5 text-sm text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900"
          >
            Manage snippets
          </Link>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
}
