'use client';
import type { ReactNode } from 'react';
import { chatDayLabel, chatTimeLabel } from '@/lib/chat-formatting';

/** Shared WhatsApp-grammar presentation for the staff conversation panel —
 * the same reading experience the customer has (light burgundy outgoing for
 * the DrinksHarbour team, white incoming for the customer), with authored
 * text rendered as escaped plain text and WAT times inside the meta row. */
export function StaffBubble({ direction, message, meta }: { direction: 'incoming' | 'outgoing'; message: { content: string }; meta?: ReactNode }) {
  const outgoing = direction === 'outgoing';
  return <article className={`max-w-[85%] rounded-2xl p-4 shadow-sm sm:max-w-[75%] ${outgoing ? 'ml-auto rounded-br-sm bg-[#f6e3e3]' : 'mr-auto rounded-bl-sm bg-white ring-1 ring-black/5 dark:ring-gray-700'}`}>
    {outgoing && <p className="text-xs font-bold text-[#7c1d1d]">DrinksHarbour team</p>}
    {outgoing && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-[#351014]">{message.content}</p>}
    {!outgoing && <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-950">{message.content}</p>}
    {meta}
  </article>;
}

export function BubbleMeta({ createdAt, ticks }: { createdAt: string; ticks?: ReactNode }) {
  return <div className="mt-1 flex items-center justify-end gap-1.5">
    <span className="text-[11px] leading-5 text-gray-500">{chatTimeLabel(createdAt)} WAT</span>
    {ticks}
  </div>;
}

export function DayDivider({ label }: { label: string }) {
  return <div className="flex items-center gap-3 py-1" role="presentation">
    <span aria-hidden="true" className="h-px flex-1 bg-black/10 dark:bg-gray-700" />
    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:ring-gray-700">{label}</span>
    <span aria-hidden="true" className="h-px flex-1 bg-black/10 dark:bg-gray-700" />
  </div>;
}

/** Honest single tick for staff-side published replies: it means the reply is
 * saved in the customer's chat — nothing more is claimed (no customer-read
 * state exists on this surface). */
export function PublishedTick() {
  return <span className="inline-flex items-center gap-1 text-[#7c1d1d]" title="Saved in the customer's chat">
    <span className="sr-only">Saved in the customer’s saved chat.</span>
    <svg aria-hidden="true" viewBox="0 0 16 12" className="h-3 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5 5.2 9.8 12 2.6" /></svg>
  </span>;
}

export function ChatWallpaper({ children }: { children: ReactNode }) {
  return <div className="rounded-b-xl" style={{ backgroundColor: '#f8f1ee', backgroundImage: 'repeating-linear-gradient(45deg, rgba(124,29,29,0.035) 0px, rgba(124,29,29,0.035) 1px, transparent 1px, transparent 10px)' }}>{children}</div>;
}
