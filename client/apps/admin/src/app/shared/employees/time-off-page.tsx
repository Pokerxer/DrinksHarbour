'use client';

// Time off — `/employees/time-off`.
//
// One screen doing two jobs, because they are the same list seen from two
// sides: an employee's own requests, and a manager's queue of what needs
// answering. The server decides which one you get — `canDecide` on the list
// response — so this page never has to guess at a role, and a staff member
// opening it sees their own rows rather than a 403.
//
// Three things this screen is careful about:
//
//  1. It never renders `endDate` directly. The stored window is HALF-OPEN, so
//     the raw end is the instant the leave finishes — a day the person is back
//     at work. `requestDayLabel` is the only thing that formats these.
//  2. A half day says which half. 'Mon 10 Aug, morning' and '½ day', never a
//     row that reads exactly like a whole day off.
//  3. Approving over shifts the person is already rostered on SUCCEEDS, and the
//     shifts come back as a warning. They are shown, at length, with a link to
//     the roster — the decision was right and the roster is what has to change,
//     but nobody may find that out on the day.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiArrowsClockwise,
  PiCalendarPlusDuotone,
  PiCheck,
  PiPlus,
  PiProhibit,
  PiUmbrellaDuotone,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import { FIELD, Field } from './org-config-page';
import { LAGOS_OFFSET_MINUTES, localToday } from './shift-roster-utils';
import {
  daysLabel,
  groupTimeOff,
  requestDayLabel,
  summariseTimeOff,
  timeOffActions,
  timeOffStatusTone,
  timeOffTypeLabel,
  type RequestAction,
} from './time-off-utils';
import {
  timeOffService,
  TIME_OFF_TYPES,
  TIME_OFF_STATUSES,
  TimeOffConflictError,
  type DecisionWarning,
  type HalfDayPart,
  type TimeOffRequest,
  type TimeOffStatus,
  type TimeOffType,
} from '@/services/timeOff.service';
import { employeeService, type Employee } from '@/services/employee.service';
import { refId } from '@/services/orgStructure.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

interface RequestDraft {
  employee: string;
  type: TimeOffType;
  from: string;
  to: string;
  halfDay: HalfDayPart;
  reason: string;
}

const NEW_DRAFT = (today: string): RequestDraft => ({
  employee: '',
  type: 'annual',
  from: today,
  to: today,
  halfDay: 'none',
  reason: '',
});

const ACTION_CLASS: Record<RequestAction['tone'], string> = {
  primary:
    'bg-[#b20202] text-white hover:bg-[#8f0202] disabled:opacity-60',
  danger:
    'border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60',
  quiet:
    'border border-gray-200 text-gray-600 hover:text-gray-900 disabled:opacity-60',
};

