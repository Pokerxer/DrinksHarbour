'use client';

import { Skeleton } from '@core/ui/skeleton';
import cn from '@core/utils/class-names';
import { getRelativeTime } from '@core/utils/get-relative-time';
import rangeMap from '@core/utils/range-map';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  PiChatCenteredDotsDuotone,
  PiEnvelopeSimpleDuotone,
  PiPaperclipLight,
  PiPaperPlaneTiltDuotone,
  PiPlusBold,
  PiTrayDuotone,
  PiWarningOctagonDuotone,
} from 'react-icons/pi';
import { Badge, Button, Empty, Text, Title } from 'rizzui';
import { routes } from '@/config/routes';
import AccountSwitcher from '../inbox/account-switcher';
import ComposeDrawer, { type ComposeSeed } from '../inbox/compose-drawer';
import ManageAccountsDrawer from '../inbox/manage-accounts-drawer';
import { ICONS, order } from '../inbox/folder-rail';
import {
  accountIdAtom,
  checkedUidsAtom,
  filterAtom,
  folderAtom,
  mailRefreshAtom,
  pageAtom,
  selectedUidAtom,
} from '../inbox/mail-state';
import type { MailFilter } from '../inbox/mail-state';
import { encodeMessageId } from '../inbox/message-id';
import SenderAvatar from '../inbox/sender-avatar';
import {
  useMailAccounts,
  useMailFolders,
  useMailMessages,
} from '../inbox/use-mail';
import type { MailFolder } from '../inbox/types';

/** INBOX is the one mailbox name RFC 3501 makes case-insensitive. */
const isInbox = (f: MailFolder) => f.path.toUpperCase() === 'INBOX';

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
  loading,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  tint: string;
  loading: boolean;
  /** Makes the card a button that lands the operator on that set of mail. */
  onClick?: () => void;
}) {
  const body = (
    <>
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
          tint
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 text-left">
        <Text className="truncate text-[13px] text-gray-500">{label}</Text>
        {loading ? (
          <Skeleton className="mt-1.5 h-6 w-12 rounded" />
        ) : (
          <Text className="text-xl font-semibold tabular-nums text-gray-900">
            {/* A folder the server does not have is "—", never a fake zero. */}
            {value === null ? '—' : value}
          </Text>
        )}
      </div>
    </>
  );

  const shell =
    'flex items-center gap-4 rounded-xl border border-muted bg-gray-0 p-5';

  if (!onClick) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shell,
        'w-full cursor-pointer text-left transition-colors duration-200 hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
      )}
    >
      {body}
    </button>
  );
}

