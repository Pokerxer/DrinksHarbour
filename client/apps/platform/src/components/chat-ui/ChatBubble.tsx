'use client';
import type { ReactNode } from 'react';

/** One WhatsApp-grammar bubble: rounded cards that alternate sides, meta row
 * (time + honest ticks) inside the bubble, never wider than the viewport
 * (max-w-[85%] with break-words keeps 320px safe). Outgoing sits right on a
 * light burgundy tint; incoming sits left on white. Tails are expressed by a
 * sharp bottom corner on the sender side — no pseudo-element paint needed and
 * nothing overflows the layout. */
export default function ChatBubble({ direction, compact, children, meta, 'aria-busy': ariaBusy }: { direction: 'outgoing' | 'incoming'; compact?: boolean; children: ReactNode; meta?: ReactNode; 'aria-busy'?: boolean }) {
  const outgoing = direction === 'outgoing';
  return <article aria-busy={ariaBusy} className={`${outgoing ? 'ml-auto rounded-2xl rounded-br-sm bg-[#f6e3e3]' : 'mr-auto rounded-2xl rounded-bl-sm bg-white ring-1 ring-black/5'} max-w-[85%] shadow-sm ${compact ? 'p-3' : 'p-4'} sm:max-w-[75%]`}>
    {children}
    {meta}
  </article>;
}