export default function TimeOffPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const today = useMemo(() => localToday(OFFSET), []);

  const [items, setItems] = useState<TimeOffRequest[]>([]);
  const [canDecide, setCanDecide] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<TimeOffStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<DecisionWarning[]>([]);

  const myId = String(
    (session?.user as { id?: string; _id?: string })?.id ??
      (session?.user as { _id?: string })?._id ??
      ''
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await timeOffService.list(
        { status: statusFilter || undefined },
        token
      );
      setItems(data.items);
      setCanDecide(Boolean(data.canDecide));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load time off');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only an admin can file on somebody's behalf, so the list is only fetched
  // for one — and a staff caller would be refused it anyway.
  useEffect(() => {
    if (!token || !canDecide) return;
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
  }, [token, canDecide]);

  const groups = useMemo(
    () => groupTimeOff(items, { today, offsetMinutes: OFFSET }),
    [items, today]
  );
  const summary = useMemo(() => summariseTimeOff(items), [items]);

  async function file() {
    if (!draft) return;
    if (!draft.from) return toast.error('Choose a first day');
    if (draft.halfDay !== 'none' && draft.to !== draft.from) {
      return toast.error('A half day can only be taken on a single day');
    }

    setSaving(true);
    try {
      await timeOffService.create(
        {
          employee: draft.employee || undefined,
          type: draft.type,
          from: draft.from,
          to: draft.to || draft.from,
          halfDay: draft.halfDay,
          reason: draft.reason,
        },
        token
      );
      toast.success('Request filed');
      setDraft(null);
      await load();
    } catch (err) {
      // An overlapping request is the common refusal and deserves its own
      // sentence — "failed" would leave somebody re-filing the same days.
      if (err instanceof TimeOffConflictError) toast.error(err.message);
      else toast.error(err instanceof Error ? err.message : 'Could not file it');
    } finally {
      setSaving(false);
    }
  }

  async function act(request: TimeOffRequest, action: RequestAction) {
    setBusyId(request._id);
    setWarnings([]);
    try {
      if (action.action === 'cancel') {
        await timeOffService.cancel(request._id, token);
        toast.success('Request cancelled');
      } else if (action.action === 'approve' || action.action === 'reject') {
        const res = await timeOffService.decide(
          request._id,
          action.action,
          token
        );
        toast.success(action.action === 'approve' ? 'Approved' : 'Rejected');
        // Kept on screen rather than toasted: a toast for "four shifts need
        // re-rostering" disappears before anybody can act on it.
        if (res.warnings.length) setWarnings(res.warnings);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not do that');
    } finally {
      setBusyId(null);
    }
  }

  const stats = [
    { label: 'Waiting', value: String(summary.pending) },
    { label: 'Approved', value: String(summary.approved) },
    { label: 'Days booked', value: daysLabel(summary.approvedDays) },
  ];

  return (
    <div className="px-4 py-6 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202] text-white [&>svg]:h-5 [&>svg]:w-5">
            <PiUmbrellaDuotone />
          </span>
          <div>
            <h1
              className={`${fraunces.className} text-2xl font-black text-gray-900`}
            >
              Time off
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {canDecide
                ? 'Requests to answer, and everything already booked.'
                : 'Your requests, and where each one has got to.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.employees.swaps}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
          >
            Shift swaps
          </Link>
          <button
            type="button"
            onClick={() => setDraft(NEW_DRAFT(today))}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
          >
            <PiPlus className="h-4 w-4" />
            Request time off
          </button>
        </div>
      </div>

      {/* Filters + headline numbers */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TimeOffStatus | '')}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">Every status</option>
          {TIME_OFF_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
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

        <div className="ml-auto flex flex-wrap items-center gap-4">
          {stats.map((s) => (
            <div key={s.label} className="text-right">
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

      {/* What the last approval collided with. Approving was still right — the
          roster is the thing that has to change — so this is a to-do, not an
          error, and it stays put until it is dismissed. */}
      {warnings.map((w) => (
        <div
          key={w.code}
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <PiWarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">{w.message}</p>
              <p className="mt-0.5 text-xs text-amber-800">
                The leave is approved. Those shifts are still assigned and need
                re-rostering or cancelling.
              </p>
              <Link
                href={routes.employees.shifts}
                className="mt-1 inline-block text-xs font-semibold text-amber-900 underline"
              >
                Open the roster
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setWarnings([])}
              aria-label="Dismiss"
              className="rounded-lg p-1 text-amber-700 hover:bg-amber-100"
            >
              <PiX className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {/* The list */}
      {loading && (
        <p className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-400">
          Loading…
        </p>
      )}

      {!loading && !items.length && (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-14 text-center">
          <PiCalendarPlusDuotone className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-500">
            Nothing here yet
          </p>
          <button
            type="button"
            onClick={() => setDraft(NEW_DRAFT(today))}
            className="mt-2 text-sm font-semibold text-[#b20202] hover:underline"
          >
            Request time off
          </button>
        </div>
      )}

      {!loading &&
        !!items.length &&
        groups.map((group) => (
          <section key={group.key} className="mb-6">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {group.title}
              <span className="ml-2 font-semibold text-gray-300">
                {group.items.length}
              </span>
            </h2>

            {!group.items.length ? (
              <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-xs text-gray-400">
                Nothing in this group.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Length</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => {
                      const isMine = refId(item.employee) === myId;
                      const actions = timeOffActions(item, {
                        canDecide,
                        isMine,
                      });
                      const person =
                        item.employee && typeof item.employee !== 'string'
                          ? `${item.employee.firstName ?? ''} ${item.employee.lastName ?? ''}`.trim()
                          : 'Unknown';
                      return (
                        <tr
                          key={item._id}
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="px-4 py-3">
                            <span className="font-semibold text-gray-900">
                              {person || 'Unknown'}
                            </span>
                            {item.reason && (
                              <p className="text-xs text-gray-400">
                                {item.reason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {requestDayLabel(item, OFFSET)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-gray-600">
                            {daysLabel(item.days)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {timeOffTypeLabel(item.type)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${timeOffStatusTone(
                                item.status
                              )}`}
                            >
                              {item.status[0].toUpperCase() +
                                item.status.slice(1)}
                            </span>
                            {item.decisionNote && (
                              <p className="mt-0.5 text-[11px] text-gray-400">
                                {item.decisionNote}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {!actions.length && (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                              {actions.map((a) => (
                                <button
                                  key={a.action}
                                  type="button"
                                  disabled={busyId === item._id}
                                  onClick={() => void act(item, a)}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${ACTION_CLASS[a.tone]}`}
                                >
                                  {a.action === 'approve' && (
                                    <PiCheck className="h-3.5 w-3.5" />
                                  )}
                                  {a.action === 'reject' && (
                                    <PiProhibit className="h-3.5 w-3.5" />
                                  )}
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

      {/* Request drawer */}
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
                  Request time off
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
                {canDecide && (
                  <Field label="Who is it for" hint="(leave blank for yourself)">
                    <select
                      className={FIELD}
                      value={draft.employee}
                      onChange={(e) =>
                        setDraft({ ...draft, employee: e.target.value })
                      }
                    >
                      <option value="">Me</option>
                      {employees.map((e) => (
                        <option key={e._id} value={e._id}>
                          {e.firstName} {e.lastName}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Type">
                  <select
                    className={FIELD}
                    value={draft.type}
                    onChange={(e) =>
                      setDraft({ ...draft, type: e.target.value as TimeOffType })
                    }
                  >
                    {TIME_OFF_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {timeOffTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="First day">
                    <input
                      type="date"
                      className={FIELD}
                      value={draft.from}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          from: e.target.value,
                          // Keep the range sane rather than sending a `to`
                          // before the `from` and being refused for it.
                          to:
                            draft.to && draft.to >= e.target.value
                              ? draft.to
                              : e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Last day">
                    <input
                      type="date"
                      className={FIELD}
                      min={draft.from}
                      disabled={draft.halfDay !== 'none'}
                      value={draft.to}
                      onChange={(e) =>
                        setDraft({ ...draft, to: e.target.value })
                      }
                    />
                  </Field>
                </div>

                <Field
                  label="Half day"
                  hint="(one day only — the other half stays workable)"
                >
                  <select
                    className={FIELD}
                    value={draft.halfDay}
                    onChange={(e) => {
                      const halfDay = e.target.value as HalfDayPart;
                      setDraft({
                        ...draft,
                        halfDay,
                        to: halfDay === 'none' ? draft.to : draft.from,
                      });
                    }}
                  >
                    <option value="none">The whole day</option>
                    <option value="am">Morning only</option>
                    <option value="pm">Afternoon only</option>
                  </select>
                </Field>

                <Field label="Reason" hint="(optional)">
                  <textarea
                    className={FIELD}
                    rows={3}
                    value={draft.reason}
                    onChange={(e) =>
                      setDraft({ ...draft, reason: e.target.value })
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
                  onClick={() => void file()}
                  disabled={saving}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8f0202] disabled:opacity-60"
                >
                  {saving ? 'Filing…' : 'File request'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
