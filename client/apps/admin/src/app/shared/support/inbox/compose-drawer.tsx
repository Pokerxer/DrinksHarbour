'use client';

import QuillLoader from '@core/components/loader/quill-loader';
import { useAtom } from 'jotai';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { PiFileTextDuotone, PiPaperclipLight, PiXBold } from 'react-icons/pi';
import { ActionIcon, Button, Drawer, Input, Text, Title } from 'rizzui';
import * as api from './api';
import SnippetPicker from './snippet-picker';
import { accountIdAtom } from './mail-state';
import { useMailToken } from './use-mail';
import { buildSeedDraft } from './draft-seed';
import type { ComposeSeed } from './draft-seed';
import type { ComposeDraft, SendResult } from './types';

// Re-exported so the many existing importers keep working; the seed rules
// themselves live in draft-seed.ts, which is a plain module and therefore
// directly testable.
export { buildSeedDraft } from './draft-seed';
export type { ComposeSeed, ReplyMode } from './draft-seed';

const QuillEditor = dynamic(() => import('@core/ui/quill-editor'), {
  ssr: false,
  loading: () => <QuillLoader className="col-span-full h-[168px]" />,
});

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

interface Props {
  open: boolean;
  seed: ComposeSeed;
  selfAddress: string;
  onClose: () => void;
  onSent: () => void;
}

