'use client';

import { useAtom } from 'jotai';
import { useState } from 'react';
import ComposeDrawer, { type ComposeSeed } from './compose-drawer';
import FolderRail from './folder-rail';
import InboxToolbar from './inbox-toolbar';
import { accountIdAtom, folderAtom, mailRefreshAtom } from './mail-state';
import MessageList from './message-list';
import MessageView, { type ReplyMode } from './message-view';
import { useMailAccounts } from './use-mail';
import type { MailMessage } from './types';

/** Server folder paths vary (INBOX / INBOX.Sent / INBOX/Sent); show the tail. */
function folderLabel(path: string): string {
  const last = path.split(/[./]/).filter(Boolean).pop();
  return last && last.toUpperCase() !== 'INBOX' ? last : 'Inbox';
}

export default function SupportInbox() {
  const [accountId] = useAtom(accountIdAtom);
  const [folder] = useAtom(folderAtom);
  const [, setRefresh] = useAtom(mailRefreshAtom);
  const accounts = useMailAccounts();
  const [composeOpen, setComposeOpen] = useState(false);
  const [seed, setSeed] = useState<ComposeSeed>({ mode: 'new' });
  const [railCollapsed, setRailCollapsed] = useState(false);

  const selfAddress =
    accounts.data?.find((a) => a.id === accountId)?.address ?? '';

  function openCompose(message: MailMessage, mode: ReplyMode | 'draft') {
    setSeed({ mode, message });
    setComposeOpen(true);
  }

  return (
    <div className="@container">
      <InboxToolbar
        title={folderLabel(folder)}
        railCollapsed={railCollapsed}
        onToggleRail={() => setRailCollapsed((collapsed) => !collapsed)}
        onCompose={() => {
          setSeed({ mode: 'new' });
          setComposeOpen(true);
        }}
      />

      <div className="items-stretch gap-6 @4xl:grid @4xl:grid-cols-12">
        <FolderRail collapsed={railCollapsed} className="@4xl:col-span-2" />
        <MessageList className="@4xl:col-span-4" />
        {/* Hidden below @4xl: on mobile the list deep-links to /support/inbox/[id]
            instead of rendering a pane beside itself. */}
        <MessageView
          className="hidden @4xl:col-span-6 @4xl:block"
          onCompose={openCompose}
        />
      </div>

      <ComposeDrawer
        open={composeOpen}
        seed={seed}
        selfAddress={selfAddress}
        onClose={() => setComposeOpen(false)}
        // Bumping the shared counter rather than remounting the list with a
        // key: a remount would throw away the operator's current search term,
        // page and scroll position every time they sent a message.
        onSent={() => setRefresh((n) => n + 1)}
      />
    </div>
  );
}
