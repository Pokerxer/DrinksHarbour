'use client';

// One employee's attendance history — `/employees/attendance/[employeeId]`.
//
// THE TIMELINE IS SHIFT-LED, NOT PUNCH-LED, and that is the whole point of the
// page. A list of punches cannot show an absence: somebody who never turned up
// produced no record, so a punch-led view renders a clean sheet for the worst
// case it is supposed to catch. Every row here starts from a rostered shift and
// asks what answered it.
//
// The rating is computed on the SERVER (attendanceRating.helpers.js) because it
// needs the roster as its denominator and approved time-off to excuse what it
// must not mark down. This file formats; it never re-derives.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  PiArrowLeft,
  PiArrowsClockwise,
  PiCalendarBlankDuotone,
  PiClockUserDuotone,
  PiPencilSimple,
  PiPlus,
  PiSealCheckDuotone,
  PiTrash,
  PiWarningDuotone,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import {
  LAGOS_OFFSET_MINUTES,
  addDays,
  employeeName,
  formatMinutes,
  localToday,
  toLocalTimeLabel,
} from './shift-roster-utils';
import {
  canDeleteRecord,
  draftFromRecord,
  draftFromShift,
  punctualityLabel,
  punctualityTone,
  recordTimes,
  type AttendanceDraft,
} from './attendance-utils';
import {
  bandLabel,
  bandTone,
  componentRows,
  departureLabel,
  departureTone,
  excusedNote,
  overtimeLabel,
  ratePercent,
  type RatingTone,
} from './attendance-rating-utils';
import AttendanceCorrectionDrawer from './attendance-correction-drawer';
import {
  attendanceService,
  type AttendanceHistoryResponse,
  type AttendanceRecord,
  type AttendanceTimelineEntry,
} from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

/** Thirty days: long enough for a pattern, short enough to still be this job. */
const DEFAULT_DAYS = 30;

const TONE_TEXT: Record<RatingTone, string> = {
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  bad: 'text-rose-700',
  neutral: 'text-gray-500',
};

const TONE_CHIP: Record<RatingTone, string> = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  bad: 'bg-rose-50 text-rose-700 ring-rose-200',
  neutral: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const TONE_BAR: Record<RatingTone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  neutral: 'bg-gray-300',
};

/** A rate's own tone, so a weak component reads as weak inside a good month. */
function rateTone(rate: number | null): RatingTone {
  if (rate === null) return 'neutral';
  if (rate >= 0.9) return 'good';
  if (rate >= 0.75) return 'warn';
  return 'bad';
}

