'use client';

import DeletePopover from '@core/components/delete-popover';
import cn from '@core/utils/class-names';
import { useState } from 'react';
import {
  PiMagnifyingGlassBold,
  PiPencilSimpleLineDuotone,
  PiPlusBold,
} from 'react-icons/pi';
import { ActionIcon, Badge, Button, Input, Text, Title } from 'rizzui';
import * as api from '@/app/shared/support/inbox/api';
import {
  InboxEmptyState,
  InboxErrorState,
} from '@/app/shared/support/inbox/inbox-state-views';
import type { Snippet } from '@/app/shared/support/inbox/types';
import { useMailToken, useSnippets } from '@/app/shared/support/inbox/use-mail';
import SnippetDrawer from './snippet-drawer';

/** A plain-text preview; the body is HTML but this is a card summary, not a body. */
function preview(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const formatDay = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
};

const matches = (s: Snippet, term: string) => {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return (
    s.title.toLowerCase().includes(q) ||
    s.tags.some((tag) => tag.includes(q)) ||
    preview(s.body).toLowerCase().includes(q)
  );
};

function SnippetCard({
  snippet,
  onEdit,
  onDelete,
}: {
  snippet: Snippet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const updated = formatDay(snippet.updatedAt);
  return (
    <li className="rounded-lg border border-muted bg-gray-0 p-4 transition-colors duration-200 hover:border-gray-300 dark:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Title
            as="h3"
            className="truncate text-sm font-semibold text-gray-900"
          >
            {snippet.title}
          </Title>
          <Text className="mt-1 line-clamp-2 text-sm text-gray-500">
            {preview(snippet.body) || 'Empty snippet'}
          </Text>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ActionIcon
            size="sm"
            variant="outline"
            aria-label={`Edit ${snippet.title}`}
            onClick={onEdit}
          >
            <PiPencilSimpleLineDuotone className="size-4" />
          </ActionIcon>
          <DeletePopover
            title="Delete snippet"
            description={`Delete "${snippet.title}"? This cannot be undone.`}
            onDelete={onDelete}
          />
        </div>
      </div>

      {snippet.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {snippet.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              size="sm"
              className="font-normal"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Text className="mt-3 text-xs text-gray-400">
        {snippet.createdBy?.name ?? 'Unknown author'}
        {updated ? ` · updated ${updated}` : ''}
      </Text>
    </li>
  );
}

/**
 * The snippet library.
 *
 * Every state is distinct on purpose: loading, a load failure with a retry, an
 * empty library, and a search that matched nothing all read differently. An
 * unreachable API rendering as "no snippets yet" would send an operator off to
 * rewrite a reply their team already saved.
 */
export default function SnippetsPage({ className }: { className?: string }) {
  const token = useMailToken();
  const [refresh, setRefresh] = useState(0);
  const [term, setTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const snippets = useSnippets(refresh);
  const list = snippets.data || [];
  const visible = list.filter((s) => matches(s, term));

  const reload = () => setRefresh((n) => n + 1);

  function openNew() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(snippet: Snippet) {
    setEditing(snippet);
    setDrawerOpen(true);
  }

  async function remove(snippet: Snippet) {
    if (!token) return;
    setDeleteError(null);
    try {
      await api.deleteSnippet(token, snippet.id);
      reload();
    } catch (err) {
      // Surfaced as a banner rather than swallowed: the card is still on
      // screen, and the operator must know it is still on the server too.
      setDeleteError((err as Error).message);
    }
  }

  return (
    <div className={cn('@container', className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search snippets"
          aria-label="Search snippets"
          prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-500" />}
          clearable
          onClear={() => setTerm('')}
          className="sm:max-w-xs"
        />
        <Button onClick={openNew} className="w-full shrink-0 sm:w-auto">
          <PiPlusBold className="me-1.5 h-4 w-4" />
          New snippet
        </Button>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
        >
          <Text className="text-sm font-medium text-red-700 dark:text-red-400">
            Not deleted: {deleteError}
          </Text>
        </div>
      )}

      <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
        {snippets.error ? (
          <InboxErrorState message={snippets.error} onRetry={reload} />
        ) : snippets.loading && list.length === 0 ? (
          <ul className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-200/50"
              />
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <InboxEmptyState
            title={term ? 'No snippet matches that search' : 'No snippets yet'}
            description={
              term
                ? 'Try a different word, or clear the search.'
                : 'Save the replies your team writes over and over, then insert them straight into a message.'
            }
            action={
              term ? (
                <Button size="sm" variant="outline" onClick={() => setTerm('')}>
                  Clear search
                </Button>
              ) : (
                <Button size="sm" onClick={openNew}>
                  <PiPlusBold className="me-1.5 h-4 w-4" />
                  New snippet
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid gap-3 p-4 @3xl:grid-cols-2">
            {visible.map((snippet) => (
              <SnippetCard
                key={snippet.id}
                snippet={snippet}
                onEdit={() => openEdit(snippet)}
                onDelete={() => remove(snippet)}
              />
            ))}
          </ul>
        )}
      </div>

      <SnippetDrawer
        open={drawerOpen}
        snippet={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={reload}
      />
    </div>
  );
}
