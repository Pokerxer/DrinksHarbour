import Link from 'next/link';

type Props = {
  occasionPath: string;
  occasionLabel: string;
  subpages: { slug: string; title: string }[];
  activeSlug?: string;
  /** In-page planning anchor. Weddings passes `#wedding-list`; the Commercial
   * Guide occasions default to the mounted OccasionChatPlanner (#occasion-chat). */
  planHref?: string;
};

/** Subpage tabs under an occasion page. Renders nothing when there are none. */
export default function SubpageNav({ occasionPath, occasionLabel, subpages, activeSlug, planHref }: Props) {
  if (!subpages.length) return null;
  const planTarget = planHref ?? `${occasionPath}#occasion-chat`;
  return <nav aria-label={`${occasionLabel} subpages`} className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3">
    <Link href={planTarget} className="inline-flex min-h-10 items-center rounded-full bg-[#7c1d1d] px-4 py-2 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d5b26b]">Plan this occasion</Link>
    {subpages.map(sub => {
      const active = sub.slug === activeSlug;
      return <Link key={sub.slug} aria-current={active ? 'page' : undefined} href={`${occasionPath}/${sub.slug}`}
        className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] ${active ? 'border-[#7c1d1d] bg-[#fff8ec] text-[#7c1d1d]' : 'border-gray-200 text-[#7c1d1d] hover:border-[#7c1d1d]'}`}>{sub.title}</Link>;
    })}
  </nav>;
}
