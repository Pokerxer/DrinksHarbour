'use client';

// The entry / correction drawer, shared by the attendance log
// (`/employees/attendance`) and an employee's history
// (`/employees/attendance/[employeeId]`). One copy, two screens, because two
// copies of the save rule are two places a time zone bug can live.
//
// Controlled: the page owns the `draft` and this only edits fields (through
// `onChange`) and saves (through the service). `save` lives here so both pages
// cannot drift on the local-time↔UTC conversion, the create-vs-update branch,
// or the words that validation uses.
//
// The server stamps `editedBy` on every PATCH, so a correction made here never
// loses its author.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { PiX } from 'react-icons/pi';
import { LAGOS_OFFSET_MINUTES, toLocalDateKey } from './shift-roster-utils';
import {
  entryUtcTimes,
  impliedEndDate,
  isEntryRangeValid,
  recordTimes,
} from './attendance-utils';
import {
  attendanceService,
  type AttendanceRecord,
} from '@/services/attendance.service';
import { refId } from '@/services/orgStructure.service';

const OFFSET = LAGOS_OFFSET_MINUTES;

/** Anyone the picker can name — the API's Employee and a populated ref fit. */
export type EmployeeLike = {
  _id: string;
  firstName?: string;
  lastName?: string;
};

/**
 * One manual entry or correction, in the tenant's wall clock.
 *
 * BOTH ENDS CARRY THEIR OWN DATE. A single date with an "ends the next day if
 * the out is earlier" rule cannot express a shift spanning more than one night,
 * and silently rewrites one that does — see `entryUtcTimes`.
 *
 * `outTime` empty means the record stays (or becomes) open — a real
 * instruction, not "unchanged".
 */
export interface AttendanceDraft {
  /** Null = a fresh manual entry; set = a correction of an existing record. */
  id: string | null;
  employee: string;
  /** Display only — the person is fixed on a correction, so never re-asked. */
  employeeName: string;
  /** 'YYYY-MM-DD' — the day the clock-in falls on. */
  startDate: string;
  /** 'HH:MM'. */
  inTime: string;
  /** 'YYYY-MM-DD' — the day the clock-out falls on. Unused while open. */
  endDate: string;
  /** 'HH:MM', or '' to leave the record open. */
  outTime: string;
  note: string;
  /** A kiosk punch may be corrected but never deleted. */
  source: AttendanceRecord['source'];
}

/** The blank form, seeded to today (whichever day is in view). */
export const NEW_ATTENDANCE_DRAFT = (date: string): AttendanceDraft => ({
  id: null,
  employee: '',
  employeeName: '',
  startDate: date,
  inTime: '09:00',
  endDate: date,
  outTime: '',
  note: '',
  source: 'admin',
});

/**
 * Seed a draft from an existing record.
 *
 * Each end is read from its OWN stored instant rather than derived from the
 * other, so a record that ran across one night — or three — round-trips
 * unchanged when an admin opens it and saves without touching the times.
 */
export function draftFromRecord(
  record: AttendanceRecord,
  employeeName: string,
  offsetMinutes = OFFSET
): AttendanceDraft {
  const times = recordTimes(record, offsetMinutes);
  return {
    id: record._id,
    employee: refId(record.employee),
    employeeName,
    startDate: toLocalDateKey(record.clockIn, offsetMinutes),
    inTime: times.in,
    endDate: record.clockOut
      ? toLocalDateKey(record.clockOut, offsetMinutes)
      : toLocalDateKey(record.clockIn, offsetMinutes),
    outTime: record.clockOut ? times.out : '',
    note: record.note ?? '',
    source: record.source,
  };
}

interface Props {
  draft: AttendanceDraft | null;
  /** Options for the employee picker — only read while ADDING, not correcting. */
  employees: EmployeeLike[];
  token: string;
  onChange: (next: AttendanceDraft) => void;
  onClose: () => void;
  /** Runs after a save lands, so the page can reload its data. */
  onSaved: () => void;
}

const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

const MS_PER_DAY = 86_400_000;

/**
 * "1 night" / "3 nights" — how far apart the two dates are.
 *
 * Shown rather than hidden because a multi-day record is almost always a
 * forgotten clock-out, and the number is the fastest way to see that at a
 * glance. Empty when the dates cannot be read; the caller only renders it when
 * the end is already known to be later than the start.
 */
