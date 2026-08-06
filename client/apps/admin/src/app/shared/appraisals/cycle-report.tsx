'use client';

// shared/appraisals/cycle-report.tsx — how ratings landed across one cycle.
//
// HR-only by mount point, like the roster: `GET /api/appraisal-cycles/:id/
// report` sits on the admin-gated cycle router. Unlike the roster this payload
// carries no reviewer identity at all — only counts and means — so it cannot
// widen the module's privacy asymmetry even if it were rendered elsewhere.
//
// Plain CSS bars (a div with a percentage width) on purpose: two panels do not
// justify pulling a charting library into an admin bundle that has already
// OOM'd a Vercel build once.

import { useEffect, useState } from 'react';
import { PiWarningCircle } from 'react-icons/pi';
import {
  fetchCycleReport,
  type CycleReport as CycleReportData,
  type QuestionStat,
} from '@/services/appraisal.service';

type Kind = 'self' | 'manager' | 'peer';

const KIND_LABEL: Record<Kind, string> = {
  self: 'Self',
  manager: 'Manager',
  peer: 'Peers',
};

const KIND_BAR: Record<Kind, string> = {
  self: 'bg-sky-400',
  manager: 'bg-[#b20202]',
  peer: 'bg-amber-400',
};

/**
 * Percentage width for a mean on this question's own scale. Returns null when
 * there is nothing honest to draw: no mean, or no usable `scaleMax`.
 *
 * A missing scale is NOT defaulted to 5. Means are never rescaled or pooled
 * across questions either — 4/5 and 9/10 are arithmetic on two different
 * units, which is exactly why the server keeps `scaleMax` per question.
 */
export function barPercent(
  mean: number | null,
  scaleMax?: number
): number | null {
  if (mean === null || !Number.isFinite(mean)) return null;
  if (
    typeof scaleMax !== 'number' ||
    !Number.isFinite(scaleMax) ||
    scaleMax <= 0
  )
    return null;
  return Math.max(0, Math.min(100, (mean / scaleMax) * 100));
}

function KindBar({
  kind,
  stat,
  scaleMax,
}: {
  kind: Kind;
  stat: { mean: number | null; n: number };
  scaleMax?: number;
}) {
  const pct = barPercent(stat.mean, scaleMax);
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-gray-400">
        {KIND_LABEL[kind]}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        {pct !== null && (
          <div
            className={`h-full rounded-full ${KIND_BAR[kind]}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <span className="w-28 shrink-0 text-right text-xs text-gray-500">
        {/* A null mean is an em dash with its n, NEVER a 0 — nobody scored 0,
            the question simply has no submitted ratings. */}
        {stat.mean === null ? (
          <span className="text-gray-300">—</span>
        ) : (
          <span className="font-semibold text-gray-700">
            {stat.mean}
            {typeof scaleMax === 'number' ? ` / ${scaleMax}` : ''}
          </span>
        )}
        <span className="ms-1 text-gray-400">(n={stat.n})</span>
      </span>
    </div>
  );
}

function QuestionBlock({ q }: { q: QuestionStat }) {
  return (
    <div className="border-t border-gray-50 py-3 first:border-t-0">
      <p className="text-sm font-medium text-gray-800">{q.label}</p>
      {q.sectionTitle && (
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">
          {q.sectionTitle}
        </p>
      )}
      <div className="mt-2 flex flex-col gap-1.5">
        <KindBar kind="self" stat={q.self} scaleMax={q.scaleMax} />
        <KindBar kind="manager" stat={q.manager} scaleMax={q.scaleMax} />
        <KindBar kind="peer" stat={q.peer} scaleMax={q.scaleMax} />
      </div>
    </div>
  );
}

export default function CycleReport({ cycleId }: { cycleId: string }) {
  const [data, setData] = useState<CycleReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCycleReport(cycleId);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load the report'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cycleId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-gray-50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Results</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
          <PiWarningCircle className="h-4 w-4 shrink-0 text-gray-400" />
          {error}
        </p>
      </div>
    );
  }

  if (!data || data.releasedCount === 0) {
    // An explicit empty state, not two blank panels — a blank panel reads as
    // broken rather than as "there is nothing to show yet".
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Results</p>
        <p className="mt-2 text-sm text-gray-400">
          No appraisals have been released yet. Results appear here once
          managers release them.
        </p>
      </div>
    );
  }

  // The histogram counts do NOT have to sum to releasedCount: an appraisal
  // released without a final rating is still released, and the server refuses
  // to invent a 0 bucket for it. So both numbers are captioned rather than
  // leaving the difference to look like a bug.
  const scored = data.finalRatingHistogram.reduce((sum, b) => sum + b.count, 0);
  const maxCount = data.finalRatingHistogram.reduce(
    (max, b) => Math.max(max, b.count),
    0
  );

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">Results</p>
      <p className="mt-1 text-xs text-gray-400">
        {data.releasedCount} released, {scored} scored
      </p>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Final ratings
        </p>
        {data.finalRatingHistogram.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">
            None of the released appraisals carry a final rating.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {data.finalRatingHistogram.map((bucket) => (
              <div key={bucket.rating} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-gray-500">
                  Rating {bucket.rating}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#b20202]"
                    style={{
                      width: `${maxCount ? (bucket.count / maxCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-semibold text-gray-700">
                  {bucket.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          By question
        </p>
        {data.questionStats.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">
            This cycle&rsquo;s form has no rating questions.
          </p>
        ) : (
          <div className="mt-2">
            {data.questionStats.map((q) => (
              <QuestionBlock key={q.questionId} q={q} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-5 border-t border-gray-50 pt-3 text-[11px] text-gray-400">
        With few released appraisals a cycle mean reflects one or two people,
        not a trend.
      </p>
    </div>
  );
}
