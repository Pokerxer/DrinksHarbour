'use client';

// The flat log — every punch, grouped by person.
//
// Lifted out of attendance-log-page.tsx unchanged when that page grew a view
// switcher. This is the "what happened" framing; the live board answers "who is
// in" and the timeline answers "when". All three read the same records.

import Link from 'next/link';
import { PiPencilSimple, PiTrash } from 'react-icons/pi';
import { LAGOS_OFFSET_MINUTES, formatMinutes } from './shift-roster-utils';
import { shiftWindowLabel } from './attendance-board-utils';
import {
  canDeleteRecord,
  editedByName,
  groupAttendance,
  punctualityLabel,
  punctualityTone,
  recordDuration,
  recordTimes,
  sourceLabel,
} from './attendance-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

interface Props {
  records: AttendanceRecord[];
  loading: boolean;
  /** Already-formatted, e.g. 'Thu, 13 Aug' — used in the empty state. */
  dayLabel: string;
  onCorrect: (record: AttendanceRecord) => void;
  onDelete: (record: AttendanceRecord) => void;
}

export default function AttendanceLogTable({
  records,
  loading,
  dayLabel,
  onCorrect,
  onDelete,
}: Props) {
  const groups = groupAttendance(records);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">In</th>
            <th className="px-4 py-3">Out</th>
            <th className="px-4 py-3">Shift</th>
            <th className="px-4 py-3">Punctuality</th>
            <th className="px-4 py-3">Worked</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                Loading…
              </td>
            </tr>
          )}

          {!loading && !groups.length && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-gray-500">
                  Nobody clocked in on {dayLabel}
                </p>
                <Link
                  href={routes.employees.attendanceKiosk}
                  className="mt-2 inline-block text-sm font-semibold text-[#b20202] hover:underline"
                >
                  Open the kiosk
                </Link>
              </td>
            </tr>
          )}

          {!loading &&
            groups.map((group) =>
              group.records.map((record, i) => {
                const times = recordTimes(record, OFFSET);
                const editor = editedByName(record);
                const shift = record.shift;
                return (
                  <tr
                    key={record._id}
                    className={`border-b border-gray-100 last:border-0 ${
                      i === 0 ? '' : 'bg-gray-50/40'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {i === 0 ? (
                        <div>
                          {/* Through to their history and rating. Plain text
                              when the ref did not populate — there is no id
                              to route to. */}
                          {group.employeeId ? (
                            <Link
                              href={routes.employees.attendanceFor(
                                group.employeeId
                              )}
                              className="font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                            >
                              {group.name}
                            </Link>
                          ) : (
                            <span className="font-semibold text-gray-900">
                              {group.name}
                            </span>
                          )}
                          <p className="text-xs text-gray-400">
                            {group.isIn ? (
                              <span className="font-semibold text-green-600">
                                On the clock
                              </span>
                            ) : (
                              `${formatMinutes(group.minutes)} today`
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">↳</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-900">
                      {times.in}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">
                      {record.clockOut ? (
                        times.out
                      ) : (
                        <span className="text-green-600">still in</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {(typeof shift === 'string'
                        ? ''
                        : shiftWindowLabel(shift, OFFSET)) || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${punctualityTone(
                          record.punctuality?.code
                        )}`}
                      >
                        {punctualityLabel(record.punctuality)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-gray-900">
                      {recordDuration(record)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {sourceLabel(record.source)}
                      </span>
                      {editor && (
                        <p className="text-[11px] text-amber-700">
                          Corrected by {editor}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onCorrect(record)}
                          aria-label="Correct this record"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PiPencilSimple className="h-4 w-4" />
                        </button>
                        {/* Offered only for admin rows: the API refuses a
                            kiosk punch with a 409, and a button that always
                            fails is worse than no button. */}
                        {canDeleteRecord(record) && (
                          <button
                            type="button"
                            onClick={() => onDelete(record)}
                            aria-label="Delete this record"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <PiTrash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
        </tbody>
      </table>
    </div>
  );
}
