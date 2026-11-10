'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Sticky caller-style chat header: brand-accented bar with the conversation
 * identity, back affordance and an optional status meta slot. Static paint
 * (no parallax, no motion), so prefers-reduced-motion is respected by
 * construction. */
export default function ChatHeader({ back, icon, title, subtitle, meta }: { back?: { href: string; label: string }; icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode }) {
  return <header className="sticky top-0 z-20 border-b border-[#7c1d1d]/15 bg-white/95 shadow-sm">
    <div className="flex items-center gap-3 px-4 py-3">
      {back && <Link href={back.href} aria-label={back.label} className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-[#7c1d1d] hover:bg-[#f6e3e3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">←</Link>}
      {icon && <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6e3e3] text-sm font-bold uppercase text-[#7c1d1d]">{icon}</span>}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-bold leading-6 text-gray-950">{title}</h2>
        {subtitle && <p className="truncate text-xs leading-5 text-gray-500">{subtitle}</p>}
      </div>
      {meta}
    </div>
  </header>;
}