function ErrorCard({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        className,
        'rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30'
      )}
    >
      <Text className="text-sm font-medium text-red-700 dark:text-red-400">
        {message}
      </Text>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function SupportOverview() {
  const router = useRouter();
  const [accountId, setAccountId] = useAtom(accountIdAtom);
  const [refresh, setRefresh] = useAtom(mailRefreshAtom);
  const [, setFolder] = useAtom(folderAtom);
  const [, setFilter] = useAtom(filterAtom);
  const [, setPage] = useAtom(pageAtom);
  const [, setSelectedUid] = useAtom(selectedUidAtom);
  const [, setChecked] = useAtom(checkedUidsAtom);
  const [composeOpen, setComposeOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const accounts = useMailAccounts(refresh);
  const folders = useMailFolders(accountId, refresh);
  const recent = useMailMessages(accountId, {
    folder: 'INBOX',
    page: 1,
    search: '',
    refresh,
    limit: 6,
  });
  // Only the count is wanted, so this asks for the smallest page the API
  // allows: `total` is the size of the whole matching set, not of the page.
  const awaiting = useMailMessages(accountId, {
    folder: 'INBOX',
    page: 1,
    search: '',
    refresh,
    limit: 1,
    unanswered: true,
  });

  // Same recovery as the inbox rail: pick the first available mailbox rather
  // than sitting forever on a stored id the server no longer accepts.
  useEffect(() => {
    if (!accounts.data?.length) return;
    const known = accounts.data.some((a) => a.id === accountId);
    if (!known) setAccountId(accounts.data[0].id);
  }, [accountId, accounts.data, setAccountId]);

  const selfAddress =
    accounts.data?.find((a) => a.id === accountId)?.address ?? '';

  const inbox = folders.data?.find(isInbox) ?? null;
  const bySpecialUse = (flag: string) =>
    folders.data?.find((f) => f.specialUse === flag) ?? null;
  const sent = bySpecialUse('\\Sent');
  const junk = bySpecialUse('\\Junk');

  /** Lands the operator in the inbox with `path` already open. */
  function openFolder(path: string, filter: MailFilter = 'all') {
    setFolder(path);
    setFilter(filter);
    setPage(1);
    setSelectedUid(null);
    setChecked([]);
    router.push(routes.support.inbox);
  }

  if (accounts.error) {
    return <ErrorCard message={accounts.error} onRetry={accounts.reload} />;
  }

  if (accounts.data && accounts.data.length === 0) {
    return (
      <div className="rounded-xl border border-muted bg-gray-0 p-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <PiEnvelopeSimpleDuotone className="h-7 w-7 text-gray-400" />
        </span>
        <Title as="h3" className="mt-4 text-base font-semibold">
          No support mailbox configured
        </Title>
        <Text className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          Your account has no mail access set up, so there is nothing to show
          here yet. Add a mailbox, or ask a platform administrator to configure
          one for you.
        </Text>
        <Button className="mt-5" onClick={() => setManageOpen(true)}>
          <PiPlusBold className="me-1.5 h-4 w-4" /> Add mailbox
        </Button>
        <ManageAccountsDrawer
          open={manageOpen}
          onClose={() => setManageOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <AccountSwitcher />
        <div className="flex items-center gap-3">
          <Link href={routes.support.inbox}>
            <Button variant="outline">Open inbox</Button>
          </Link>
          <Button onClick={() => setComposeOpen(true)}>
            <PiPlusBold className="me-1.5 h-4 w-4" /> Compose
          </Button>
        </div>
      </div>

      {folders.error && (
        <ErrorCard
          className="mb-6"
          message={folders.error}
          onRetry={folders.reload}
        />
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-full grid gap-5 @xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5">
          <StatCard
            icon={PiChatCenteredDotsDuotone}
            label="Awaiting reply"
            // A failed count is "—", never 0: a fake zero here reads as "the
            // queue is clear" and is the single most misleading number on this
            // page. `orElse` is not used anywhere — the error just falls to null.
            value={awaiting.error ? null : (awaiting.data?.total ?? null)}
            loading={awaiting.loading}
            tint="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
            onClick={() => openFolder('INBOX', 'needsReply')}
          />
          <StatCard
            icon={PiEnvelopeSimpleDuotone}
            label="Unread"
            value={inbox ? inbox.unseen : null}
            loading={folders.loading}
            tint="bg-primary-lighter text-primary-dark"
            onClick={inbox ? () => openFolder(inbox.path, 'unread') : undefined}
          />
          <StatCard
            icon={PiTrayDuotone}
            label="Inbox"
            value={inbox ? inbox.total : null}
            loading={folders.loading}
            tint="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
            onClick={inbox ? () => openFolder(inbox.path) : undefined}
          />
          <StatCard
            icon={PiPaperPlaneTiltDuotone}
            label="Sent"
            value={sent ? sent.total : null}
            loading={folders.loading}
            tint="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
            onClick={sent ? () => openFolder(sent.path) : undefined}
          />
          <StatCard
            icon={PiWarningOctagonDuotone}
            label="Spam"
            value={junk ? junk.total : null}
            loading={folders.loading}
            tint="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
            onClick={junk ? () => openFolder(junk.path) : undefined}
          />
        </div>

        <div className="col-span-full overflow-hidden rounded-xl border border-muted bg-gray-0 @4xl:col-span-7 @6xl:col-span-8">
          <header className="flex items-center justify-between border-b border-muted px-5 py-4">
            <Title as="h3" className="text-base font-semibold">
              Recent messages
            </Title>
            <Link href={routes.support.inbox}>
              <Button size="sm" variant="text">
                View all
              </Button>
            </Link>
          </header>

          {recent.loading && (
            <div className="divide-y divide-muted">
              {rangeMap(4, (i) => (
                <div key={i} className="flex items-start gap-3 p-5">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="grid flex-1 gap-2">
                    <Skeleton className="h-3 w-40 rounded" />
                    <Skeleton className="h-3 w-3/4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* An error is its own state. An unreachable mail server must never
              render as "no recent messages". */}
          {!recent.loading && recent.error && (
            <div className="p-6 text-center" role="alert">
              <Text className="text-sm font-medium text-red-700 dark:text-red-400">
                {recent.error}
              </Text>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={recent.reload}
              >
                Retry
              </Button>
            </div>
          )}

          {!recent.loading &&
            !recent.error &&
            (recent.data?.items.length ?? 0) === 0 && (
              <Empty className="py-10" text="No messages in the inbox yet" />
            )}

          {!recent.loading && !recent.error && (
            <div className="divide-y divide-muted">
              {(recent.data?.items ?? []).map((m) => (
                <Link
                  key={`${m.folder}:${m.uid}`}
                  href={routes.support.messageDetails(
                    encodeMessageId(m.folder, m.uid)
                  )}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                >
                  <SenderAvatar
                    name={m.from.name}
                    address={m.from.address}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Text
                        className={cn(
                          'truncate text-sm',
                          !m.seen
                            ? 'font-semibold text-gray-900'
                            : 'text-gray-700'
                        )}
                      >
                        {m.from.name || m.from.address || 'Unknown sender'}
                      </Text>
                      <span className="shrink-0 text-xs tabular-nums text-gray-500">
                        {m.date ? getRelativeTime(new Date(m.date)) : ''}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          !m.seen && 'font-semibold'
                        )}
                      >
                        {m.subject}
                      </span>
                      {m.hasAttachments && (
                        <PiPaperclipLight className="h-4 w-4 shrink-0 text-gray-500" />
                      )}
                      {!m.seen && (
                        <Badge
                          renderAsDot
                          className="h-2 w-2 shrink-0 bg-primary"
                        />
                      )}
                    </div>
                    {m.preview && (
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        {m.preview}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-full self-start overflow-hidden rounded-xl border border-muted bg-gray-0 @4xl:col-span-5 @6xl:col-span-4">
          <header className="border-b border-muted px-5 py-4">
            <Title as="h3" className="text-base font-semibold">
              Folders
            </Title>
          </header>

          {folders.loading && (
            <div className="grid gap-3 p-5">
              {rangeMap(5, (i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
            </div>
          )}

          {!folders.loading &&
            (folders.data?.length ?? 0) === 0 &&
            !folders.error && <Empty className="py-10" text="No folders" />}

          {!folders.loading && (
            <nav aria-label="Mail folders" className="p-2">
              {order(folders.data || []).map((f) => {
                const Icon =
                  (f.specialUse && ICONS[f.specialUse]) || PiTrayDuotone;
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => openFolder(f.path)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="flex-1 truncate">{f.name}</span>
                    {f.unseen > 0 && (
                      <span className="text-xs font-semibold tabular-nums text-primary">
                        {f.unseen}
                      </span>
                    )}
                    <span className="w-10 text-end text-xs tabular-nums text-gray-400">
                      {f.total}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      <ComposeDrawer
        open={composeOpen}
        seed={{ mode: 'new' } satisfies ComposeSeed}
        selfAddress={selfAddress}
        onClose={() => setComposeOpen(false)}
        // Sending changes the Sent counts the stat cards are showing.
        onSent={() => setRefresh((n) => n + 1)}
      />
      <ManageAccountsDrawer
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}
