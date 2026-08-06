import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

/** The chosen mailbox survives reloads; everything else is per-visit. */
export const accountIdAtom = atomWithStorage<string | null>(
  'dh_mail_account',
  null
);
export const folderAtom = atom<string>('INBOX');
export const pageAtom = atom<number>(1);
export const searchAtom = atom<string>('');

/**
 * Triage filter for the message list.
 *
 * 'needsReply' is the \Answered flag, not "unread": a message an operator has
 * read, thought about and left is exactly the one most likely to be dropped.
 * Resolved into IMAP SEARCH criteria server-side — see the note in
 * imap.service.searchQuery on why it cannot be a client-side array filter.
 */
export type MailFilter = 'all' | 'unread' | 'needsReply';
export const filterAtom = atom<MailFilter>('all');
export const selectedUidAtom = atom<number | null>(null);
export const checkedUidsAtom = atom<number[]>([]);

/**
 * The uid the reader has unblocked remote images for — NOT a boolean.
 *
 * Remote images are blocked by default because an <img> pointing at the
 * sender's server is a read receipt that also hands over the reader's IP. A
 * plain boolean would stay true after the reader moved on to a different
 * message, so opening message B would silently fire B's tracking pixels on the
 * strength of a decision made about message A. Storing the uid the consent was
 * given for makes it expire on its own the moment the selection changes.
 */
export const imagesAllowedForUidAtom = atom<number | null>(null);

/**
 * Bumped whenever something changes server-side mail state that the folder rail
 * or the message list is showing.
 *
 * Opening a message flags it \Seen on the server, which makes the list's bold
 * "unread" styling and the rail's unread badge wrong the instant it happens.
 * The reading pane and the list are siblings with no parent holding their data,
 * so this counter is how one tells the other to refetch. The reading pane does
 * NOT depend on it, so bumping cannot feed back into another open.
 */
export const mailRefreshAtom = atom<number>(0);