function spanNights(startDate: string, endDate: string): string {
  const a = Date.parse(`${startDate}T00:00:00.000Z`);
  const b = Date.parse(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return '';
  const nights = Math.round((b - a) / MS_PER_DAY);
  return `${nights} night${nights === 1 ? '' : 's'}`;
}

/** A labelled form control. Local copy — see the note at the top of the file. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function AttendanceCorrectionDrawer({
  draft,
  employees,
  token,
  onChange,
  onClose,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    if (!draft.employee) return toast.error('Choose whose record this is');

    const { clockIn, clockOut } = entryUtcTimes(draft, OFFSET);
    if (!clockIn) return toast.error('Enter a clock-in time like 09:00');

    // An unparseable out time yields '', while a blank one yields null — only
    // the former is a mistake.
    if (draft.outTime && !clockOut)
      return toast.error('Enter a clock-out time like 17:00');

    // An overnight or multi-night shift can no longer be expressed with a single
    // date, so the rule is the same as the server's: clock-out must be strictly
    // after clock-in. Both dates are drawn from the stored record, so this
    // trips only when the admin moved one end and left the other behind.
    if (draft.outTime && !isEntryRangeValid(draft))
      return toast.error('Clock-out must be after clock-in');

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
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {draft && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                onClick={onClose}
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
                {draft.id ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                    {draft.employeeName || 'This employee'}
                  </p>
                ) : (
                  <select
                    className={FIELD}
                    value={draft.employee}
                    onChange={(e) =>
                      onChange({ ...draft, employee: e.target.value })
                    }
                  >
                    <option value="">Choose someone…</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() ||
                          e._id}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {/* Each end owns its date, so a night shift — or one that ran
                  across several days — states plainly when it started and when
                  it finished, instead of being inferred from the two times. */}
              <fieldset className="rounded-xl border border-gray-200 p-3">
                <legend className="px-1 text-xs font-bold uppercase tracking-wider text-gray-400">
                  Clocked in
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <input
                      type="date"
                      className={FIELD}
                      value={draft.startDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        onChange({
                          ...draft,
                          startDate,
                          // A closed record keeps whatever end date it has —
                          // moving the start must not silently drag the end
                          // with it. Only a still-open one has no end to keep.
                          endDate: draft.outTime ? draft.endDate : startDate,
                        });
                      }}
                    />
                  </Field>
                  <Field label="Time">
                    <input
                      type="time"
                      className={FIELD}
                      value={draft.inTime}
                      onChange={(e) =>
                        onChange({ ...draft, inTime: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="rounded-xl border border-gray-200 p-3">
                <legend className="px-1 text-xs font-bold uppercase tracking-wider text-gray-400">
                  Clocked out{' '}
                  <span className="font-normal normal-case tracking-normal text-gray-400">
                    (leave the time blank if still in)
                  </span>
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <input
                      type="date"
                      className={FIELD}
                      value={draft.endDate}
                      min={draft.startDate}
                      // Nothing to place while the record is open; re-enabled
                      // the moment a time is typed.
                      disabled={!draft.outTime}
                      onChange={(e) =>
                        onChange({ ...draft, endDate: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Time">
                    <input
                      type="time"
                      className={FIELD}
                      value={draft.outTime}
                      onChange={(e) => {
                        const outTime = e.target.value;
                        onChange({
                          ...draft,
                          outTime,
                          // Typing the first out time on a record that had none
                          // guesses the day from the two times, the way the old
                          // single-date form did. Once a date is on screen the
                          // admin owns it and it is never moved again.
                          endDate: draft.outTime
                            ? draft.endDate
                            : impliedEndDate(
                                draft.startDate,
                                draft.inTime,
                                outTime
                              ),
                        });
                      }}
                    />
                  </Field>
                </div>
              </fieldset>

              {draft.outTime !== '' && draft.endDate > draft.startDate && (
                <p className="-mt-2 text-xs text-gray-500">
                  This record spans{' '}
                  {spanNights(draft.startDate, draft.endDate)}.
                </p>
              )}
              {draft.outTime !== '' && !isEntryRangeValid(draft) && (
                <p className="-mt-2 text-xs text-rose-600">
                  Clock-out must be after clock-in.
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
                  onChange={(e) => onChange({ ...draft, note: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || (draft.outTime !== '' && !isEntryRangeValid(draft))}
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
  );
}