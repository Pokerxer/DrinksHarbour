'use client';

import { useSession } from 'next-auth/react';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import * as api from '@/app/shared/support/inbox/api';
import { accountIdAtom } from '@/app/shared/support/inbox/mail-state';

/** How often the sidebar re-counts. Slow on purpose — see the note below. */
const POLL_MS = 2 * 60 * 1000;

/** Past this the badge reads "99+"; the exact number stops mattering. */
const MAX_SHOWN = 99;

/** INBOX is the one mailbox name RFC 3501 makes case-insensitive. */
const isInbox = (path: string) => path.toUpperCase() === 'INBOX';

/**
 * Unread count for the Support > Inbox sidebar entry.
 *
 * Deliberately silent on failure. This renders on every page of the admin, so
 * a mail server that is down, a user without mail access (the API is
 * admin/super_admin only), or a mailbox that has not been configured must
 * produce *nothing at all* — not an error, not a zero. Everywhere else in this
 * module an error is shown loudly because the operator is looking at mail and
 * needs to know it is stale; here they are looking at an unrelated page, and
 * the only honest thing a broken count can do is not appear.
 *
 * The interval is two minutes rather than seconds because each tick is a real
 * IMAP STATUS across every folder of the mailbox. The inbox itself refreshes
 * its own counts on every action, so this only has to catch mail that arrives
 * while the operator is elsewhere in the admin.
 */
export default function MailUnreadBadge() {
  const { data: session } = useSession();
  const token =
    (session?.user as { token?: string } | undefined)?.token ?? null;
  const accountId = useAtomValue(accountIdAtom);
  const [unseen, setUnseen] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function count() {
      try {
        // The stored account may be one the server no longer offers, so the
        // list is the source of truth for which mailbox to count.
        const accounts = await api.fetchAccounts(token as string);
        const active =
          accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;
        if (!active) {
          if (!cancelled) setUnseen(null);
          return;
        }
        const folders = await api.fetchFolders(token as string, active.id);
        const inbox = folders.find((f) => isInbox(f.path));
        if (!cancelled) setUnseen(inbox ? inbox.unseen : null);
      } catch {
        // Fail silent: no badge rather than a wrong one. See the note above.
        if (!cancelled) setUnseen(null);
      }
    }

    count();
    const timer = setInterval(count, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, accountId]);

  if (!unseen) return null;

  return (
    <span
      aria-label={`${unseen} unread ${unseen === 1 ? 'message' : 'messages'}`}
      className="ms-2 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-white"
    >
      {unseen > MAX_SHOWN ? `${MAX_SHOWN}+` : unseen}
    </span>
  );
}
