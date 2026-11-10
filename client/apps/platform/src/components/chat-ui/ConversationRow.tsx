'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** One WhatsApp-style conversations row on a mobile chat list: lead avatar
 * with the occasion initial, title + reference/date column, and a trailing
 * column with the activity time, muted status and the server-supported unread
 * badge. The badge only ever counts server truth (`customerUnreadCount`);
 * absent/legacy counts never render. */
export default function ConversationRow({ href, initial, title, subtitle, timeLabel, statusLabel, badgeCount, badgeSROnly, ariaLabel }: { href: string; initial: string; title: ReactNode; subtitle: ReactNode; timeLabel: ReactNode; statusLabel?: string; badgeCount: number; badgeSROnly: string; ariaLabel?: string }) {
  const reacted = badgeCount > 0;
  return <li>
    <Link href={href} aria-label={ariaLabel} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-[#fdf8f6] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6e3e3] text-base font-bold text-[#7c1d1d]">{initial}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-gray-950">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-gray-500">{subtitle}</span>
        {statusLabel && <span className="mt-1 block text-xs font-semibold text-[#7c1d1d]">{statusLabel}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] text-gray-500">{timeLabel}</span>
        {reacted ? <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="rounded-full bg-[#7c1d1d] px-2 py-0.5 text-xs font-bold text-white">{badgeCount}</span>
          <span className="sr-only">{badgeSROnly}</span>
        </span> : null}
      </span>
    </Link>
  </li>;
}
