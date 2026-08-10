'use client';

// The week roster — `/employees/shifts`.
//
// Employees are rows, days are columns, and the OPEN lane is pinned above the
// employee rows rather than sorted among them. That position is the point of
// the screen: a roster is generated unassigned and filled afterwards, so the
// work still to do has to be the first thing read, not something found by
// scrolling.
//
// Every rule this screen enforces belongs to the server. A 409 carries a
// machine-readable code, and only `role_mismatch` offers "assign anyway" —
// an overlap is refused with force too, so a button for it would just produce
// the same refusal a second time.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiCalendarBlankDuotone,
  PiCaretLeft,
  PiCaretRight,
  PiPlus,
  PiX,
  PiArrowsClockwise,
  PiWarningCircle,
  PiSparkle,
  PiPaperPlaneTilt,
  PiTrash,
  PiGearSix,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import { FIELD, Field } from './org-config-page';
import {
  LAGOS_OFFSET_MINUTES,
  addDays,
  buildWeek,
  buildRosterLanes,
  canForce,
  conflictLabel,
  employeeName,
  formatMinutes,
  localToday,
  localWindowToUtc,
  startOfWeek,
  statusTone,
  summariseSkips,
  templateRepeatLabel,
  templateTimeLabel,
  toLocalDateKey,
  toLocalTimeLabel,
  weekRangeLabel,
  type RosterLane,
} from './shift-roster-utils';
import {
  shiftService,
  shiftTemplateService,
  ShiftConflictError,
  type RosterSummary,
  type Shift,
  type ShiftTemplate,
} from '@/services/shift.service';
import {
  employeeRoleService,
  refId,
  type EmployeeRole,
} from '@/services/orgStructure.service';
import { employeeService, type Employee } from '@/services/employee.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

/** The drawer's draft: wall clock, because that is what an admin types. */
interface ShiftDraft {
  id: string | null;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  role: string;
  employee: string;
  note: string;
  status: Shift['status'];
}

const NEW_DRAFT = (
  date: string,
  employee: string,
  role: string
): ShiftDraft => ({
  id: null,
  date,
  startTime: '09:00',
  endTime: '17:00',
  breakMinutes: 0,
  role,
  employee,
  note: '',
  status: 'draft',
});

