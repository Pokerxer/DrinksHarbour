// ── This component must never reference a reviewer ──────────────────────────
//
// It is imported by BOTH appraisal-subject-view and appraisal-manager-view.
// The per-peer breakdown lives in appraisal-peer-breakdown.tsx, which only the
// manager view imports. `grep -n reviewer` on this file must return comments
// only — that absence, not a conditional, is what guarantees the subject's
// render path cannot leak a name.
//
// The render decisions live in comparison-presenter.ts so they can be tested
// without a DOM; this file is a thin renderer over them.

import type { ComparisonRow } from '@/services/appraisal.service';
import { peerCell, scoreCell, type ScoreCell } from './comparison-presenter';

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full ${tone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ScoreRow({
  label,
  cell,
  scaleMax,
  tone,
}: {
  label: string;
  cell: ScoreCell;
  scaleMax: number | null;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-gray-400">{label}</span>
      {cell.kind === 'bar' && cell.pct !== null ? (
        <Bar pct={cell.pct} tone={tone} />
      ) : (
        <div className="h-2 flex-1 rounded-full bg-gray-50" />
      )}
      <span className="w-24 shrink-0 text-right text-xs">
        {cell.kind === 'notAsked' && (
          <span className="text-gray-300">Not asked</span>
        )}
        {/* An em dash, never a zero-width bar: a bar at 0 reads as "rated 0",
            which is a bad review nobody gave. */}
        {cell.kind === 'dash' && <span className="text-gray-300">—</span>}
        {cell.kind === 'bar' && (
          <span className="font-semibold text-gray-700">
            {cell.value}
            {scaleMax === null ? '' : ` / ${scaleMax}`}
          </span>
        )}
      </span>
    </div>
  );
}

function QuestionBlock({ row }: { row: ComparisonRow }) {
  const peer = peerCell(row);
  return (
    <div className="border-t border-gray-50 py-3 first:border-t-0">
      <p className="text-sm font-medium text-gray-800">
        {row.label || 'Untitled question'}
      </p>
      {row.sectionTitle && (
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">
          {row.sectionTitle}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-1.5">
        <ScoreRow
          label="Self"
          cell={scoreCell(row, 'self')}
          scaleMax={row.scaleMax}
          tone="bg-sky-400"
        />
        <ScoreRow
          label="Manager"
          cell={scoreCell(row, 'manager')}
          scaleMax={row.scaleMax}
          tone="bg-[#b20202]"
        />

        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs text-gray-400">Peers</span>
          {peer.kind === 'mean' && peer.pct !== null ? (
            <Bar pct={peer.pct} tone="bg-amber-400" />
          ) : (
            <div className="h-2 flex-1 rounded-full bg-gray-50" />
          )}
          <span className="w-24 shrink-0 text-right text-xs">
            {peer.kind === 'notAsked' && (
              <span className="text-gray-300">Not asked</span>
            )}
            {peer.kind === 'none' && <span className="text-gray-300">—</span>}
            {peer.kind === 'single' && <span className="text-gray-300">—</span>}
            {peer.kind === 'mean' && (
              <span className="font-semibold text-gray-700">
                {peer.mean}
                {row.scaleMax === null ? '' : ` / ${row.scaleMax}`}
              </span>
            )}
          </span>
        </div>

        {/* The small-N gate, spelled out. With one respondent the "mean" would
            BE that person's score, so no number is rendered at all — not a
            rounded one, not a fuzzed one. */}
        {peer.kind === 'single' && (
          <p className="ps-[4.75rem] text-[11px] text-gray-400">
            Based on {peer.n} response{peer.n === 1 ? '' : 's'} — see peer
            feedback below
          </p>
        )}
        {peer.kind === 'none' && (
          <p className="ps-[4.75rem] text-[11px] text-gray-400">
            No peer responses
          </p>
        )}
        {peer.kind === 'mean' && (
          <p className="ps-[4.75rem] text-[11px] text-gray-400">
            {peer.n} peer{peer.n === 1 ? '' : 's'}
          </p>
        )}

        {/* The manager's note on THIS question (Phase 5 §9.3).
            Attributed only as "the manager", never by name — this file renders
            for the subject as well, and naming nobody is what keeps that true
            without a conditional. The server has already stripped the field
            for any viewer not entitled to it (projectFeedbackForViewer), so a
            non-null value here is one this reader may read. */}
        {row.managerComment ? (
          <div className="ms-[4.75rem] mt-2 rounded-lg border-s-2 border-gray-200 bg-gray-50/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Manager’s note
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
              {row.managerComment}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AppraisalComparison({
  rows,
}: {
  rows: ComparisonRow[];
}) {
  // A form with no rating questions produces no rows at all. A heading over
  // nothing reads as broken, so render nothing.
  if (!rows || rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">
        Ratings side by side
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Each question on its own scale. Scores are never averaged across
        questions.
      </p>
      <div className="mt-3">
        {rows.map((row) => (
          <QuestionBlock key={String(row.questionId)} row={row} />
        ))}
      </div>
    </div>
  );
}