function dayLabel(key: string): string {
  const d = new Date(`${key}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const PRESETS: { label: string; days: number }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

export default function AttendanceHistoryPage({
  employeeId,
}: {
  employeeId: string;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [to, setTo] = useState(() => localToday(OFFSET));
  const [from, setFrom] = useState(() =>
    addDays(localToday(OFFSET), -(DEFAULT_DAYS - 1))
  );
  const [data, setData] = useState<AttendanceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  /** The correction in flight, or null when the drawer is closed. */
  const [draft, setDraft] = useState<AttendanceDraft | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await attendanceService.history(employeeId, { from, to }, token));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not load this history'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, employeeId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (days: number) => {
    const today = localToday(OFFSET);
    setTo(today);
    setFrom(addDays(today, -(days - 1)));
  };

  const rating = data?.rating;
  const rows = useMemo(() => (rating ? componentRows(rating) : []), [rating]);

  const name = data ? employeeName(data.employee) : 'Employee';
  const tone = rating ? bandTone(rating.band) : 'neutral';

  /** Seed the drawer from a record. The person is fixed; both ends are not. */
  function openCorrection(record: AttendanceRecord) {
    const person =
      record.employee && typeof record.employee !== 'string'
        ? record.employee
        : (data?.employee ?? null);
    setDraft(draftFromRecord(record, employeeName(person), OFFSET));
  }

  /**
   * Seed the drawer from a rostered shift nothing answered.
   *
   * This is the only screen that can offer it: the log lists punches, and an
   * absence produced none, so a row for one exists here and nowhere else. The
   * draft carries the shift id, which is what stops the new record filing
   * itself under "no rostered shift" and leaves this row still reading Absent.
   */
  function openEntry(shift: AttendanceTimelineEntry['shift']) {
    if (!data?.employee?._id) return;
    setDraft(
      draftFromShift(
        shift,
        data.employee._id,
        employeeName(data.employee),
        OFFSET
      )
    );
  }

  /**
   * Delete a record added by hand.
   *
   * Offered here because this page can now ADD one, and an add with no undo is
   * a trap: a mistyped entry against the wrong shift would otherwise have to be
   * hunted down on the log page. The API refuses a kiosk punch with a 409, so
   * the button is only drawn for the rows it will accept — see canDeleteRecord.
   */
  async function removeRecord(record: AttendanceRecord) {
    if (
      !window.confirm(
        'Delete this manually added record? This cannot be undone.'
      )
    )
      return;
    try {
      await attendanceService.remove(record._id, token);
      toast.success('Record deleted');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <div className="px-4 py-6 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202] text-white [&>svg]:h-5 [&>svg]:w-5">
            <PiClockUserDuotone />
          </span>
          <div>
            <h1
              className={`${fraunces.className} text-2xl font-black text-gray-900`}
            >
              {name}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Attendance history and rating.
            </p>
          </div>
        </div>

        <Link
          href={routes.employees.attendance}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
        >
          <PiArrowLeft className="h-4 w-4" />
          Back to the log
        </Link>
      </div>

      {/* Range */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => applyPreset(p.days)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              {p.label}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        />
        <span className="text-sm text-gray-400">to</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        />

        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition-colors hover:text-gray-900"
        >
          <PiArrowsClockwise
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {rating && (
        <div className="mb-5 grid gap-4 lg:grid-cols-3">
          {/* The score */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Attendance rating
            </p>
            <div className="mt-2 flex items-end gap-3">
              <span
                className={`${fraunces.className} text-5xl font-black tabular-nums ${TONE_TEXT[tone]}`}
              >
                {rating.score === null ? '—' : rating.score}
              </span>
              {rating.score !== null && (
                <span className="pb-2 text-sm font-semibold text-gray-400">
                  / 100
                </span>
              )}
            </div>
            <span
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${TONE_CHIP[tone]}`}
            >
              {bandLabel(rating.band)}
            </span>

            {rating.score === null && (
              <p className="mt-3 text-xs text-gray-500">
                Nothing was rostered in this window, so there is nothing to
                rate. This is not a score of zero.
              </p>
            )}

            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-xs text-gray-500">
              {excusedNote(rating.counts.excused) && (
                <p className="flex items-center gap-1.5">
                  <PiSealCheckDuotone className="h-3.5 w-3.5 text-emerald-600" />
                  {excusedNote(rating.counts.excused)}
                </p>
              )}
              {overtimeLabel(rating.counts.overtimeMinutes) && (
                <p className="flex items-center gap-1.5">
                  <PiCalendarBlankDuotone className="h-3.5 w-3.5 text-gray-400" />
                  {overtimeLabel(rating.counts.overtimeMinutes)} — reported, not
                  scored
                </p>
              )}
              {rating.counts.unrostered > 0 && (
                <p>
                  {rating.counts.unrostered} punch
                  {rating.counts.unrostered === 1 ? '' : 'es'} matched no shift
                  — not counted either way
                </p>
              )}
            </div>
          </div>

          {/* The breakdown */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              What it is made of
            </p>
            <div className="mt-3 space-y-3">
              {rows.map((r) => {
                const t = rateTone(r.rate);
                return (
                  <div key={r.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-gray-800">
                        {r.label}
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-xs text-gray-400">
                          {r.detail}
                        </span>
                        <span
                          className={`text-sm font-bold tabular-nums ${TONE_TEXT[t]}`}
                        >
                          {r.value}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${TONE_BAR[t]}`}
                        style={{ width: `${Math.round((r.rate ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4">
              {[
                { label: 'Rostered', value: String(rating.counts.expected) },
                { label: 'Attended', value: String(rating.counts.attended) },
                { label: 'Absent', value: String(rating.counts.absent) },
                { label: 'Late', value: String(rating.counts.late) },
                {
                  label: 'Left early',
                  value: String(rating.counts.earlyLeave),
                },
                { label: 'Never closed', value: String(rating.counts.open) },
                {
                  label: 'Hours',
                  value: formatMinutes(rating.counts.minutesWorked),
                },
              ].map((s) => (
                <div key={s.label}>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {s.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-gray-900">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* The timeline */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Rostered</th>
                <th className="px-4 py-3">Actual</th>
                <th className="px-4 py-3">Arrival</th>
                <th className="px-4 py-3">Departure</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.timeline ?? []).map((entry) => (
                <TimelineRow
                  key={entry.shift._id}
                  entry={entry}
                  onCorrect={openCorrection}
                  onAdd={openEntry}
                  onDelete={removeRecord}
                />
              ))}

              {!loading && !data?.timeline?.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    Nothing was rostered in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Punches that belonged to no shift */}
      {!!data?.unrostered?.length && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Punches with no rostered shift
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Turning up on a day nothing was rostered is a normal thing to do.
            These are shown for the record and are not rated.
          </p>
          <ul className="mt-3 space-y-1.5">
            {data.unrostered.map((r) => {
              const times = recordTimes(r, OFFSET);
              return (
                <li
                  key={r._id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-gray-700">
                    {dayLabel(r.clockIn.slice(0, 10))}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="tabular-nums text-gray-500">
                      {times.in} – {times.out}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCorrection(r)}
                      aria-label="Correct this record"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <PiPencilSimple className="h-4 w-4" />
                    </button>
                    {canDeleteRecord(r) && (
                      <button
                        type="button"
                        onClick={() => void removeRecord(r)}
                        aria-label="Delete this record"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <PiTrash className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* The correction drawer. It also ADDS here — an absence row has no
          record to correct — but always for the one person whose page this is,
          so the picker is locked rather than fed an option list. */}
      <AttendanceCorrectionDrawer
        draft={draft}
        employees={[]}
        lockEmployee
        token={token}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}

function TimelineRow({
  entry,
  onCorrect,
  onAdd,
  onDelete,
}: {
  entry: AttendanceTimelineEntry;
  onCorrect: (record: AttendanceRecord) => void;
  /** Only ever called for a row with no record — there is nothing to correct. */
  onAdd: (shift: AttendanceTimelineEntry['shift']) => void;
  onDelete: (record: AttendanceRecord) => void;
}) {
  const { shift, record, excused } = entry;
  const rostered = `${toLocalTimeLabel(shift.start, OFFSET)} – ${toLocalTimeLabel(
    shift.end,
    OFFSET
  )}`;
  const dTone = departureTone(entry.departure);

  return (
    <tr className="text-gray-700">
      <td className="px-4 py-3 font-medium text-gray-900">
        {dayLabel(shift.start.slice(0, 10))}
      </td>
      <td className="px-4 py-3 tabular-nums text-gray-500">{rostered}</td>

      <td className="px-4 py-3">
        {record ? (
          <span className="tabular-nums">
            {recordTimes(record, OFFSET).in} – {recordTimes(record, OFFSET).out}
          </span>
        ) : excused ? (
          // Excused before absent: the shift is out of the reckoning entirely,
          // and rendering it as a gap would read as a mark against them.
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            <PiSealCheckDuotone className="h-3.5 w-3.5" />
            On approved leave
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
            <PiWarningDuotone className="h-3.5 w-3.5" />
            Absent
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        {record && entry.punctuality ? (
          <span
            className={`text-xs font-semibold ${punctualityTone(entry.punctuality.code)}`}
          >
            {punctualityLabel(entry.punctuality)}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        {record ? (
          <span className={`text-xs font-semibold ${TONE_TEXT[dTone]}`}>
            {departureLabel(entry.departure) || '—'}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {record ? (
            <>
              <button
                type="button"
                onClick={() => onCorrect(record)}
                aria-label="Correct this record"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
              >
                <PiPencilSimple className="h-4 w-4" />
              </button>
              {/* Offered only for admin rows: the API refuses a kiosk punch
                  with a 409, and a button that always fails is worse than no
                  button. */}
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
            </>
          ) : (
            // A row with no record is the one thing this page can fix that no
            // other screen can: there is no punch to find on the log, so
            // without this button an absence is uneditable by definition.
            // Offered on an excused row too — approved leave someone worked
            // through anyway is a real thing, and the rating excuses the shift
            // either way.
            <button
              type="button"
              onClick={() => onAdd(shift)}
              aria-label="Record attendance for this shift"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <PiPlus className="h-3.5 w-3.5" />
              Record
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
