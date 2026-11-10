'use client';

/** Centered day divider — the shared chat surfaces always group by WAT day
 * (lib/chatFormatting chatDayLabel), this is only the rail presentation. */
export default function ChatDayDivider({ label }: { label: string }) {
  return <div className="flex items-center gap-3 py-1" role="presentation">
    <span aria-hidden="true" className="h-px flex-1 bg-black/10" />
    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 shadow-sm ring-1 ring-black/5">{label}</span>
    <span aria-hidden="true" className="h-px flex-1 bg-black/10" />
  </div>;
}
