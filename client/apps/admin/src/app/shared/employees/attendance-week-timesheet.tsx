'use client';

// The payroll framing: how many hours did each person do this week.
//
// A cell carrying a late arrival or an absence gets a corner marker, so the
// exceptions are not laundered into an hours figure. An hours total that hides
// three absences is worse than no total.

import Link from 'next/link';
import { formatMinutes, type DayColumn } from './shift-roster-utils';
import { buildTimesheet, type AttendanceBoard } from './attendance-board-utils';
import { routes } from '@/config/routes';

interface Props {
  board: AttendanceBoard;
  days: DayColumn[];
  loading: boolean;
}

export default function AttendanceWeekTimesheet({
  board,
  days,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const sheet = buildTimesheet(board.people, days);

  if (!sheet.rows.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center">
        <p className="text-sm font-medium text-gray-500">
          Nothing rostered and nobody punched this week.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/60 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3 text-left">Employee</th>
            {days.map((day) => (
              <th
                key={day.date}
                className={`px-3 py-3 text-center ${day.isWeekend ? 'text-gray-300' : ''}`}
              >
                {day.weekday} {day.dayNumber}
              </th>
            ))}
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) => (
            <tr
              key={row.employeeId || row.name}
              className="border-b border-gray-100 last:border-0"
            >
              <td className="px-4 py-3">
                {row.employeeId ? (
                  <Link
                    href={routes.employees.attendanceFor(row.employeeId)}
                    className="font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                  >
                    {row.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-900">{row.name}</span>
                )}
              </td>

              {days.map((day) => {
                const cell = row.cells[day.date];
                return (
                  <td
                    key={day.date}
                    className={`relative px-3 py-3 text-center tabular-nums ${
                      cell.minutes
                        ? 'font-semibold text-gray-900'
                        : 'text-gray-300'
                    } ${day.isWeekend ? 'bg-gray-50/40' : ''}`}
                  >
                    {cell.minutes ? formatMinutes(cell.minutes) : '·'}
                    {cell.open && (
                      <span
                        title="Still on the clock"
                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-500"
                      />
                    )}
                    {cell.late && (
                      <span
                        title="Late arrival"
                        className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                      />
                    )}
                    {cell.absent && (
                      <span
                        title="Rostered, no punch"
                        className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-red-500"
                      />
                    )}
                  </td>
                );
              })}

              <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                {row.total ? formatMinutes(row.total) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50/60">
            <td className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Total
            </td>
            {days.map((day) => (
              <td
                key={day.date}
                className="px-3 py-3 text-center text-sm font-bold tabular-nums text-gray-900"
              >
                {sheet.dayTotals[day.date]
                  ? formatMinutes(sheet.dayTotals[day.date])
                  : '·'}
              </td>
            ))}
            <td className="px-4 py-3 text-right text-sm font-black tabular-nums text-[#b20202]">
              {formatMinutes(sheet.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
        <span className="mr-3">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
          late
        </span>
        <span className="mr-3">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
          rostered, no punch
        </span>
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />
          still on the clock
        </span>
      </p>
    </div>
  );
}
