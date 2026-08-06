'use client';

import { useMedia } from '@core/hooks/use-media';
import { Skeleton } from '@core/ui/skeleton';
import cn from '@core/utils/class-names';
import { getRelativeTime } from '@core/utils/get-relative-time';
import rangeMap from '@core/utils/range-map';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PiArchiveDuotone,
  PiArrowClockwise,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiMagnifyingGlass,
  PiPaperclipLight,
  PiTrashDuotone,
} from 'react-icons/pi';
import { ActionIcon, Button, Checkbox, Input, Text } from 'rizzui';
import { routes } from '@/config/routes';
import * as api from './api';
import { InboxEmptyState, InboxErrorState } from './inbox-state-views';
import MailPanel from './mail-panel';
import {
  accountIdAtom,
  checkedUidsAtom,
  filterAtom,
  folderAtom,
  mailRefreshAtom,
  pageAtom,
  searchAtom,
  selectedUidAtom,
} from './mail-state';
import type { MailFilter } from './mail-state';
import { encodeMessageId } from './message-id';
import SenderAvatar from './sender-avatar';
import { useMailFolders, useMailMessages, useMailToken } from './use-mail';
import type { MailEnvelope } from './types';

// Re-exported so callers can keep importing them from here; the implementation
// lives in message-id.ts because the [id] route decodes on the server too.
export { encodeMessageId, decodeMessageId } from './message-id';

/** "Today" / "Yesterday" / "Earlier" / "Older" grouping for the list. */
function dateBucket(iso: string | null): string {
  if (!iso) return 'Earlier';
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const day = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) return 'Earlier';
  return 'Older';
}

function MessageItem({
  message,
  onOpen,
}: {
  message: MailEnvelope;
  onOpen: (message: MailEnvelope) => void;
}) {
  const [selectedUid] = useAtom(selectedUidAtom);
  const [checked, setChecked] = useAtom(checkedUidsAtom);

  const isActive = selectedUid === message.uid;
  const isChecked = checked.includes(message.uid);
  const senderName =
    message.from.name || message.from.address || 'Unknown sender';

  function toggleCheck() {
    setChecked(
      isChecked
        ? checked.filter((uid) => uid !== message.uid)
        : [...checked, message.uid]
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 border-t border-muted px-4 py-3 transition-colors duration-200',
        !message.seen && 'bg-primary-lighter/15',
        isActive && 'bg-primary-lighter/40',
        !isActive && 'hover:bg-gray-50'
      )}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] bg-primary"
        />
      )}

      <Checkbox
        checked={isChecked}
        onChange={toggleCheck}
        aria-label={`Select message from ${
          message.from.address || 'unknown sender'
        }`}
        className="mt-0.5"
      />

      <SenderAvatar
        name={senderName}
        address={message.from.address}
        size="sm"
        className="mt-0.5"
      />

      {/* A real button rather than a div with onClick: this list is the primary
          navigation of the whole page and has to be reachable by keyboard and
          announced as actionable. */}
      <button
        type="button"
        onClick={() => onOpen(message)}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              message.seen
                ? 'font-medium text-gray-700'
                : 'font-semibold text-gray-900'
            )}
          >
            {senderName}
          </span>
          <span className="shrink-0 text-xs text-gray-400">
            {message.date ? getRelativeTime(new Date(message.date)) : ''}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-sm',
              message.seen ? 'text-gray-700' : 'font-semibold text-gray-900'
            )}
          >
            {message.subject}
          </span>
          {message.hasAttachments && (
            <PiPaperclipLight className="h-4 w-4 shrink-0 text-gray-400" />
          )}
        </div>

        {message.preview && (
          <p className="mt-1 line-clamp-1 text-sm text-gray-500">
            {message.preview}
          </p>
        )}
      </button>

      {!message.seen && (
        <span
          aria-hidden="true"
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
        />
      )}
    </div>
  );
}

/** Server folder paths vary (INBOX / INBOX.Sent / INBOX/Sent); show the tail. */
function folderLabel(path: string): string {
  const last = path.split(/[./]/).filter(Boolean).pop();
  return last && last.toUpperCase() !== 'INBOX' ? last : 'Inbox';
}

const FILTER_TABS: Array<{ value: MailFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'needsReply', label: 'Needs reply' },
];

/**
 * The triage tabs.
 *
 * "Needs reply" is only offered where \Answered means something. In Sent or
 * Drafts every message is unanswered by definition, so the tab would return the
 * whole folder under a heading that implies a backlog.
 */
