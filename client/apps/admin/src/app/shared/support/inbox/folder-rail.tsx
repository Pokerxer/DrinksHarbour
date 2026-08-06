'use client';

import cn from '@core/utils/class-names';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import {
  PiArchiveDuotone,
  PiFileDashedDuotone,
  PiPaperPlaneTiltDuotone,
  PiTrayDuotone,
  PiTrashDuotone,
  PiWarningOctagonDuotone,
} from 'react-icons/pi';
import { Badge, Button, Text } from 'rizzui';
import { InboxErrorState } from './inbox-state-views';
import MailPanel from './mail-panel';
import {
  accountIdAtom,
  checkedUidsAtom,
  folderAtom,
  mailRefreshAtom,
  pageAtom,
  selectedUidAtom,
} from './mail-state';
import { useMailAccounts, useMailFolders } from './use-mail';
import type { MailFolder } from './types';

// Exported: the /support overview renders the same folder list.
export const ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  '\\Sent': PiPaperPlaneTiltDuotone,
  '\\Drafts': PiFileDashedDuotone,
  '\\Archive': PiArchiveDuotone,
  '\\Junk': PiWarningOctagonDuotone,
  '\\Trash': PiTrashDuotone,
};

/** Inbox first, then the special-use folders, then everything else. */
export function order(folders: MailFolder[]): MailFolder[] {
  const ranking = ['\\Sent', '\\Drafts', '\\Archive', '\\Junk', '\\Trash'];
  const rank = (f: MailFolder) => {
    // INBOX is the one mailbox name RFC 3501 makes case-insensitive.
    if (f.path.toUpperCase() === 'INBOX') return 0;
    const index = f.specialUse ? ranking.indexOf(f.specialUse) : -1;
    return index === -1 ? 90 : 10 + index;
  };
  return [...folders].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)
  );
}

interface FolderRailProps {
  className?: string;
  /** Desktop only: collapse the rail to an icon strip (email-client pattern). */
  collapsed?: boolean;
}

export default function FolderRail({
  className,
  collapsed = false,
}: FolderRailProps) {
  const [accountId, setAccountId] = useAtom(accountIdAtom);
  const [folder, setFolder] = useAtom(folderAtom);
  const [, setPage] = useAtom(pageAtom);
  const [, setSelectedUid] = useAtom(selectedUidAtom);
  const [, setChecked] = useAtom(checkedUidsAtom);
  const [refresh] = useAtom(mailRefreshAtom);

  const accounts = useMailAccounts();
  const folders = useMailFolders(accountId, refresh);

  // Pick the first available mailbox rather than showing an empty rail. Also
  // recovers when a stored account id no longer exists (the env changed, or the
  // caller's permissions did) — otherwise the rail would stay blank forever
  // against an id the server will never accept.
  useEffect(() => {
    if (!accounts.data?.length) return;
    const known = accounts.data.some((a) => a.id === accountId);
    if (!known) setAccountId(accounts.data[0].id);
  }, [accountId, accounts.data, setAccountId]);

  function openFolder(path: string) {
    setFolder(path);
    setPage(1);
    setSelectedUid(null);
    setChecked([]);
  }

  const orderedFolders = order(folders.data || []);

  // An error is its own state and must never render as "no folders".
  if (accounts.error) {
    return (
      <div className={cn(className)}>
        <MailPanel className="h-full">
          <InboxErrorState message={accounts.error} onRetry={accounts.reload} />
        </MailPanel>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: the rail becomes a horizontally scrollable chip strip so the
          panes below keep full width and the list still deep-links. */}
      <div className="-mx-1 mb-4 flex items-center gap-2 overflow-x-auto px-1 pb-1 @4xl:hidden">
        {orderedFolders.map((f) => {
          const Icon = (f.specialUse && ICONS[f.specialUse]) || PiTrayDuotone;
          const active = f.path === folder;
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => openFolder(f.path)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-200',
                active
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-muted bg-gray-0 text-gray-600 hover:bg-gray-100'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.name}
              {f.unseen > 0 && (
                <Badge
                  size="sm"
                  rounded="pill"
                  className={
                    active
                      ? 'bg-white/25 text-primary-foreground'
                      : 'bg-primary text-primary-foreground'
                  }
                >
                  {f.unseen}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop: a proper panel, optionally collapsed to an icon strip. */}
      <div className={cn('hidden @4xl:block', className)}>
        {collapsed ? (
          <MailPanel title="Folders" className="h-full">
            <nav className="flex flex-col items-center gap-1 p-2">
              {orderedFolders.map((f) => {
                const Icon =
                  (f.specialUse && ICONS[f.specialUse]) || PiTrayDuotone;
                const active = f.path === folder;
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => openFolder(f.path)}
                    aria-current={active ? 'page' : undefined}
                    title={f.name}
                    aria-label={f.name}
                    className={cn(
                      'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200',
                      active
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {f.unseen > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {f.unseen > 99 ? '99+' : f.unseen}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </MailPanel>
        ) : (
          <MailPanel title="Folders" className="h-full">
            <div className="flex flex-col gap-3 p-3">
              {folders.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <Text className="text-sm text-red-700 dark:text-red-400">
                    {folders.error}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={folders.reload}
                  >
                    Retry
                  </Button>
                </div>
              )}

              <nav className="flex flex-col gap-0.5">
                {orderedFolders.map((f) => {
                  const Icon =
                    (f.specialUse && ICONS[f.specialUse]) || PiTrayDuotone;
                  const active = f.path === folder;
                  return (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => openFolder(f.path)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors duration-200',
                        active
                          ? 'bg-primary-lighter/70 font-semibold text-primary-dark'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-primary"
                        />
                      )}
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-primary-dark' : 'text-gray-400'
                        )}
                      />
                      <span className="flex-1 truncate">{f.name}</span>
                      {f.unseen > 0 && (
                        <Badge
                          size="sm"
                          rounded="pill"
                          className="bg-primary text-primary-foreground"
                        >
                          {f.unseen}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </MailPanel>
        )}
      </div>
    </>
  );
}
