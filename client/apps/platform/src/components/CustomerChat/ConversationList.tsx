'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { customerConversation, customerUnreadCountFor, type ChatRow, type ChatPage } from '@/lib/customerConversation';
import { useAuth } from '@/context/AuthContext';
import { chatListTimeLabel } from '@/lib/chatFormatting';
import ConversationRow from '@/components/chat-ui/ConversationRow';
import ChatHeader from '@/components/chat-ui/ChatHeader';

/** WhatsApp-style conversations list on /my-account/chat. Rows are occasion +
 * reference + activity time (first staff reply when present) with the
 * server-supported unread badge — badges derive only from
 * `customerUnreadCount` on GET /mine, absent/legacy counts read as zero. The
 * 15s full re-read, page state and isolation rules are unchanged. */
export default function ConversationList() {
  const { user, token } = useAuth();
  const [data, setData] = useState<ChatPage>(), [page, setPage] = useState(1), [error, setError] = useState('');
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const load = useCallback(async () => { if (!token) return; const current = ++sequence.current; try { const value = await customerConversation.list(page); if (current === sequence.current) { setData(value); setError(''); } } catch (failure) { if (current === sequence.current) setError(failure instanceof Error ? failure.message : 'Your conversations are unavailable.'); } }, [page, token]);
  useEffect(() => { setData(undefined); void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 15000); return () => { clearInterval(timer); invalidate(); }; }, [load, user?._id, invalidate]);
  return <section className="space-y-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-[#7c1d1d]">Your conversations</p>
      <h1 className="mt-2 text-3xl font-bold">Chat with our team</h1>
      <p className="mt-3 text-sm leading-7 text-gray-600">Your occasion requests, messages and replies are saved here. Reopen any conversation to continue with our planning team.</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 inline-flex min-h-11 items-center rounded-lg underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" onClick={() => void load()}>Try again</button></p>}
    {!data && !error ? <div aria-hidden="true" className="space-y-3">{[0, 1, 2].map(row => <div key={row} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <span className="h-11 w-11 shrink-0 rounded-full bg-[#f6e3e3]" />
      <span className="flex-1 space-y-2"><span className="block h-4 w-52 rounded-full bg-[#f7e9db] motion-safe:animate-pulse" /><span className="block h-3 w-40 rounded-full bg-[#f7e9db] motion-safe:animate-pulse" /></span>
    </div>)}</div> : <ul className="drinks-chat-list space-y-2.5">
      {(data?.requests || []).map(row => <ChatListRow key={row._id} row={row} />)}
    </ul>}
    {data && !data.requests.length && <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-bold">No conversations yet.</h2>
      <p className="mt-3 text-sm leading-7 text-gray-600">Send an occasion request and your conversation with our team will appear here.</p>
      <Link href="/occasions" className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#7c1d1d] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Plan your next occasion →</Link>
    </div>}
    {data && data.pages > 1 && <div className="flex items-center gap-4 text-sm">
      <button disabled={page <= 1} className="min-h-11 rounded-lg underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-40" onClick={() => setPage(value => value - 1)}>Previous</button>
      <span>Page {page} of {data.pages}</span>
      <button disabled={page >= data.pages} className="min-h-11 rounded-lg underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:opacity-40" onClick={() => setPage(value => value + 1)}>Next</button>
    </div>}
  </section>;
}

function ChatListRow({ row }: { row: ChatRow }) {
  /** Activity column prefers the first staff reply (the moment the row got
   * interesting), then the general last activity, then the request date. */
  const activity = row.firstStaffReplyAt || row.lastMessageAt || row.createdAt;
  const unread = customerUnreadCountFor(row);
  return <ConversationRow
    href={`/my-account/chat/${row._id}`}
    initial={row.occasion.charAt(0).toUpperCase()}
    title={<>{row.occasion.replaceAll('-', ' ')} drinks <span className="font-medium text-gray-500">· {row.city}</span></>}
    subtitle={<><span className="font-semibold text-gray-600">{row.reference}</span> · {new Date(row.createdAt).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' })}</>}
    timeLabel={chatListTimeLabel(activity)}
    statusLabel={row.status === 'sent' ? 'Team replied' : 'With our team'}
    badgeCount={unread}
    badgeSROnly={`${unread} unread ${unread === 1 ? 'reply' : 'replies'} from our team`}
  />;
}
