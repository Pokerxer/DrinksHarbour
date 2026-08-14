'use client';

// The attendance log — `/employees/attendance`.
//
// The question a manager opens this with is "who is in", not "what happened",
// so the screen is grouped by person and the people still clocked in sort to
// the top. A flat list of punches answers the second question and makes you
// derive the first.
//
// Corrections are first-class here, and every one of them shows its author: the
// record is the employee's own account of their day, and if somebody changed it
// that has to be visible next to the number it produced. The server stamps
// `editedBy` on every PATCH — this screen only has to render it.
//
// What it will NOT do is delete a kiosk punch. The API refuses with a 409 and
// the button is not offered: a punch is what the employee actually did, and it
// can be corrected but not made to have never happened.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiArrowsClockwise,
  PiCaretLeft,
  PiCaretRight,
  PiClockUserDuotone,
  PiFingerprintDuotone,
  PiPlus,
  PiX,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import { FIELD, Field } from './org-config-page';
import AttendanceLogTable from './attendance-log-table';
import AttendanceLiveBoard from './attendance-live-board';
import AttendanceDayTimeline from './attendance-day-timeline';
import AttendanceWeekTimesheet from './attendance-week-timesheet';
import AttendanceExceptions from './attendance-exceptions';
import {
  LAGOS_OFFSET_MINUTES,
  addDays,
  buildWeek,
  localToday,
  startOfWeek,
  toLocalDateKey,
  weekRangeLabel,
  formatMinutes,
} from './shift-roster-utils';
import { recordTimes } from './attendance-utils';
import { attendanceRate, buildAttendanceBoard } from './attendance-board-utils';
import {
  attendanceService,
  type AttendanceRecord,
  type AttendanceSummary,
} from '@/services/attendance.service';
import { employeeService, type Employee } from '@/services/employee.service';
import { shiftService, type Shift } from '@/services/shift.service';
import {
  timeOffService,
  type TimeOffRequest,
} from '@/services/timeOff.service';
import { refId } from '@/services/orgStructure.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

const EMPTY_SUMMARY: AttendanceSummary = {
  total: 0,
  open: 0,
  closed: 0,
  late: 0,
  minutes: 0,
  hours: 0,
};

const VIEWS = [
  { key: 'live', label: 'Live' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'log', label: 'Log' },
  { key: 'week', label: 'Week' },
  { key: 'exceptions', label: 'Exceptions' },
] as const;

export type AttendanceView = (typeof VIEWS)[number]['key'];

const VIEW_KEYS = VIEWS.map((v) => v.key) as readonly string[];

/** An unknown ?view= falls back rather than rendering nothing. */
function parseView(raw: string | null): AttendanceView {
  return VIEW_KEYS.includes(raw ?? '') ? (raw as AttendanceView) : 'live';
}

/** Only the week view widens the window; every other view is one day. */
function rangeFor(
  view: AttendanceView,
  day: string
): { from: string; to: string } {
  if (view !== 'week') return { from: day, to: day };
  const first = startOfWeek(day);
  return { from: first, to: addDays(first, 6) };
}

/** The drawer's draft: local wall clock, because that is what an admin types. */
interface EntryDraft {
  id: string | null;
  employee: string;
  date: string;
  inTime: string;
  /** Empty means the record stays (or becomes) open — a real instruction. */
  outTime: string;
  note: string;
  /** A kiosk punch may be corrected but not deleted. */
  source: AttendanceRecord['source'];
}

const NEW_DRAFT = (date: string): EntryDraft => ({
  id: null,
  employee: '',
  date,
  inTime: '09:00',
  outTime: '',
  note: '',
  source: 'admin',
});

/** 'YYYY-MM-DD' + 'HH:MM' in the tenant's zone → the absolute instant. */
function toUtc(date: string, time: string): string {
  const base = Date.parse(`${date}T00:00:00.000Z`);
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(base) || !Number.isFinite(h) || !Number.isFinite(m))
    return '';
  return new Date(base + (h * 60 + m - OFFSET) * 60_000).toISOString();
}

