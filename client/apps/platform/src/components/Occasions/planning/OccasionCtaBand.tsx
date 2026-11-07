type Props = { heading?: string; note?: string; anchor?: string };

/**
 * Compact hand-off band between an occasion page's planning tools and the
 * staff request form. Anchors to #occasion-planner (OccasionRequestForm's
 * section id) so every tool ends in an obvious next step instead of a dead
 * end. Static server-safe markup: no client JS, no sends, no promises.
 */
export default function OccasionCtaBand({ heading = 'Built your list?', note, anchor = '#occasion-planner' }: Props) {
  return <aside className="scroll-mt-28 border-y border-[#d5b26b]/60 bg-[#fff8ec] px-5 py-6 sm:px-8" aria-label="Send your plan to our team">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
      <p className="text-sm leading-6 text-[#351014] sm:max-w-2xl">
        <span className="block font-bold text-gray-950">{heading}</span>
        {note ?? 'Send it to our team with your date, city and budget. A human plans it and replies by email or WhatsApp — about 30 minutes aim, no stock reserved and no order placed.'}
      </p>
      <a href={anchor} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#7c1d1d] px-6 py-3 text-sm font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Send to our team<span aria-hidden="true">→</span></a>
    </div>
  </aside>;
}
