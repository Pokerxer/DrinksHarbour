'use client';

// "Who is in the building?" — the question a manager actually opens this screen
// with, answered as a wall of cards rather than a table to read down.
//
// The elapsed figure here is DISPLAY ONLY and is never written back into
// minutesWorked. The server reports 0 minutes for an open record deliberately:
// a running total would make the same record read differently on every refresh,
// and the day's totals would drift while nobody was looking.

import Link from 'next/link';
import { PiPencilSimple } from 'react-icons/pi';
import {
  LAGOS_OFFSET_MINUTES,
  formatMinutes,
  toLocalTimeLabel,
} from './shift-roster-utils';
import {
  shiftWindowLabel,
  type AttendanceBoard,
  type BoardPerson,
  type EntryState,
} from './attendance-board-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

/** Section order matches ENTRY_STATE_RANK: what needs attention comes first. */
const SECTIONS: { state: EntryState; title: string; empty: string }[] = [
  { state: 'in', title: 'On the clock', empty: 'Nobody is clocked in.' },
  { state: 'absent', title: 'Not clocked in', empty: 'Everybody turned up.' },
  { state: 'due', title: 'Due in', empty: 'Nobody else is expected.' },
  { state: 'unrostered', title: 'Unrostered', empty: 'No unrostered punches.' },
  {
    state: 'done',
    title: 'Done for the day',
    empty: 'Nobody has finished yet.',
  },
  { state: 'leave', title: 'On leave', empty: 'Nobody is on leave.' },
];

const TONES: Record<EntryState, { dot: string; ring: string; text: string }> = {
  in: { dot: 'bg-green-500', ring: 'ring-green-200', text: 'text-green-700' },
  absent: { dot: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700' },
  due: { dot: 'bg-sky-400', ring: 'ring-sky-200', text: 'text-sky-700' },
  unrostered: {
    dot: 'bg-amber-400',
    ring: 'ring-amber-200',
    text: 'text-amber-700',
  },
  done: { dot: 'bg-gray-300', ring: 'ring-gray-200', text: 'text-gray-500' },
  leave: {
    dot: 'bg-violet-400',
    ring: 'ring-violet-200',
    text: 'text-violet-700',
  },
};

interface Props {
  board: AttendanceBoard;
  /** Ticks each minute in the shell, so elapsed stays live. */
  now: number;
  loading: boolean;
  onCorrect: (record: AttendanceRecord) => void;
}

/** Initials for the avatar fallback — never blank, never 'undefined'. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function openRecord(person: BoardPerson): AttendanceRecord | null {
  for (const entry of person.entries) {
    for (const record of entry.records) {
      if (record.status === 'open') return record;
    }
  }
  return null;
}

/** The line under the name — what this person's state actually means. */
function detail(person: BoardPerson, now: number): string {
  const open = openRecord(person);
  if (open) {
    const elapsed = Math.max(
      0,
      Math.round((now - new Date(open.clockIn).getTime()) / 60_000)
    );
    return `In at ${toLocalTimeLabel(open.clockIn, OFFSET)} · ${formatMinutes(elapsed)} so far`;
  }

  const first = person.entries[0];
  if (person.state === 'due' && first?.shift) {
    return `Due ${toLocalTimeLabel(first.shift.start, OFFSET)}`;
  }
  if (person.state === 'absent' && first?.shift) {
    return `Rostered ${shiftWindowLabel(first.shift, OFFSET)} · no punch`;
  }
  if (person.state === 'leave') return 'Approved leave';
  if (person.minutesWorked)
    return `${formatMinutes(person.minutesWorked)} worked`;
  return '—';
}

export default function AttendanceLiveBoard({
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

  const populated = SECTIONS.map((section) => ({
    ...section,
    people: board.people.filter((p) => p.state === section.state),
  })).filter(
    (s) => s.people.length || s.state === 'in' || s.state === 'absent'
  );

  return (
    <div className="space-y-6">
      {populated.map((section) => {
        const tone = TONES[section.state];
        return (
          <section key={section.state}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              {section.title}
              <span className="tabular-nums text-gray-400">
                {section.people.length}
              </span>
            </h2>

            {!section.people.length ? (
              <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                {section.empty}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {section.people.map((person) => {
                  const open = openRecord(person);
                  const role = person.entries.find((e) => e.shift?.roleName)
                    ?.shift?.roleName;
                  return (
                    <div
                      key={person.employeeId || person.name}
                      className={`rounded-2xl border border-gray-200 bg-white p-4 ring-1 ring-inset ${tone.ring}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {initials(person.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          {/* Through to their history and rating. Plain text
                              when the ref did not populate — there is no id
                              to route to. */}
                          {person.employeeId ? (
                            <Link
                              href={routes.employees.attendanceFor(
                                person.employeeId
                              )}
                              className="block truncate font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                            >
                              {person.name}
                            </Link>
                          ) : (
                            <span className="block truncate font-semibold text-gray-900">
                              {person.name}
                            </span>
                          )}
                          <p className={`mt-0.5 text-xs ${tone.text}`}>
                            {detail(person, now)}
                          </p>
                          {role && (
                            <p className="mt-1 text-[11px] text-gray-400">
                              {role}
                            </p>
                          )}
                        </div>
                        {open && (
                          <button
                            type="button"
                            onClick={() => onCorrect(open)}
                            aria-label={`Correct ${person.name}’s record`}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