function dayLabel(dateISO: string): string {
  const ms = Date.parse(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return dateISO;
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function AttendanceLogPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const router = useRouter();
  const searchParams = useSearchParams();

  const view = parseView(searchParams.get('view'));
  const day = searchParams.get('date') || localToday(OFFSET);

  const [employeeFilter, setEmployeeFilter] = useState('');
  const [items, setItems] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(EMPTY_SUMMARY);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  /** False when the roster or leave read failed. Absence counts go '—'. */
  const [rosterReady, setRosterReady] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [saving, setSaving] = useState(false);
  /** Ticks so open records show a live elapsed. Display only. */
  const [now, setNow] = useState(() => Date.now());

  /** Both are in the URL, so a manager can send somebody this exact screen. */
  const setParams = useCallback(
    (next: { view?: AttendanceView; date?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.view) params.set('view', next.view);
      if (next.date) params.set('date', next.date);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const range = useMemo(() => rangeFor(view, day), [view, day]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const employee = employeeFilter || undefined;

    // The punches are the only required read. The roster and leave are what
    // make an ABSENCE visible — an absence leaves no record, so it cannot be
    // computed from punches at any price — but a failure in either must not
    // blank the punches, which are still true.
    const [log, roster, leave] = await Promise.allSettled([
      attendanceService.log({ ...range, employee }, token),
      shiftService.roster({ ...range, employee }, token),
      timeOffService.list(
        { ...range, employee, status: 'approved', scope: 'all' },
        token
      ),
    ]);

    if (log.status === 'fulfilled') {
      setItems(log.value.items);
      setSummary(log.value.summary);
    } else {
      toast.error(
        log.reason instanceof Error
          ? log.reason.message
          : 'Failed to load attendance'
      );
      setItems([]);
      setSummary(EMPTY_SUMMARY);
    }

    setShifts(roster.status === 'fulfilled' ? roster.value.items : []);
    setTimeOff(leave.status === 'fulfilled' ? leave.value.items : []);
    // Reporting zero absences from a failed roster read would be good news
    // nobody verified. The page says "unknown" instead.
    setRosterReady(
      roster.status === 'fulfilled' && leave.status === 'fulfilled'
    );

    setLoading(false);
  }, [token, range, employeeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    employeeService
      .getEmployees(token, { status: 'active' })
      .then((r) => {
        if (!cancelled) setEmployees(r.data.employees);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Whether anybody can clock in at all is a property of their PIN, not their
  // POS access — but the PIN is still User.posPinHash, so somebody with none
  // cannot use the kiosk. Surfaced rather than left to be discovered when a
  // driver stands at the pad and nothing works.
  const withoutPin = useMemo(
    () => employees.filter((e) => !e.hasPin).length,
    [employees]
  );

  const board = useMemo(
    () =>
      buildAttendanceBoard({
        records: items,
        shifts,
        timeOff,
        now,
      }),
    [items, shifts, timeOff, now]
  );

  const rate = attendanceRate(board.totals);

  // Only the live board polls, and only while it is on screen. An interval
  // left running behind the other four views is background traffic nobody
  // asked for, and a hidden tab is nobody looking.
  useEffect(() => {
    if (view !== 'live') return;
    const tick = () => {
      if (document.hidden) return;
      setNow(Date.now());
      void load();
    };
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [view, load]);

  function openCorrection(record: AttendanceRecord) {
    const times = recordTimes(record, OFFSET);
    setDraft({
      id: record._id,
      employee: refId(record.employee),
      date: toLocalDateKey(record.clockIn, OFFSET),
      inTime: times.in,
      outTime: record.clockOut ? times.out : '',
      note: record.note ?? '',
      source: record.source,
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.employee) return toast.error('Choose whose record this is');
    const clockIn = toUtc(draft.date, draft.inTime);
    if (!clockIn) return toast.error('Enter a clock-in time like 09:00');

    // An out time at or before the in time means the shift ran past midnight —
    // the same rule the roster applies to an overnight template.
    const clockOut = draft.outTime
      ? toUtc(
          draft.outTime <= draft.inTime ? addDays(draft.date, 1) : draft.date,
          draft.outTime
        )
      : null;
    if (draft.outTime && !clockOut)
      return toast.error('Enter a clock-out time like 17:00');

    setSaving(true);
    try {
      if (draft.id) {
        await attendanceService.update(
          draft.id,
          { clockIn, clockOut, note: draft.note },
          token
        );
        toast.success('Correction saved');
      } else {
        await attendanceService.create(
          { employee: draft.employee, clockIn, clockOut, note: draft.note },
          token
        );
        toast.success('Attendance added');
      }
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: AttendanceRecord) {
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

  const kpis = [
    {
      label: 'On the clock',
      value: String(board.totals.onTheClock),
      tone: board.totals.onTheClock ? 'text-green-600' : 'text-gray-900',
    },
    {
      // '—' rather than 100% when the roster never arrived: a percentage of an
      // unknown denominator is a made-up number.
      label: 'Attendance',
      value: rosterReady && rate !== null ? `${rate}%` : '—',
      tone: 'text-gray-900',
    },
    {
      label: 'Hours',
      value: formatMinutes(summary.minutes),
      tone: 'text-gray-900',
    },
    {
      label: 'Late',
      value: String(board.totals.late),
      tone: board.totals.late ? 'text-amber-600' : 'text-gray-900',
    },
    {
      label: 'Absent',
      value: rosterReady ? String(board.totals.absent) : '—',
      tone: board.totals.absent ? 'text-red-600' : 'text-gray-900',
    },
  ];

  const step = view === 'week' ? 7 : 1;
  const rangeLabel =
    view === 'week' ? weekRangeLabel(buildWeek(day)) : dayLabel(day);

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
              Attendance
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Who is in, who was late, and how long they worked.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.employees.attendanceKiosk}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
          >
            <PiFingerprintDuotone className="h-4 w-4" />
            Open the kiosk
          </Link>
          <button
            type="button"
            onClick={() => setDraft(NEW_DRAFT(day))}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
          >
            <PiPlus className="h-4 w-4" />
            Add by hand
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {k.label}
            </span>
            <span className={`text-xl font-black tabular-nums ${k.tone}`}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* View + day + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setParams({ view: v.key })}
              aria-pressed={view === v.key}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                view === v.key
                  ? 'bg-[#b20202] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setParams({ date: addDays(day, -step) })}
            aria-label={`Previous ${view === 'week' ? 'week' : 'day'}`}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <PiCaretLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold tabular-nums text-gray-900">
            {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => setParams({ date: addDays(day, step) })}
            aria-label={`Next ${view === 'week' ? 'week' : 'day'}`}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <PiCaretRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setParams({ date: localToday(OFFSET) })}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          Today
        </button>

        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">Everyone</option>
          {employees.map((e) => (
            <option key={e._id} value={e._id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </select>

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

      {withoutPin > 0 && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {withoutPin} active{' '}
          {withoutPin === 1 ? 'employee has' : 'employees have'} no PIN set and
          cannot use the kiosk. Set one on their profile under POS access.
        </p>
      )}

      {!rosterReady && (
        <p className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          The roster could not be loaded, so absences are not shown. The punches
          below are complete.
        </p>
      )}

      {view === 'log' && (
        <AttendanceLogTable
          records={items}
          loading={loading}
          dayLabel={dayLabel(day)}
          onCorrect={openCorrection}
          onDelete={(record) => void remove(record)}
        />
      )}

      {view === 'live' && (
        <AttendanceLiveBoard
          board={board}
          now={now}
          loading={loading}
          onCorrect={openCorrection}
        />
      )}

      {view === 'timeline' && (
        <AttendanceDayTimeline
          board={board}
          now={now}
          loading={loading}
          onCorrect={openCorrection}
        />
      )}

      {view === 'week' && (
        <AttendanceWeekTimesheet
          board={board}
          days={buildWeek(day)}
          loading={loading}
        />
      )}

      {view === 'exceptions' && (
        <AttendanceExceptions
          board={board}
          // Today's start, not the day in view: the log query already bounds
          // every record at the start of the day in view, so measuring against
          // it can never find a record that began earlier.
          staleBefore={
            Date.parse(`${localToday(OFFSET)}T00:00:00.000Z`) - OFFSET * 60_000
          }
          loading={loading}
          onCorrect={openCorrection}
        />
      )}

      {/* Entry / correction drawer */}
      <AnimatePresence>
        {draft && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDraft(null)}
              className="fixed inset-0 z-40 bg-gray-900/30"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-base font-bold text-gray-900">
                  {draft.id ? 'Correct attendance' : 'Add attendance'}
                </h2>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                >
                  <PiX className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {draft.id && draft.source === 'kiosk' && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    This is a clock-in the employee made. Correcting it records
                    your name against the change; it cannot be deleted.
                  </p>
                )}

                <Field label="Employee">
                  <select
                    className={FIELD}
                    value={draft.employee}
                    disabled={Boolean(draft.id)}
                    onChange={(e) =>
                      setDraft({ ...draft, employee: e.target.value })
                    }
                  >
                    <option value="">Choose someone…</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.firstName} {e.lastName}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Date">
                  <input
                    type="date"
                    className={FIELD}
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Clocked in">
                    <input
                      type="time"
                      className={FIELD}
                      value={draft.inTime}
                      onChange={(e) =>
                        setDraft({ ...draft, inTime: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Clocked out" hint="(leave blank if still in)">
                    <input
                      type="time"
                      className={FIELD}
                      value={draft.outTime}
                      onChange={(e) =>
                        setDraft({ ...draft, outTime: e.target.value })
                      }
                    />
                  </Field>
                </div>
                {draft.outTime !== '' && draft.outTime <= draft.inTime && (
                  <p className="-mt-2 text-xs text-amber-600">
                    This runs past midnight and ends the following day.
                  </p>
                )}
                {draft.id && draft.outTime === '' && (
                  <p className="-mt-2 text-xs text-amber-600">
                    Clearing the clock-out re-opens this record.
                  </p>
                )}

                <Field label="Note" hint="(why it was changed)">
                  <textarea
                    className={FIELD}
                    rows={3}
                    value={draft.note}
                    onChange={(e) =>
                      setDraft({ ...draft, note: e.target.value })
                    }
                  />
                </Field>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8f0202] disabled:opacity-60"
                >
                  {saving
                    ? 'Saving…'
                    : draft.id
                      ? 'Save correction'
                      : 'Add record'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