export default function ShiftRosterPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [anchor, setAnchor] = useState(() => startOfWeek(localToday(OFFSET)));
  const days = useMemo(() => buildWeek(anchor), [anchor]);
  const from = days[0].date;
  const to = days[6].date;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [summary, setSummary] = useState<RosterSummary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [chosenTemplates, setChosenTemplates] = useState<string[]>([]);

  const loadRoster = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await shiftService.roster({ from, to }, token);
      setShifts(data.items);
      setSummary(data.summary);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load the roster'
      );
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // The pickers. Loaded once — they do not change as the week moves.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      employeeService.getEmployees(token, { status: 'active' }),
      employeeRoleService.list(token, { isActive: true }),
      shiftTemplateService.list(token),
    ])
      .then(([e, r, t]) => {
        if (cancelled) return;
        setEmployees(e.data.employees ?? []);
        setRoles(r);
        setTemplates(t);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('Failed to load employees and templates');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const { open, rows } = useMemo(
    () => buildRosterLanes({ shifts, days, employees, offsetMinutes: OFFSET }),
    [shifts, days, employees]
  );

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.isActive),
    [templates]
  );
  const today = localToday(OFFSET);

  // ── Actions ────────────────────────────────────────────────────────────────

  function openNew(date: string, employeeId: string | null) {
    setConflict(null);
    setDraft(NEW_DRAFT(date, employeeId ?? '', roles[0]?._id ?? ''));
  }

  function openExisting(shift: Shift) {
    setConflict(null);
    setDraft({
      id: shift._id,
      date: toLocalDateKey(shift.start, OFFSET),
      startTime: toLocalTimeLabel(shift.start, OFFSET),
      endTime: toLocalTimeLabel(shift.end, OFFSET),
      breakMinutes: shift.breakMinutes,
      role: refId(shift.role),
      employee: refId(shift.employee),
      note: shift.note ?? '',
      status: shift.status,
    });
  }

  function fromTemplate(
    template: ShiftTemplate,
    date: string,
    employeeId: string | null
  ) {
    setConflict(null);
    setDraft({
      id: null,
      date,
      startTime: template.startTime,
      endTime: template.endTime,
      breakMinutes: template.breakMinutes,
      role: refId(template.role),
      employee: employeeId ?? '',
      note: '',
      status: 'draft',
    });
  }

  async function save(force = false) {
    if (!draft) return;
    if (!draft.role) {
      toast.error('Choose the role this shift needs');
      return;
    }
    const window = localWindowToUtc(
      draft.date,
      draft.startTime,
      draft.endTime,
      OFFSET
    );
    const payload = {
      employee: draft.employee || null,
      role: draft.role,
      start: window.start,
      end: window.end,
      breakMinutes: draft.breakMinutes,
      note: draft.note,
      force,
    };

    setSaving(true);
    setConflict(null);
    try {
      const result = draft.id
        ? await shiftService.update(draft.id, payload, token)
        : await shiftService.create(payload, token);
      // A forced assignment is reported back, never silent.
      for (const w of result.warnings ?? []) toast(w.message, { icon: '⚠️' });
      toast.success(draft.id ? 'Shift updated' : 'Shift added');
      setDraft(null);
      await loadRoster();
    } catch (err) {
      if (err instanceof ShiftConflictError) {
        setConflict({
          code: err.code,
          message: conflictLabel(err.code, err.message),
        });
      } else {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  async function cancelShift() {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await shiftService.update(draft.id, { status: 'cancelled' }, token);
      toast.success('Shift cancelled');
      setDraft(null);
      await loadRoster();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not cancel the shift'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteShift() {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await shiftService.remove(draft.id, token);
      toast.success('Shift deleted');
      setDraft(null);
      await loadRoster();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not delete the shift',
        {
          duration: 6000,
        }
      );
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (!chosenTemplates.length) {
      toast.error('Choose at least one template');
      return;
    }
    setBusy(true);
    try {
      const result = await shiftService.generate(
        { from, to, templateIds: chosenTemplates },
        token
      );
      setGenerateOpen(false);
      toast.success(
        `${result.created} shift${result.created === 1 ? '' : 's'} generated`
      );
      // Skips are the useful half of the answer: "0 created" on its own is
      // indistinguishable from a broken feature.
      for (const group of summariseSkips(result.skipped)) {
        toast(`${group.count} skipped — ${group.reason}`, {
          icon: 'ℹ️',
          duration: 6000,
        });
      }
      await loadRoster();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const { published } = await shiftService.publish({ from, to }, token);
      toast.success(
        published
          ? `${published} shift${published === 1 ? '' : 's'} published`
          : 'Nothing left to publish this week'
      );
      await loadRoster();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publishing failed');
    } finally {
      setBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const laneRow = (lane: RosterLane, isOpenLane: boolean) => (
    <tr
      key={lane.key}
      className={
        isOpenLane
          ? 'border-b-2 border-gray-200 bg-amber-50/40'
          : 'border-b border-gray-100 last:border-0'
      }
    >
      <th
        scope="row"
        className={`sticky left-0 z-10 min-w-[180px] px-4 py-2 text-left align-top ${
          isOpenLane ? 'bg-amber-50/60' : 'bg-white'
        }`}
      >
        <span className="block text-sm font-semibold text-gray-900">
          {lane.name}
        </span>
        <span className="text-xs text-gray-400">
          {lane.count
            ? `${lane.count} · ${formatMinutes(lane.minutes)}`
            : 'No shifts'}
        </span>
      </th>

      {days.map((day) => (
        <td
          key={day.date}
          className={`min-w-[130px] border-l border-gray-100 p-1.5 align-top ${
            day.isWeekend && !isOpenLane ? 'bg-gray-50/40' : ''
          }`}
        >
          <div className="flex flex-col gap-1">
            {lane.cells[day.date].map((shift) => (
              <button
                key={shift._id}
                type="button"
                onClick={() => openExisting(shift)}
                style={{ borderColor: shiftColour(shift) }}
                className={`w-full rounded-lg border-l-4 bg-white px-2 py-1.5 text-left shadow-sm transition-shadow hover:shadow ${statusTone(
                  shift.status
                )}`}
              >
                <span className="block text-xs font-semibold tabular-nums text-gray-900">
                  {toLocalTimeLabel(shift.start, OFFSET)}–
                  {toLocalTimeLabel(shift.end, OFFSET)}
                </span>
                <span className="block truncate text-[11px] text-gray-500">
                  {roleLabel(shift)}
                </span>
                {shift.status === 'draft' && (
                  <span className="mt-0.5 inline-block rounded bg-gray-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Draft
                  </span>
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={() => openNew(day.date, lane.employeeId)}
              aria-label={`Add a shift for ${lane.name} on ${day.date}`}
              className="rounded-lg border border-dashed border-gray-200 py-1 text-gray-300 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
            >
              <PiPlus className="mx-auto h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      ))}
    </tr>
  );

  return (
    <div className="px-4 py-6 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202] text-white [&>svg]:h-5 [&>svg]:w-5">
            <PiCalendarBlankDuotone />
          </span>
          <div>
            <h1
              className={`${fraunces.className} text-2xl font-black text-gray-900`}
            >
              Roster
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Build the week as open shifts, fill them, then publish.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.employees.shiftTemplates}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
          >
            <PiGearSix className="h-4 w-4" />
            Templates
          </Link>
          <button
            type="button"
            onClick={() => {
              setChosenTemplates(activeTemplates.map((t) => t._id));
              setGenerateOpen(true);
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900 disabled:opacity-60"
          >
            <PiSparkle className="h-4 w-4" />
            Generate
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={busy || !summary?.draft}
            title={summary?.draft ? undefined : 'No draft shifts this week'}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202] disabled:opacity-50"
          >
            <PiPaperPlaneTilt className="h-4 w-4" />
            Publish{summary?.draft ? ` (${summary.draft})` : ''}
          </button>
        </div>
      </div>

      {/* Week navigation + summary */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setAnchor(addDays(anchor, -7))}
            aria-label="Previous week"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <PiCaretLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold tabular-nums text-gray-900">
            {weekRangeLabel(days)}
          </span>
          <button
            type="button"
            onClick={() => setAnchor(addDays(anchor, 7))}
            aria-label="Next week"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <PiCaretRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAnchor(startOfWeek(localToday(OFFSET)))}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          This week
        </button>

        <button
          type="button"
          onClick={loadRoster}
          aria-label="Refresh"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition-colors hover:text-gray-900"
        >
          <PiArrowsClockwise
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
        </button>

        {summary && (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <Chip
              label="Open"
              value={summary.open}
              tone={summary.open ? 'warn' : 'plain'}
            />
            <Chip label="Assigned" value={summary.assigned} tone="plain" />
            <Chip
              label="Draft"
              value={summary.draft}
              tone={summary.draft ? 'warn' : 'plain'}
            />
            <Chip label="Published" value={summary.published} tone="good" />
            <Chip label="Hours" value={summary.scheduledHours} tone="plain" />
          </div>
        )}
      </div>

      {/* Template palette */}
      {activeTemplates.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Templates
          </span>
          {activeTemplates.map((t) => (
            <button
              key={t._id}
              type="button"
              onClick={() =>
                fromTemplate(
                  t,
                  today >= from && today <= to ? today : from,
                  null
                )
              }
              title={`Add an open ${t.name} shift`}
              style={{ borderColor: t.color || '#e5e7eb' }}
              className="rounded-lg border-l-4 bg-gray-50 px-2.5 py-1.5 text-left transition-colors hover:bg-gray-100"
            >
              <span className="block text-xs font-semibold text-gray-900">
                {t.name}
              </span>
              <span className="block text-[11px] tabular-nums text-gray-500">
                {templateTimeLabel(t.startTime, t.endTime, t.endDayOffset)} ·{' '}
                {templateRepeatLabel(t)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Who
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  className={`border-l border-gray-100 px-3 py-2 text-left ${
                    day.date === today ? 'bg-[#b20202]/5' : ''
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {day.weekday}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-gray-900">
                    {day.dayNumber} {day.month}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Pinned above the employee rows: the work still to do is the first
                thing the screen should say. */}
            {laneRow(open, true)}

            {loading && !rows.length && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            )}

            {!loading && !rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-sm font-medium text-gray-500">
                    No employees to roster yet
                  </p>
                  <Link
                    href={routes.employees.list}
                    className="mt-2 inline-block text-sm font-semibold text-[#b20202] hover:underline"
                  >
                    Add your team
                  </Link>
                </td>
              </tr>
            )}

            {rows.map((lane) => laneRow(lane, false))}
          </tbody>
        </table>
      </div>

      {/* Shift drawer */}
      <AnimatePresence>
        {draft && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !saving && setDraft(null)}
              className="fixed inset-0 z-40 bg-gray-900/30"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-base font-bold text-gray-900">
                  {draft.id ? 'Edit shift' : 'New shift'}
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
                <Field label="Assigned to" hint="(leave open to fill later)">
                  <select
                    className={FIELD}
                    value={draft.employee}
                    onChange={(e) => {
                      setConflict(null);
                      setDraft({ ...draft, employee: e.target.value });
                    }}
                  >
                    <option value="">Open shift — nobody yet</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {employeeName(e)}
                      </option>
                    ))}
                  </select>
                </Field>

                {conflict && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                      <PiWarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {conflict.message}
                    </p>
                    {canForce(conflict.code) ? (
                      <button
                        type="button"
                        onClick={() => save(true)}
                        disabled={saving}
                        className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        Assign anyway
                      </button>
                    ) : (
                      <p className="mt-1 text-xs text-amber-800">
                        This one cannot be overridden — pick someone else or
                        move the times.
                      </p>
                    )}
                  </div>
                )}

                <Field label="Role required">
                  <select
                    className={FIELD}
                    value={draft.role}
                    onChange={(e) =>
                      setDraft({ ...draft, role: e.target.value })
                    }
                  >
                    <option value="">Choose a role…</option>
                    {roles.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
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
                  <Field label="Starts">
                    <input
                      type="time"
                      className={FIELD}
                      value={draft.startTime}
                      onChange={(e) =>
                        setDraft({ ...draft, startTime: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Ends">
                    <input
                      type="time"
                      className={FIELD}
                      value={draft.endTime}
                      onChange={(e) =>
                        setDraft({ ...draft, endTime: e.target.value })
                      }
                    />
                  </Field>
                </div>
                {draft.endTime <= draft.startTime && (
                  <p className="-mt-2 text-xs text-amber-600">
                    Ends the following day.
                  </p>
                )}

                <Field label="Unpaid break" hint="(minutes)">
                  <input
                    type="number"
                    min={0}
                    className={FIELD}
                    value={draft.breakMinutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        breakMinutes: Number(e.target.value),
                      })
                    }
                  />
                </Field>

                <Field label="Note" hint="(optional)">
                  <textarea
                    className={FIELD}
                    rows={3}
                    value={draft.note}
                    onChange={(e) =>
                      setDraft({ ...draft, note: e.target.value })
                    }
                  />
                </Field>

                {draft.id && draft.status !== 'cancelled' && (
                  <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={cancelShift}
                      disabled={saving}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-60"
                    >
                      Cancel this shift
                    </button>
                    {/* Only a draft can be deleted — a published shift has been
                        seen by whoever is on it, so it is cancelled instead. */}
                    {draft.status === 'draft' && (
                      <button
                        type="button"
                        onClick={deleteShift}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 px-3 py-2 text-sm font-semibold text-[#b20202] hover:bg-red-50 disabled:opacity-60"
                      >
                        <PiTrash className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={saving}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202] disabled:opacity-60"
                >
                  {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add shift'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Generate */}
      <AnimatePresence>
        {generateOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !busy && setGenerateOpen(false)}
              className="fixed inset-0 z-40 bg-gray-900/30"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            >
              <h3 className="text-base font-bold text-gray-900">
                Generate {weekRangeLabel(days)}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Creates open draft shifts. Re-running tops the week up instead
                of duplicating it.
              </p>

              <div className="mt-4 space-y-2">
                {!activeTemplates.length && (
                  <p className="text-sm text-gray-500">
                    No active templates yet.{' '}
                    <Link
                      href={routes.employees.shiftTemplates}
                      className="font-semibold text-[#b20202] hover:underline"
                    >
                      Create one
                    </Link>
                    .
                  </p>
                )}
                {activeTemplates.map((t) => (
                  <label
                    key={t._id}
                    className="flex items-start gap-2.5 rounded-xl border border-gray-200 p-2.5"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#b20202] focus:ring-[#b20202]/20"
                      checked={chosenTemplates.includes(t._id)}
                      onChange={(e) =>
                        setChosenTemplates((prev) =>
                          e.target.checked
                            ? [...prev, t._id]
                            : prev.filter((id) => id !== t._id)
                        )
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        {t.name}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {templateTimeLabel(t.startTime, t.endTime, t.endDayOffset)} ·{' '}
                        {templateRepeatLabel(t)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGenerateOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy || !activeTemplates.length}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8f0202] disabled:opacity-60"
                >
                  {busy ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A shift's colour: its template's, else its role's, else neutral. */
function shiftColour(shift: Shift): string {
  const template =
    shift.template && typeof shift.template === 'object'
      ? shift.template
      : null;
  const role = shift.role && typeof shift.role === 'object' ? shift.role : null;
  return template?.color || role?.color || '#d1d5db';
}

/** The role name, or a placeholder when the ref is a bare id or dangling. */
function roleLabel(shift: Shift): string {
  const role = shift.role && typeof shift.role === 'object' ? shift.role : null;
  return role?.name ?? 'Role removed';
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'plain' | 'warn' | 'good';
}) {
  const toneClass =
    tone === 'warn'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'good'
        ? 'bg-green-50 text-green-700'
        : 'bg-gray-100 text-gray-600';
  return (
    <span className={`rounded-full px-2.5 py-1 font-semibold ${toneClass}`}>
      {label} <span className="tabular-nums">{value}</span>
    </span>
  );
}