function FilterTabs({
  value,
  onChange,
  disabled,
}: {
  value: MailFilter;
  onChange: (next: MailFilter) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter messages"
      className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-200/50"
    >
      {FILTER_TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(tab.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'bg-gray-0 text-gray-900 shadow-sm dark:bg-gray-50'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** \Answered is only meaningful in a folder that receives mail. */
const isReceivingFolder = (
  path: string,
  folders: { path: string; specialUse: string | null }[]
) => {
  const known = folders.find((f) => f.path === path);
  if (!known) return path.toUpperCase() === 'INBOX';
  return !['\\Sent', '\\Drafts', '\\Junk', '\\Trash'].includes(
    known.specialUse ?? ''
  );
};

export default function MessageList({ className }: { className?: string }) {
  const router = useRouter();
  const isMobile = useMedia('(max-width: 1023px)', false);
  const token = useMailToken();
  const [accountId] = useAtom(accountIdAtom);
  const [folder] = useAtom(folderAtom);
  const [page, setPage] = useAtom(pageAtom);
  const [search, setSearch] = useAtom(searchAtom);
  const [filter, setFilter] = useAtom(filterAtom);
  const [, setSelectedUid] = useAtom(selectedUidAtom);
  const [checked, setChecked] = useAtom(checkedUidsAtom);
  const [refresh, setRefresh] = useAtom(mailRefreshAtom);
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const folders = useMailFolders(accountId, refresh);
  // Switching to Sent with "Needs reply" active would show the whole folder
  // under a heading that implies a backlog, so the filter is dropped rather
  // than carried across — and dropped in the request, not just the tab strip,
  // so what is fetched always matches what the tabs say.
  const answeredApplies = isReceivingFolder(folder, folders.data ?? []);
  const effective: MailFilter =
    filter === 'needsReply' && !answeredApplies ? 'all' : filter;

  const messages = useMailMessages(accountId, {
    folder,
    page,
    search,
    refresh,
    unread: effective === 'unread',
    unanswered: effective === 'needsReply',
  });
  // Folder names vary by server (INBOX.Archive here, "Archive" elsewhere), so
  // the archive target is always resolved from its SPECIAL-USE flag.
  const archivePath =
    folders.data?.find((f) => f.specialUse === '\\Archive')?.path ?? null;

  const items = messages.data?.items ?? [];
  const total = messages.data?.total ?? 0;
  const limit = messages.data?.limit ?? 25;
  const pages = Math.max(1, Math.ceil(total / limit));

  const allChecked = items.length > 0 && checked.length === items.length;

  function openMessage(message: MailEnvelope) {
    setSelectedUid(message.uid);
    // On mobile there is no reading pane beside the list, so the message gets
    // its own route.
    if (isMobile) {
      router.push(
        routes.support.messageDetails(
          encodeMessageId(message.folder, message.uid)
        )
      );
    }
  }

  function toggleSelectAll() {
    setChecked(allChecked ? [] : items.map((m) => m.uid));
  }

  async function runBulk(action: 'archive' | 'delete') {
    if (!token || !accountId || !checked.length) return;
    setBusy(true);
    setActionError(null);
    try {
      if (action === 'delete') {
        await api.deleteMessages(token, accountId, folder, checked);
      } else {
        if (!archivePath) throw new Error('This mailbox has no Archive folder');
        await api.moveMessages(token, accountId, {
          folder,
          uids: checked,
          to: archivePath,
        });
      }
      setChecked([]);
      setSelectedUid(null);
      // Bumping the shared counter rather than calling reload() on the two
      // hooks here: the folder rail holds its OWN useMailFolders instance, and
      // a local reload would leave its unread badges showing counts that the
      // move or delete just invalidated.
      setRefresh((n) => n + 1);
    } catch (err) {
      // Surfaced in the UI rather than swallowed: a bulk action that failed but
      // looks like it worked is the worst outcome available here. Deliberately
      // not window.alert — that blocks the tab and cannot be styled or tested.
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const groups = items.reduce<Array<[string, MailEnvelope[]]>>(
    (acc, message) => {
      const bucket = dateBucket(message.date);
      const last = acc[acc.length - 1];
      if (last && last[0] === bucket) last[1].push(message);
      else acc.push([bucket, [message]]);
      return acc;
    },
    []
  );

  return (
    <MailPanel
      className={className}
      headerClassName="flex-col items-stretch gap-2 @lg:flex-row @lg:items-center @lg:justify-between"
      title={
        <span className="flex items-center gap-2">
          {folderLabel(folder)}
          {!messages.loading && total > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-200/60">
              {total}
            </span>
          )}
        </span>
      }
      action={
        <div className="flex w-full flex-col gap-2 @lg:w-auto @lg:flex-row @lg:items-center">
          <FilterTabs
            value={effective}
            disabled={messages.loading}
            onChange={(next) => {
              setFilter(next);
              // Page 3 of "All" is rarely page 3 of a filtered set.
              setPage(1);
              setChecked([]);
            }}
          />
          <form
            className="w-full @lg:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(term.trim());
              setPage(1);
            }}
          >
            <Input
              type="search"
              placeholder="Search this folder"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              prefix={<PiMagnifyingGlass className="h-4 w-4" />}
              clearable
              onClear={() => {
                setTerm('');
                setSearch('');
                setPage(1);
              }}
              className="w-full @lg:w-56"
            />
          </form>
        </div>
      }
    >
      {/* Bulk / select-all strip */}
      <div className="flex items-center justify-between gap-2 border-b border-muted px-3 py-2">
        {checked.length > 0 ? (
          <div className="flex items-center gap-1">
            <Text className="me-1 text-sm font-medium text-gray-700">
              {checked.length} selected
            </Text>
            <ActionIcon
              size="sm"
              variant="text"
              onClick={() => runBulk('archive')}
              disabled={busy || !archivePath}
              title={
                archivePath ? 'Archive' : 'This mailbox has no Archive folder'
              }
              aria-label="Archive selected"
            >
              <PiArchiveDuotone className="h-4 w-4" />
            </ActionIcon>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-muted" />
            <ActionIcon
              size="sm"
              variant="text"
              onClick={() => runBulk('delete')}
              disabled={busy}
              title="Delete"
              aria-label="Delete selected"
            >
              <PiTrashDuotone className="h-4 w-4" />
            </ActionIcon>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allChecked}
              onChange={toggleSelectAll}
              disabled={items.length === 0}
              aria-label="Select all messages on this page"
            />
            <Text className="text-xs text-gray-400">
              {items.length > 0 ? 'Select all' : 'Select messages to bulk act'}
            </Text>
          </div>
        )}

        <ActionIcon
          size="sm"
          variant="text"
          onClick={messages.reload}
          aria-label="Refresh"
          title="Refresh"
          disabled={messages.loading}
        >
          <PiArrowClockwise className="h-4 w-4" />
        </ActionIcon>
      </div>

      {actionError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900 dark:bg-red-950/30">
          <Text className="text-sm text-red-700 dark:text-red-400" role="alert">
            {actionError}
          </Text>
        </div>
      )}

      <div className="custom-scrollbar max-h-[calc(100dvh-400px)] overflow-y-auto scroll-smooth">
        {messages.loading && (
          <div className="grid gap-4">
            {rangeMap(4, (i) => (
              <MessageLoader key={i} />
            ))}
          </div>
        )}

        {/* An error is its own state. It must never look like an empty
            folder — an unreachable mail server rendering as "no messages" is
            precisely the failure mode this feature exists to avoid. */}
        {!messages.loading && messages.error && (
          <InboxErrorState
            message={messages.error}
            onRetry={messages.reload}
            className="py-10"
          />
        )}

        {!messages.loading && !messages.error && items.length === 0 && (
          <InboxEmptyState
            className="py-14"
            title={
              search
                ? 'No matches'
                : effective === 'needsReply'
                  ? 'Nothing awaiting a reply'
                  : effective === 'unread'
                    ? 'Nothing unread'
                    : 'This folder is empty'
            }
            description={
              search
                ? 'Try a different search term or clear the search.'
                : effective === 'all'
                  ? 'New messages that arrive here will show up in this list.'
                  : 'Switch to All to see the rest of this folder.'
            }
            action={
              effective !== 'all' && !search ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilter('all');
                    setPage(1);
                  }}
                >
                  Show all
                </Button>
              ) : undefined
            }
          />
        )}

        {!messages.loading &&
          !messages.error &&
          groups.map(([bucket, group]) => (
            <section key={bucket}>
              <div className="sticky top-0 z-10 border-b border-muted bg-gray-0/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 backdrop-blur dark:bg-gray-50/95">
                {bucket}
              </div>
              {group.map((message) => (
                <MessageItem
                  key={`${message.folder}:${message.uid}`}
                  message={message}
                  onOpen={openMessage}
                />
              ))}
            </section>
          ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-muted px-3 py-2.5">
          <ActionIcon
            size="sm"
            variant="text"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
            title="Previous page"
          >
            <PiCaretLeftBold className="h-4 w-4" />
          </ActionIcon>
          <Text className="text-xs text-gray-500">
            Page {page} of {pages}
          </Text>
          <ActionIcon
            size="sm"
            variant="text"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
            title="Next page"
          >
            <PiCaretRightBold className="h-4 w-4" />
          </ActionIcon>
        </div>
      )}
    </MailPanel>
  );
}

/** Skeleton that mirrors the redesigned row layout (avatar + lines). */
export function MessageLoader() {
  return (
    <div className="flex items-start gap-3 border-t border-muted p-4">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
        <Skeleton className="mt-2 h-3 w-48 rounded" />
        <Skeleton className="mt-2 h-3 w-full rounded" />
      </div>
    </div>
  );
}
