'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useOccasionThread } from './useOccasionThread';
import PostSendChatModal from './PostSendChatModal';
import PostSendChatThread from './PostSendChatThread';
import PostSendChatComposer from './PostSendChatComposer';
import { isAuthChatError } from '@/lib/chatFormatting';
import { chatSignInHref, chatStatusCopy } from '@/lib/chatStatus';

const TITLE_ID = 'post-send-chat-title';

type Props = { reference: string; conversationId: string };

/** Planner-side controller for the post-send chat. Opened automatically once a
 * receipt exists in the page session; one poller runs either way so the closed
 * state keeps the full request status block (all five states from DRI-19's
 * status payload, unread badge derived client-side) on the page. The modal is
 * a convenience pane over the existing conversation — /my-account/chat/[id]
 * stays the canonical fallback and the sign-in return target. Reply arrivals
 * flash the document title with an unread badge while the pane is closed
 * (derived from the existing poll — no extra loops, restored exactly once the
 * pane is read again). */
export default function PostSendChat({ reference, conversationId }: Props) {
  const [open, setOpen] = useState(true);
  const [attention, setAttention] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const thread = useOccasionThread(conversationId, open);
  const close = useCallback(() => setOpen(false), []);
  const reOpen = useCallback(() => setOpen(true), []);
  const staffReplied = thread.messages.some(message => message.sender === 'staff');
  const signInHref = chatSignInHref(conversationId);

  useEffect(() => {
    setAttention(!open && thread.unreadCount > 0 ? thread.unreadCount : 0);
  }, [open, thread.unreadCount]);

  // Exact prior title is restored when the attention resolves (pane opened or
  // messages read) and on unmount. Title flashing is a badge swap, not CSS, so
  // prefers-reduced-motion is respected by the static page styling alone.
  const flashTitle = useRef('');
  useEffect(() => {
    if (!attention) return;
    flashTitle.current = document.title;
    let on = false;
    const timer = setInterval(() => {
      on = !on;
      document.title = on ? `(${attention}) ${flashTitle.current}` : flashTitle.current;
    }, 1200);
    return () => { clearInterval(timer); document.title = flashTitle.current; };
  }, [attention]);

  useEffect(() => { if (!open) button.current?.focus(); }, [open]);
  const copy = chatStatusCopy(thread.status, staffReplied, 'closed');
  return <>
    {open ? null : <div role="status" className="mt-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm leading-6 text-gray-700"><strong className="font-semibold">{copy.lead}</strong> {copy.detail}</p>
          {thread.loadError && <p role="alert" className="text-xs leading-6 text-red-700">
            {thread.loadError}
            {isAuthChatError(thread.loadError) && <Link href={signInHref} className="ml-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Sign in to continue</Link>}
            <button type="button" onClick={thread.refresh} className="ml-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Reload</button>
          </p>}
          {attention > 0 && <p className="text-xs font-semibold leading-5 text-[#7c1d1d]">{attention} unread {attention === 1 ? 'reply' : 'replies'} from our team</p>}
          <p className="text-xs leading-5 text-gray-500">Reference {reference}. Replies land in this pane and in your profile chat — you don’t need to stay on this page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button ref={button} type="button" onClick={reOpen} aria-haspopup="dialog" aria-label={thread.unreadCount ? `Continue chat — ${thread.unreadCount} unread reply${thread.unreadCount === 1 ? '' : 's'} from our team` : 'Continue chat'} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#7c1d1d] px-5 py-2 text-sm font-bold text-[#7c1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">
            Continue chat
            {thread.unreadCount > 0 && <span aria-hidden="true" className="rounded-full bg-[#7c1d1d] px-2 py-0.5 text-xs font-bold text-white">{thread.unreadCount}</span>}
          </button>
          <Link href={`/my-account/chat/${conversationId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#7c1d1d] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Open full conversation</Link>
        </div>
      </div>
    </div>}
    {open && <PostSendChatModal titleId={TITLE_ID} reference={reference} conversationId={conversationId} onClose={close}>
      <PostSendChatThread messages={thread.messages} loading={thread.loading} error={thread.loadError} lastCheckedAt={thread.lastCheckedAt} status={thread.status} lastStaffReadAt={thread.lastStaffReadAt} conversationId={conversationId} onReload={thread.refresh} onRetry={thread.retryMessage} />
      <PostSendChatComposer onSend={thread.send} sending={thread.sending} />
    </PostSendChatModal>}
  </>;
}
