'use client';

// The day as shape rather than numbers.
//
// The rostered shift is drawn pale, the punch solid on top of it. A late start
// is then a gap on the left and overtime is a tail on the right, both readable
// without comparing two timestamps in your head.
//
// An ABSENT lane draws an outlined bar, never an empty row: an empty row is
// indistinguishable from "no data", and the whole reason this view exists is
// that an absence has no record to show.

import Link from 'next/link';
import {
  LAGOS_OFFSET_MINUTES,
  formatMinutes,
  toLocalTimeLabel,
} from './shift-roster-utils';
import {
  barGeometry,
  timelineWindow,
  type AttendanceBoard,
  type BoardEntry,
} from './attendance-board-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

interface Props {
  board: AttendanceBoard;
  now: number;
  loading: boolean;
  onCorrect: (record: AttendanceRecord) => void;
}

/** The solid bar's colour, by what the entry came to. */
const PUNCH_TONE: Record<string, string> = {
  in: 'bg-green-500',
  done: 'bg-[#b20202]',
  unrostered: 'bg-amber-400',
};

function entryTitle(entry: BoardEntry): string {
  const shift = entry.shift
    ? `Rostered ${toLocalTimeLabel(entry.shift.start, OFFSET)}–${toLocalTimeLabel(entry.shift.end, OFFSET)}`
    : 'No shift';
  const punches = entry.records
    .map(
      (r) =>
        `${toLocalTimeLabel(r.clockIn, OFFSET)}–${
          r.clockOut ? toLocalTimeLabel(r.clockOut, OFFSET) : 'still in'
        }`
    )
    .join(', ');
  return punches ? `${shift} · punched ${punches}` : shift;
}

export default function AttendanceDayTimeline({
  board,
  now,
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

  if (!board.people.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center">
        <p className="text-sm font-medium text-gray-500">
          Nothing rostered and nobody punched.
        </p>
      </div>
    );
  }

  const win = timelineWindow(board.people, now, OFFSET);
  const nowBar = barGeometry(now, now, win);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <div className="min-w-[760px]">
        {/* Hour ruler */}
        <div className="flex border-b border-gray-200 bg-gray-50/60">
          <div className="w-44 shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Employee
          </div>
          <div className="relative flex-1 py-2">
            {win.ticks.map((tick) => (
              <span
                key={tick.label}
                style={{ left: `${tick.leftPct}%` }}
                className="absolute -translate-x-1/2 text-[10px] font-semibold tabular-nums text-gray-400"
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div className="w-20 shrink-0 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Worked
          </div>
        </div>

        {/* Lanes */}
        {board.people.map((person) => (
          <div
            key={person.employeeId || person.name}
            className="flex border-b border-gray-100 last:border-0"
          >
            <div className="w-44 shrink-0 px-4 py-3">
              {person.employeeId ? (
                <Link
                  href={routes.employees.attendanceFor(person.employeeId)}
                  className="block truncate text-sm font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                >
                  {person.name}
                </Link>
              ) : (
                <span className="block truncate text-sm font-semibold text-gray-900">
                  {person.name}
                </span>
              )}
            </div>

            <div className="relative min-h-[44px] flex-1 border-l border-gray-100">
              {/* Hour gridlines, behind everything. */}
              {win.ticks.map((tick) => (
                <span
                  key={tick.label}
                  style={{ left: `${tick.leftPct}%` }}
                  className="absolute inset-y-0 w-px bg-gray-100"
                />
              ))}

              {/* Now. */}
              {nowBar.visible && (
                <span
                  style={{ left: `${nowBar.leftPct}%` }}
                  className="absolute inset-y-0 w-px bg-[#b20202]/40"
                />
              )}

              {person.entries.map((entry) => {
                const rostered = entry.shift
                  ? barGeometry(
                      new Date(entry.shift.start).getTime(),
                      new Date(entry.shift.end).getTime(),
                      win
                    )
                  : null;

                return (
                  <div key={entry.key} title={entryTitle(entry)}>
                    {/* The roster, pale and underneath. */}
                    {rostered?.visible && (
                      <span
                        style={{
                          left: `${rostered.leftPct}%`,
                          width: `${rostered.widthPct}%`,
                        }}
                        className={`absolute top-1/2 h-5 -translate-y-1/2 rounded-md ${
                          entry.state === 'absent'
                            ? 'border-2 border-dashed border-red-300 bg-red-50'
                            : entry.state === 'leave'
                              ? 'border border-violet-200 bg-violet-50'
                              : 'bg-gray-100'
                        }`}
                      />
                    )}

                    {/* The punches, solid and on top. An open record runs to
                        now with a soft edge, so it does not read as a
                        clock-out that happened. */}
                    {entry.records.map((record) => {
                      const from = new Date(record.clockIn).getTime();
                      const to = record.clockOut
                        ? new Date(record.clockOut).getTime()
                        : now;
                      const bar = barGeometry(from, to, win);
                      if (!bar.visible) return null;
                      return (
                        <button
                          key={record._id}
                          type="button"
                          onClick={() => onCorrect(record)}
                          aria-label={`Correct ${person.name}’s record`}
                          style={{
                            left: `${bar.leftPct}%`,
                            width: `${bar.widthPct}%`,
                          }}
                          className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${
                            PUNCH_TONE[entry.state] ?? 'bg-gray-400'
                          } ${record.status === 'open' ? 'opacity-70' : ''} ${
                            bar.clippedEnd ? 'rounded-r-none' : ''
                          } ${bar.clippedStart ? 'rounded-l-none' : ''}`}
                        />
                      );
                    })}

                    {/* An absence has no bar to click, so it says so. */}
                    {entry.state === 'absent' && rostered?.visible && (
                      <span
                        style={{ left: `${rostered.leftPct}%` }}
                        className="absolute top-1/2 ml-2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-red-500"
                      >
                        No punch
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="w-20 shrink-0 px-3 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
              {person.minutesWorked ? formatMinutes(person.minutesWorked) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
