'use client';

import { PiCheckCircleFill, PiCircleDashed } from 'react-icons/pi';
import type { SectionProgress } from './review-form-utils';

/**
 * The desktop-only rail beside the form.
 *
 * A 14-question, 4-section review is several screens tall, and the progress
 * card at the top scrolls away with everything else — so once the reviewer is
 * past the first section they have no idea how much is left, and no way to get
 * back to a section they skipped except by scrolling. This rail keeps both
 * within reach on the viewports that have the room for it, and is simply
 * absent below `xl` where the single column is the right answer and the sticky
 * footer already carries progress.
 *
 * It is a `nav` of real anchor-style buttons rather than links: the form is a
 * client component with no routing involved, and pushing `#section` into the
 * URL would leave the reviewer's back button walking through their own
 * scrolling.
 */
export default function ReviewSectionNav({
  sections,
  answered,
  total,
  onJump,
}: {
  sections: SectionProgress[];
  answered: number;
  total: number;
  onJump: (id: string) => void;
}) {
  if (sections.length === 0) return null;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <nav
      aria-label="Form sections"
      className="sticky top-24 flex flex-col gap-4"
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Progress
        </p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900">
          {pct}
          <span className="text-base font-semibold text-gray-400">%</span>
        </p>
        <p className="text-xs text-gray-400">
          {answered} of {total} answered
        </p>
      </div>

      <ul className="flex flex-col gap-0.5 border-l border-gray-100">
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onJump(s.id)}
              className="group -ml-px flex w-full items-start gap-2.5 border-l-2 border-transparent py-2 pl-3.5 pr-2 text-left transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]/40 data-[complete=true]:border-emerald-400"
              data-complete={s.complete}
            >
              {s.complete ? (
                <PiCheckCircleFill
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
                  aria-hidden="true"
                />
              ) : (
                <PiCircleDashed
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300"
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium leading-snug text-gray-600 transition-colors group-hover:text-gray-900">
                  {s.title}
                </span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-gray-400">
                  {s.answered}/{s.total}
                  {s.missingRequired > 0 && (
                    <span className="ml-1.5 text-[#b20202]">
                      · {s.missingRequired} required
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
