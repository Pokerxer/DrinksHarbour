import { useEffect, useRef } from 'react';
import type { PeerEmployee } from '@/services/peerAppraisal.service';
export default function RatingConfirmation({
  colleagues,
  values,
  busy,
  onConfirm,
  onBack,
}: {
  colleagues: PeerEmployee[];
  values: Record<string, number>;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    region.current?.focus();
  }, []);
  return (
    <section
      aria-label="Review your ratings"
      tabIndex={-1}
      ref={region}
      className="space-y-4 rounded-xl border border-red-200 bg-red-50/50 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]"
    >
      <div>
        <h3 className="font-semibold text-gray-900">Review your ratings</h3>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          You have rated all {colleagues.length} colleagues. Once submitted,
          your ratings cannot be changed.
        </p>
      </div>
      <dl className="max-h-64 divide-y divide-red-100 overflow-y-auto rounded-lg bg-white px-3">
        {colleagues.map((c) => (
          <div
            key={c.employee}
            className="flex items-center justify-between gap-4 py-3 text-sm"
          >
            <dt className="min-w-0 break-words">{c.displayName}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-[#790505]">
              {values[c.employee]} / 5
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onBack}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          Keep editing
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-lg bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202] disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Confirm and submit'}
        </button>
      </div>
    </section>
  );
}
