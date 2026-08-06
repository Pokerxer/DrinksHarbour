'use client';

import QuillLoader from '@core/components/loader/quill-loader';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { PiXBold } from 'react-icons/pi';
import { ActionIcon, Button, Drawer, Input, Text, Title } from 'rizzui';
import * as api from '@/app/shared/support/inbox/api';
import { useMailToken } from '@/app/shared/support/inbox/use-mail';
import type { Snippet } from '@/app/shared/support/inbox/types';

const QuillEditor = dynamic(() => import('@core/ui/quill-editor'), {
  ssr: false,
  loading: () => <QuillLoader className="col-span-full h-[168px]" />,
});

/** Mirrors the server's own caps so the form fails here rather than at the API. */
const MAX_TITLE_LENGTH = 120;
const MAX_TAGS = 10;

/** Comma-separated in the input, an array on the wire. */
const parseTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_TAGS);

interface Props {
  open: boolean;
  /** null creates; a snippet edits it. */
  snippet: Snippet | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SnippetDrawer({
  open,
  snippet,
  onClose,
  onSaved,
}: Props) {
  const token = useMailToken();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(snippet?.title ?? '');
    setTags((snippet?.tags ?? []).join(', '));
    setBody(snippet?.body ?? '');
    setError(null);
  }, [open, snippet]);

  async function submit() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { title: title.trim(), body, tags: parseTags(tags) };
      if (snippet) {
        await api.updateSnippet(token, snippet.id, payload);
      } else {
        await api.createSnippet(token, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      // The drawer stays open with the text intact. A save that failed must
      // never look like one that worked, and the body must not be lost.
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // The server strips markup it will not store, so a body of only formatting
  // is empty as far as it is concerned. Checking that here keeps the operator
  // from submitting an empty editor and getting a validation error back.
  const hasBody = body
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return (
    <Drawer isOpen={open} onClose={onClose} size="lg">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-muted p-5">
          <Title as="h3" className="text-lg font-semibold">
            {snippet ? 'Edit snippet' : 'New snippet'}
          </Title>
          <ActionIcon variant="text" onClick={onClose} aria-label="Close">
            <PiXBold className="h-4 w-4" />
          </ActionIcon>
        </header>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          <Input
            label="Title"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Refund approved"
          />
          <Input
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="refunds, delivery"
            helperText={`Comma separated, up to ${MAX_TAGS}.`}
          />

          <div>
            <Text className="mb-1.5 text-sm font-medium">Body</Text>
            <QuillEditor
              value={body}
              onChange={setBody}
              className="[&>.ql-container_.ql-editor]:min-h-[240px]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
            >
              <Text className="text-sm font-medium text-red-700 dark:text-red-400">
                Not saved: {error}
              </Text>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-muted p-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            isLoading={saving}
            disabled={saving || !title.trim() || !hasBody}
          >
            {snippet ? 'Save changes' : 'Create snippet'}
          </Button>
        </footer>
      </div>
    </Drawer>
  );
}
