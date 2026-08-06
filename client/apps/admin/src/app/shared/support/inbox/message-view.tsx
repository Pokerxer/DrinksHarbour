'use client';

import { Skeleton } from '@core/ui/skeleton';
import cn from '@core/utils/class-names';
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import {
  PiArrowBendDoubleUpLeftDuotone,
  PiArrowBendUpLeftDuotone,
  PiArrowBendUpRightDuotone,
  PiDownloadSimpleDuotone,
  PiFileImageDuotone,
  PiFilePdfDuotone,
  PiFileTextDuotone,
  PiImageDuotone,
  PiPencilSimpleLineDuotone,
  PiVideoDuotone,
} from 'react-icons/pi';
import { Button, Text, Title } from 'rizzui';
import * as api from './api';
import CustomerContextPanel from './customer-context';
import { InboxEmptyState, InboxErrorState } from './inbox-state-views';
import MailPanel from './mail-panel';
import {
  accountIdAtom,
  folderAtom,
  imagesAllowedForUidAtom,
  mailRefreshAtom,
  selectedUidAtom,
} from './mail-state';
import SenderAvatar from './sender-avatar';
import { useMailFolders, useMailMessage, useMailToken } from './use-mail';
import type { MailMessage } from './types';

// Defined in draft-seed so the pure seed rules can be tested without pulling in
// React; re-exported here because this is where callers have always imported it.
export type { ReplyMode } from './draft-seed';
import type { ReplyMode } from './draft-seed';

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function attachmentIcon(contentType: string) {
  if (contentType.startsWith('image/')) return PiFileImageDuotone;
  if (contentType.includes('pdf')) return PiFilePdfDuotone;
  if (contentType.startsWith('video/')) return PiVideoDuotone;
  return PiFileTextDuotone;
}

/**
 * Renders a message body inside a sandboxed iframe.
 *
 * This is the SECOND of two independent containment layers — the server already
 * ran the HTML through sanitize-html. Neither may be relaxed on the assumption
 * that the other holds, because the whole point is that one of them failing is
 * survivable.
 *
 * The `sandbox` attribute deliberately grants neither `allow-scripts` nor
 * `allow-same-origin`. Without the first, nothing in a hostile body executes.
 * Without the second, the frame gets an opaque origin, so even if a script did
 * somehow run it could not read the admin's cookies, localStorage or session
 * token, nor touch the parent DOM. Granting both together is the well-known
 * combination that makes a sandbox worthless; granting `allow-same-origin`
 * alone would still turn any future sanitizer bypass into a full session
 * compromise rather than a contained one.
 *
 * The consequence, and the reason the height is fixed rather than synced to the
 * content: an opaque-origin frame's `contentDocument` is null from the parent,
 * so measuring `body.scrollHeight` is impossible by construction — code that
 * tries it does not throw, it silently measures nothing and leaves the frame at
 * its initial size. The frame therefore scrolls internally instead. That is the
 * correct trade: a body that needs a scrollbar is a cosmetic cost, and dropping
 * either sandbox token to avoid it is not.
 */
