'use client';

import type { summariseFillResult } from './shift-roster-utils';

/**
 * The outcome of a pattern fill: what was created, and who could not be placed.
 *
 * Shared by the roster and the employee page — the same fill runs from both, so
 * the same report renders in both. Takes the ALREADY-summarised result rather
 * than the raw response, so the grouping rule lives in one tested place
 * (`summariseFillResult`) instead of in this component.
 */
export default function FillReportModal({
  report,
  onClose,
}: {
  report: ReturnType<typeof summariseFillResult>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex w-full max-w-md flex-col rounded-2xl bg-white p-5">
        <h2 className="text-sm font-bold text-gray-900">{report.heading}</h2>
        {/* `skipped` is reported in full by design — 3 people x 90 days all on
            leave is 270 lines. Without a height cap that pushes Done off the
            bottom of the screen; this keeps it reachable and scrolls the rest. */}
        <div className="mt-1 max-h-[70vh] overflow-y-auto">
          {report.groups.map((g) => (
            <div key={g.name} className="mt-3">
              <p className="text-xs font-semibold text-gray-700">{g.name}</p>
              {g.lines.map((l, i) => (
                // The controller groups every unresolved employee under the
                // literal name 'Unknown employee', so two deleted employees can
                // produce an identical line — the index keeps the key unique.
                <p
                  key={`${g.name}-${i}-${l}`}
                  className="text-xs text-gray-500"
                >
                  ⚠ {l}
                </p>
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