export default function ComposeDrawer({
  open,
  seed,
  selfAddress,
  onClose,
  onSent,
}: Props) {
  const token = useMailToken();
  const [accountId] = useAtom(accountIdAtom);
  const initial = useMemo(
    () => buildSeedDraft(seed, selfAddress),
    [seed, selfAddress]
  );

  const [draft, setDraft] = useState<ComposeDraft>(initial);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SendResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
      setOutcome(null);
      setDraftError(null);
      setSaved(false);
    }
  }, [open, initial]);

  const totalBytes = draft.files.reduce((sum, f) => sum + f.size, 0);
  const overLimit = totalBytes > MAX_ATTACHMENT_BYTES;

  /**
   * Removes the draft this compose was opened from, once a newer copy exists.
   *
   * Returns a message on failure rather than throwing: by the time this runs
   * the send or re-save has already succeeded, and failing the whole operation
   * for a leftover draft would tell the operator their message did not go. A
   * duplicate in Drafts is untidy; a false "not sent" is a lie. Called only
   * AFTER the new copy is filed — deleting first would risk losing the text
   * outright if the save then failed.
   */
  async function discardSourceDraft(): Promise<string | null> {
    const source = draft.sourceDraft;
    if (!token || !accountId || !source) return null;
    try {
      await api.deleteMessages(token, accountId, source.folder, [source.uid]);
      // The uid is gone; a second attempt would 404 on an unrelated message
      // that has since been assigned it.
      setDraft((d) => ({ ...d, sourceDraft: null }));
      return null;
    } catch (err) {
      return `Saved, but the earlier copy of this draft could not be removed: ${
        (err as Error).message
      }`;
    }
  }

  async function saveDraft() {
    if (!token || !accountId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    setDraftError(null);
    try {
      await api.saveDraft(token, accountId, draft);
      const stale = await discardSourceDraft();
      setSaved(true);
      if (stale) setDraftError(stale);
      // The Drafts folder just changed, so the list and rail counts are stale.
      onSent();
    } catch (err) {
      // The drawer stays open with the text intact — an unsaved draft that
      // looks saved is how an operator loses a message they thought was kept.
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!token || !accountId) return;
    setSending(true);
    setError(null);
    setOutcome(null);
    try {
      const result = await api.sendMessage(token, accountId, draft);

      // A resolved promise is NOT the same as a clean send. SMTP can accept
      // some recipients and refuse others, and the server reports that rather
      // than flattening it; closing the drawer here would be exactly the
      // "green toast for a send that did not fully happen" this project exists
      // to avoid. So a partial send — or a Sent-copy that could not be filed —
      // keeps the drawer open with the outcome on screen, and the operator
      // closes it themselves once they have read it.
      const clean = !result.partial && result.sentCopy.status !== 'failed';
      const staleDraft = await discardSourceDraft();
      onSent();
      if (clean && !staleDraft) {
        onClose();
        return;
      }
      if (staleDraft) setDraftError(staleDraft);
      setOutcome(result);
    } catch (err) {
      // The drawer stays open with the draft intact. A send that failed must
      // never look like one that succeeded, and the text must not be lost.
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const set = (patch: Partial<ComposeDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  /**
   * Appends a snippet to the end of whatever is already written.
   *
   * Appending, not replacing: on a reply the editor already holds the quoted
   * thread, and on a half-written message it holds the operator's own words —
   * either would be destroyed by an overwrite. Quill has no cursor handle to
   * insert at from out here, so "the end" is the honest, predictable choice.
   */
  const insertSnippet = (body: string) =>
    setDraft((d) => ({ ...d, html: d.html ? `${d.html}<br>${body}` : body }));

  const heading =
    seed.mode === 'new'
      ? 'New message'
      : seed.mode === 'draft'
        ? 'Edit draft'
        : seed.mode === 'forward'
          ? 'Forward'
          : 'Reply';

  // A saved draft's attachments live on the server as MIME parts, and there is
  // no API to turn them back into the File objects an upload needs. Rather than
  // let the next save quietly drop them, say so.
  const lostAttachments =
    seed.mode === 'draft'
      ? seed.message.attachments.filter((a) => !a.isInline).length
      : 0;

  return (
    <Drawer isOpen={open} onClose={onClose} size="lg">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-muted p-5">
          <Title as="h3" className="text-lg font-semibold">
            {heading}
          </Title>
          <ActionIcon variant="text" onClick={onClose} aria-label="Close">
            <PiXBold className="h-4 w-4" />
          </ActionIcon>
        </header>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          <Input
            label="To"
            value={draft.to}
            onChange={(e) => set({ to: e.target.value })}
            placeholder="name@example.com, other@example.com"
          />
          <Input
            label="Cc"
            value={draft.cc}
            onChange={(e) => set({ cc: e.target.value })}
          />
          <Input
            label="Bcc"
            value={draft.bcc}
            onChange={(e) => set({ bcc: e.target.value })}
          />
          <Input
            label="Subject"
            value={draft.subject}
            onChange={(e) => set({ subject: e.target.value })}
          />

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <Text className="text-sm font-medium">Message</Text>
              <SnippetPicker onInsert={insertSnippet} />
            </div>
            <QuillEditor
              value={draft.html}
              onChange={(html: string) => set({ html })}
              className="[&>.ql-container_.ql-editor]:min-h-[200px]"
            />
          </div>

          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-muted bg-gray-0 px-3 py-2 text-sm text-gray-600 transition-colors duration-200 hover:bg-gray-100 dark:bg-gray-50">
              <PiPaperclipLight className="h-4 w-4" />
              Attach files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  set({
                    files: [
                      ...draft.files,
                      ...Array.from(e.target.files || []),
                    ],
                  });
                  // Clear the input so re-picking the same file still fires a
                  // change event.
                  e.target.value = '';
                }}
              />
            </label>

            {draft.files.length > 0 && (
              <ul className="mt-2 space-y-2">
                {draft.files.map((file, i) => (
                  <li
                    key={`${file.name}-${file.size}-${i}`}
                    className="flex items-center gap-2.5 rounded-lg border border-muted bg-gray-0 px-3 py-2 text-sm dark:bg-gray-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-200/60">
                      <PiFileTextDuotone className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-700">
                        {file.name}
                      </span>
                      <span className="block text-xs text-gray-400">
                        {formatBytes(file.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      title="Remove"
                      className="rounded-md p-1.5 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-red-600"
                      onClick={() =>
                        set({
                          files: draft.files.filter((_, index) => index !== i),
                        })
                      }
                    >
                      <PiXBold className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {overLimit && (
              <Text className="mt-2 text-sm text-red-700 dark:text-red-400">
                Attachments total {(totalBytes / 1024 / 1024).toFixed(1)} MB —
                the limit is 15 MB.
              </Text>
            )}
          </div>

          {lostAttachments > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <Text className="text-sm text-amber-900 dark:text-amber-300">
                This draft has {lostAttachments} attachment
                {lostAttachments > 1 ? 's' : ''} that cannot be carried over —
                re-attach {lostAttachments > 1 ? 'them' : 'it'} before saving or
                sending, or {lostAttachments > 1 ? 'they' : 'it'} will be lost.
              </Text>
            </div>
          )}

          {saved && !draftError && !error && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
              <Text className="text-sm font-medium text-green-800 dark:text-green-400">
                Draft saved.
              </Text>
            </div>
          )}

          {draftError && (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30"
            >
              <Text className="text-sm text-amber-900 dark:text-amber-300">
                {draftError}
              </Text>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
            >
              <Text className="text-sm font-medium text-red-700 dark:text-red-400">
                Not sent: {error}
              </Text>
            </div>
          )}

          {outcome && (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30"
            >
              {outcome.partial && (
                <Text className="text-sm font-medium text-amber-900 dark:text-amber-300">
                  Sent to {outcome.accepted.join(', ')}, but the mail server
                  refused {outcome.rejected.length} recipient
                  {outcome.rejected.length > 1 ? 's' : ''}:{' '}
                  {outcome.rejected.join(', ')}
                </Text>
              )}
              {outcome.sentCopy.status === 'failed' && (
                <Text className="mt-1 text-sm text-amber-900 dark:text-amber-300">
                  {outcome.sentCopy.error ??
                    'The message was sent but a copy could not be filed in Sent.'}
                </Text>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-muted p-5">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={sending || saving}
          >
            {outcome ? 'Close' : 'Cancel'}
          </Button>
          <Button
            variant="outline"
            onClick={saveDraft}
            isLoading={saving}
            // No recipient is required to save: an unfinished message with
            // nobody addressed yet is exactly what a draft is for.
            disabled={sending || saving || overLimit}
          >
            Save draft
          </Button>
          <Button
            onClick={submit}
            isLoading={sending}
            disabled={sending || saving || overLimit || !draft.to.trim()}
          >
            Send
          </Button>
        </footer>
      </div>
    </Drawer>
  );
}