function SandboxedBody({ html }: { html: string }) {
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<style>
  body { margin:0; padding:0; font-family: system-ui, -apple-system, sans-serif;
         font-size:14px; line-height:1.6; color:#111; word-break:break-word; background:#fff; }
  img { max-width:100%; height:auto; }
  img[data-blocked-remote] { display:inline-block; width:1px; height:1px; }
  table { max-width:100%; }
  blockquote { margin:0 0 0 12px; padding-left:12px; border-left:2px solid #ddd; color:#555; }
</style></head><body>${html}</body></html>`;

  return (
    <iframe
      title="Message body"
      srcDoc={srcDoc}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className="h-[60vh] min-h-[320px] w-full rounded border border-muted bg-white"
    />
  );
}

interface Props {
  className?: string;
  onCompose: (message: MailMessage, mode: ReplyMode | 'draft') => void;
}

export default function MessageView({ className, onCompose }: Props) {
  const token = useMailToken();
  const [accountId] = useAtom(accountIdAtom);
  const [folder] = useAtom(folderAtom);
  const [uid] = useAtom(selectedUidAtom);
  const [imagesAllowedForUid, setImagesAllowedForUid] = useAtom(
    imagesAllowedForUidAtom
  );
  const [refresh, setRefresh] = useAtom(mailRefreshAtom);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  // Resolved from the SPECIAL-USE flag, not the path: folder names vary by
  // server (INBOX.Drafts here, "Drafts" elsewhere, localised on some hosts).
  const folders = useMailFolders(accountId, refresh);
  const isDraftFolder = Boolean(
    folders.data?.find((f) => f.path === folder)?.specialUse === '\\Drafts'
  );

  // Consent is per message and derived, never stored as a bare boolean. A
  // boolean reset by an effect would still let the FIRST fetch for the next
  // message go out with images=true — the effect runs after the render that
  // started it — which would fire that sender's tracking pixel on the strength
  // of a decision the reader made about a different message.
  const showImages = uid !== null && imagesAllowedForUid === uid;

  const message = useMailMessage(accountId, folder, uid, showImages);
  const markedSeen = message.data?.markedSeen;

  // Opening a message flags it \Seen server-side, so the list and rail are now
  // showing stale unread state. Only nudge them when the flag actually changed.
  useEffect(() => {
    if (markedSeen) setRefresh((n) => n + 1);
  }, [markedSeen, uid, setRefresh]);

  useEffect(() => {
    setDownloadError(null);
  }, [uid]);

  // A draft is not mail to read, it is a message being written — so opening one
  // hands it to the composer instead of rendering it read-only in this pane.
  //
  // Keyed by uid rather than a bare boolean so closing the drawer does not
  // immediately re-open it (the effect would otherwise re-fire on the next
  // render), while selecting a *different* draft still opens that one.
  const [handedOver, setHandedOver] = useState<number | null>(null);
  const draftMessage = isDraftFolder ? message.data : null;

  useEffect(() => {
    setHandedOver(null);
  }, [uid, folder]);

  useEffect(() => {
    if (!draftMessage || handedOver === draftMessage.uid) return;
    setHandedOver(draftMessage.uid);
    onCompose(draftMessage, 'draft');
  }, [draftMessage, handedOver, onCompose]);

  async function download(index: number, filename: string) {
    if (!token || !accountId || !uid) return;
    setDownloading(index);
    setDownloadError(null);
    try {
      // Not an <a href>: the admin authenticates with a Bearer token and a
      // browser-initiated navigation carries no Authorization header, so a
      // plain link would 401 every time.
      await api.downloadAttachment(
        token,
        accountId,
        folder,
        uid,
        index,
        filename
      );
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  if (!uid) {
    return (
      <MailPanel className={className}>
        <InboxEmptyState
          title="Select a message to read it"
          description="Choose a conversation from the list to see its contents here."
          className="py-24"
        />
      </MailPanel>
    );
  }

  // An error is its own state and must never render as a blank reading pane.
  if (message.error) {
    return (
      <MailPanel className={className}>
        <InboxErrorState
          message={message.error}
          onRetry={message.reload}
          className="py-10"
        />
      </MailPanel>
    );
  }

  if (message.loading || !message.data) {
    return (
      <MailPanel className={className}>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-11/12 rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </div>
        </div>
      </MailPanel>
    );
  }

  const m = message.data;

  if (isDraftFolder) {
    return (
      <MailPanel className={className}>
        <InboxEmptyState
          className="py-20"
          title="This draft is open in the composer"
          description={
            m.subject && m.subject !== '(no subject)'
              ? `"${m.subject}" — finish it in the compose panel, then send or save it.`
              : 'Finish it in the compose panel, then send or save it.'
          }
          action={
            <Button size="sm" onClick={() => onCompose(m, 'draft')}>
              <PiPencilSimpleLineDuotone className="me-1.5 h-4 w-4" />
              Reopen draft
            </Button>
          }
        />
      </MailPanel>
    );
  }

  const attachments = m.attachments.filter((a) => !a.isInline);
  const senderName = m.from.name || m.from.address || 'Unknown sender';

  return (
    <MailPanel className={className}>
      <header className="border-b border-muted p-5">
        <div className="flex items-start gap-3">
          <SenderAvatar
            name={senderName}
            address={m.from.address}
            size="md"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <Title as="h3" className="text-base font-semibold text-gray-900 sm:text-lg">
              {m.subject}
            </Title>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium text-gray-800">{senderName}</span>
              {m.from.name && (
                <span className="truncate text-gray-400">{m.from.address}</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
              <span className="min-w-0 truncate">
                to {m.to.map((t) => t.address).join(', ')}
              </span>
              {m.date && (
                <>
                  <span aria-hidden="true">·</span>
                  <time dateTime={m.date}>
                    {new Date(m.date).toLocaleString()}
                  </time>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-muted pt-4">
          <Button size="sm" variant="outline" onClick={() => onCompose(m, 'reply')}>
            <PiArrowBendUpLeftDuotone className="me-1.5 h-4 w-4" /> Reply
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCompose(m, 'replyAll')}
          >
            <PiArrowBendDoubleUpLeftDuotone className="me-1.5 h-4 w-4" /> Reply
            all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCompose(m, 'forward')}
          >
            <PiArrowBendUpRightDuotone className="me-1.5 h-4 w-4" /> Forward
          </Button>
        </div>
      </header>

      {/* Loading remote images fires the sender's tracking pixel and hands over
          the reader's IP, so it stays an explicit, per-message choice. */}
      {m.blockedRemoteImages > 0 && !showImages && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
          <Text className="text-sm text-amber-900 dark:text-amber-300">
            <PiImageDuotone className="me-1.5 inline h-4 w-4" />
            {m.blockedRemoteImages} remote image
            {m.blockedRemoteImages > 1 ? 's' : ''} blocked to stop the sender
            tracking that you opened this.
          </Text>
          <Button
            size="sm"
            variant="text"
            onClick={() => setImagesAllowedForUid(uid)}
          >
            Show images
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-muted px-5 py-3">
          {attachments.map((a) => {
            const TypeIcon = attachmentIcon(a.contentType);
            return (
              <button
                key={a.index}
                type="button"
                disabled={downloading !== null}
                onClick={() => download(a.index, a.filename)}
                className="flex items-center gap-2.5 rounded-lg border border-muted px-3 py-2 text-sm transition-colors duration-200 hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-200/60">
                  <TypeIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block max-w-[220px] truncate font-medium text-gray-700">
                    {a.filename}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {downloading === a.index ? 'Downloading…' : formatSize(a.size)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {downloadError && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-5 py-2.5 dark:border-red-900 dark:bg-red-950/30"
        >
          <Text className="text-sm text-red-700 dark:text-red-400">
            {downloadError}
          </Text>
        </div>
      )}

      <div className="space-y-4 p-5">
        <SandboxedBody html={m.html} />
        {/* Below the body rather than beside it: this pane is the narrow column
            of the three-pane shell AND the full width of the standalone message
            page, and only a stacked panel reads correctly in both. */}
        <CustomerContextPanel email={m.from.address || null} />
      </div>
    </MailPanel>
  );
}
