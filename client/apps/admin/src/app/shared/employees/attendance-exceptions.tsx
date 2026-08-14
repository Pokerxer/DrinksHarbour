'use client';

// Everything on this window that wants a manager, worst first.
//
// The action is ON the row, not behind a navigation: this is the view where the
// work actually gets done, and a worklist you have to leave to act on is a
// list, not a worklist.

import Link from 'next/link';
import { PiPencilSimple } from 'react-icons/pi';
import {
  LAGOS_OFFSET_MINUTES,
  formatMinutes,
  toLocalTimeLabel,
} from './shift-roster-utils';
import {
  EXCEPTION_ORDER,
  buildExceptions,
  shiftWindowLabel,
  type AttendanceBoard,
  type ExceptionKind,
  type ExceptionRow,
} from './attendance-board-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

const KIND_LABEL: Record<ExceptionKind, string> = {
  stale_open: 'Never clocked out',
  absent: 'Rostered, no punch',
  late: 'Late',
  left_early: 'Left early',
  unrostered: 'No shift',
};

const KIND_TONE: Record<ExceptionKind, string> = {
  stale_open: 'bg-red-50 text-red-700 border-red-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  left_early: 'bg-amber-50 text-amber-700 border-amber-200',
  unrostered: 'bg-gray-50 text-gray-600 border-gray-200',
};

/** Why this row is here, in words a manager can act on. */
function why(row: ExceptionRow): string {
  const shift = row.entry.shift;
  const window = shiftWindowLabel(shift, OFFSET);

  switch (row.kind) {
    case 'stale_open':
      return row.record
        ? `In at ${toLocalTimeLabel(row.record.clockIn, OFFSET)} and never out — this record is counting 0 minutes.`
        : 'Never clocked out.';
    case 'absent':
      return `Rostered ${window} and nothing was punched.`;
    case 'late':
      return `${formatMinutes(row.minutes)} after the ${window} start.`;
    case 'left_early':
      return `Left ${formatMinutes(row.minutes)} before the ${window} end.`;
    default:
      return row.record
        ? `Punched ${toLocalTimeLabel(row.record.clockIn, OFFSET)} against no rostered shift.`
        : 'No rostered shift.';
  }
}

interface Props {
  board: AttendanceBoard;
  /** Start of the day in view, ms. An open record from before it is stale. */
  dayStart: number;
  loading: boolean;
  onCorrect: (record: AttendanceRecord) => void;
}

export default function AttendanceExceptions({
  board,
  dayStart,
  loading,
  onCorrect,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const rows = buildExceptions(board.people, { dayStart });

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center">
        <p className="text-sm font-semibold text-green-600">
          Nothing to chase.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Everybody rostered turned up, on time, and clocked out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {EXCEPTION_ORDER.map((kind) => {
        const group = rows.filter((r) => r.kind === kind);
        if (!group.length) return null;

        return (
          <section key={kind}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              {KIND_LABEL[kind]}
              <span className="ml-2 tabular-nums text-gray-400">
                {group.length}
              </span>
            </h2>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {group.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${KIND_TONE[kind]}`}
                  >
                    {KIND_LABEL[kind]}
                  </span>

                  <div className="min-w-0 flex-1">
                    {row.employeeId ? (
                      <Link
                        href={routes.employees.attendanceFor(row.employeeId)}
                        className="font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-900">
                        {row.name}
                      </span>
                    )}
                    <p className="text-xs text-gray-500">{why(row)}</p>
                  </div>

                  {/* An absence has no record to correct — the fix is a manual
                      entry from the header, or nothing at all if they were
                      genuinely away. */}
                  {row.record ? (
                    <button
                      type="button"
                      onClick={() => onCorrect(row.record as AttendanceRecord)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      <PiPencilSimple className="h-3.5 w-3.5" />
                      Correct
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400">
                      No record to correct
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
