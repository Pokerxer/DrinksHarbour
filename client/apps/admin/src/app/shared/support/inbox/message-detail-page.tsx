'use client';

import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import ComposeDrawer, { type ComposeSeed } from './compose-drawer';
import { InboxErrorState } from './inbox-state-views';
import { accountIdAtom, folderAtom, selectedUidAtom } from './mail-state';
import { decodeMessageId } from './message-id';
import MessageView, { type ReplyMode } from './message-view';
import { useMailAccounts } from './use-mail';
import type { MailMessage } from './types';

/** Restores folder + uid from the deep-link id so a shared URL opens the mail. */
export default function MessageDetailView({ id }: { id: string }) {
  const [accountId] = useAtom(accountIdAtom);
  const [, setFolder] = useAtom(folderAtom);
  const [, setUid] = useAtom(selectedUidAtom);
  const accounts = useMailAccounts();

  const [composeOpen, setComposeOpen] = useState(false);
  const [seed, setSeed] = useState<ComposeSeed>({ mode: 'new' });
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const decoded = decodeMessageId(id);
    if (!decoded) {
      // A malformed or truncated link must say so. Leaving the previous
      // selection in place would silently show a different message than the
      // URL asked for.
      setInvalid(true);
      setUid(null);
      return;
    }
    setInvalid(false);
    setFolder(decoded.folder);
    setUid(decoded.uid);
  }, [id, setFolder, setUid]);

  function openCompose(message: MailMessage, mode: ReplyMode | 'draft') {
    setSeed({ mode, message });
    setComposeOpen(true);
  }

  if (invalid) {
    return (
      <div className="mt-4 rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
        <InboxErrorState message="That message link is not valid." />
      </div>
    );
  }

  return (
    <>
      <MessageView className="mt-4" onCompose={openCompose} />
      <ComposeDrawer
        open={composeOpen}
        seed={seed}
        selfAddress={
          accounts.data?.find((a) => a.id === accountId)?.address ?? ''
        }
        onClose={() => setComposeOpen(false)}
        onSent={() => setComposeOpen(false)}
      />
    </>
  );
}
