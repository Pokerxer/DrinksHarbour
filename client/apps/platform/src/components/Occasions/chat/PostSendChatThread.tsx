'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { LocalChatMessage, OccasionThreadMessage } from './useOccasionThread';
import { chatDayLabel, chatTimeLabel, isAuthChatError } from '@/lib/chatFormatting';
import { chatSignInHref, chatStatusCopy } from '@/lib/chatStatus';

type Props = {
  messages: OccasionThreadMessage[];
  loading: boolean;
  error: string;
  lastCheckedAt: string;
  status: string;
  conversationId: string;
  onReload: () => void;
  onRetry: (message: OccasionThreadMessage) => void;
};

function dayGroups(messages: OccasionThreadMessage[]) {
  const groups: { label: string; items: OccasionThreadMessage[] }[] = [];
  for (const message of messages) {
    const label = chatDayLabel(message.createdAt);
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.items.push(message);
    else groups.push({ label, items: [message] });
  }
  return groups;
}

function localBubble(message: LocalChatMessage, conversationId: string, onRetry: Props['onRetry']) {
  const failed = message.local === 'failed';
  return <article key={message._id} aria-busy={!failed || undefined} className="ml-auto max-w-[92%] rounded-xl bg-rose-50 p-4">
    <p className="text-xs font-bold text-[#7c1d1d]">{failed ? 'You · could not send' : 'You · sending'}</p>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
    {!failed && <p className="mt-2 text-xs leading-5 text-gray-500">Sending…</p>}
    {failed && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-800">
      {message.error}
      <button type="button" onClick={() => onRetry(message)} aria-label="Retry sending your message" className="ml-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Retry</button>
      {isAuthChatError(message.error ?? '') && <Link href={chatSignInHref(conversationId)} className="ml-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Sign in to continue</Link>}
    </p>}
  </article>;
}

function serverBubble(message: OccasionThreadMessage) {
  return <article key={message._id} className={`max-w-[92%] rounded-xl p-4 ${message.sender === 'customer' ? 'ml-auto bg-rose-50' : 'mr-auto bg-emerald-50'}`}>
    <p className="text-xs font-bold text-[#7c1d1d]">{message.sender === 'customer' ? 'You' : 'DrinksHarbour team'}</p>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
    <p className="mt-2 text-xs text-gray-600">{chatTimeLabel(message.createdAt)} WAT</p>
  </article>;
}

/** Conversation log + honest waiting copy driven by the backend status payload
 * (all five states ranked under a staff reply). Pending-while-busy reads as
 * time passing (a "Checked HH:MM" line), never a fake automated message:
 * replies only ever appear when the human team sends them. Failed sends stay
 * inline on their bubble with a per-message retry; auth failures offer a
 * sign-in route back to the thread. Day grouping is always WAT. */
export default function PostSendChatThread({ messages, loading, error, lastCheckedAt, status, conversationId, onReload, onRetry }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof end.current?.scrollIntoView === 'function') end.current.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  const checked = lastCheckedAt ? chatTimeLabel(lastCheckedAt) : '';
  const replied = messages.some(message => message.sender === 'staff');
  const copy = chatStatusCopy(status, replied, 'modal');
  return <div className="flex min-h-0 flex-1 flex-col">
    <div role="status" className="border-b border-gray-100 bg-[#fff8ec] px-4 py-3">
      <p className="text-sm leading-6 text-[#351014]"><strong className="font-semibold">{copy.lead}</strong> {copy.detail}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{checked ? `Checked ${checked}. ` : ''}You don’t have to stay on this page — replies also reach you by email or WhatsApp, as you asked. No AI reads this conversation.</p>
    </div>
    {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">
      {error}
      {isAuthChatError(error) && <Link href={chatSignInHref(conversationId)} className="ml-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Sign in to continue</Link>}
      <button type="button" onClick={onReload} className="ml-2 min-h-11 font-semibold underline">Reload conversation</button>
    </p>}
    {loading ? <p role="status" className="p-4 text-sm text-gray-600">Loading conversation…</p> : (
      <div role="log" aria-label="Conversation with our team" aria-live="polite" className="space-y-4 p-4">
        {dayGroups(messages).map(group => <section key={group.label + String(group.items[0] ? group.items[0]._id : '')}>
          <p className="pb-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">{group.label}</p>
          {group.items.map(message => ('local' in message ? localBubble(message, conversationId, onRetry) : serverBubble(message)))}
        </section>)}
        {!messages.length && <p className="text-sm leading-7 text-gray-600">No replies yet — the team’s messages will appear here when they are sent. Nothing is automated.</p>}
      </div>
    )}
    <div ref={end} />
  </div>;
}
