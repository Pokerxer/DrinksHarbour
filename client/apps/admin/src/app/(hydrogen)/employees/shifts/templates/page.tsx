'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiClockCounterClockwiseDuotone,
  PiPlus,
  PiTrash,
} from 'react-icons/pi';
import OrgConfigPage, {
  Field,
  FIELD,
} from '@/app/shared/employees/org-config-page';
import {
  buildLabelMap,
  labelFor,
} from '@/app/shared/employees/org-config-utils';
import {
  clampCycleDays,
  cycleOffsets,
  cyclePreview,
  cycleSummaryLabel,
  localToday,
  templateRepeatLabel,
  templateTimeLabel,
  toggleCycleDay,
  weekdayShort,
} from '@/app/shared/employees/shift-roster-utils';
import {
  templatePositions,
  positionLabel,
  clampPositionCount,
} from '@/app/shared/employees/shift-position-utils';
import {
  shiftTemplateService,
  DAY_LABELS,
  type ShiftTemplate,
  type ShiftTemplateInput,
} from '@/services/shift.service';
import {
  departmentService,
  employeeRoleService,
  refId,
  type Department,
  type EmployeeRole,
} from '@/services/orgStructure.service';

const EMPTY: ShiftTemplateInput = {
  name: '',
  // Superseded by `positions` below as the source of truth — kept because the
  // server still mirrors positions[0].roles[0] onto it (TEMPLATE_POPULATE,
  // ?role= filtering and the roster colour fallback all still read it).
  role: '',
  positions: [{ roles: [], count: 1 }],
  department: null,
  startTime: '09:00',
  endTime: '17:00',
  endDayOffset: 0,
  breakMinutes: 0,
  recurrence: 'weekly',
  daysOfWeek: [1, 2, 3, 4, 5],
  // Only read when recurrence is 'cycle'; one on, one off is the pattern that
  // weekday flags could not express and the reason cycles exist.
  cycleLength: 2,
  cycleDays: [0],
  anchorDate: null,
  color: '',
  note: '',
  isActive: true,
};

/** How many days of the rotation the form previews. Two full weeks makes the
 *  weekday drift of a cycle visible, which one week would hide. */
const PREVIEW_DAYS = 14;

// A template has no headcount — nobody is assigned to one — so the shared
// screen's "Headcount" sort would be a dead option.
const SORTS = [
  { value: 'name' as const, label: 'Name' },
  { value: 'recent' as const, label: 'Newest' },
];

/**
 * Shift templates — the repeating patterns a roster is generated from.
 *
 * Times are local wall clock and stay that way: "the morning shift" is 09:00
 * whatever the date. The absolute instants only exist on the generated shifts.
 */
export default function ShiftTemplatesPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const roleNames = buildLabelMap(roles);
  const deptNames = buildLabelMap(departments);

  // ── C2 guard: an untouched legacy template must stay legacy ────────────────
  //
  // `templatePositions` synthesizes `{_id: null, roles: [role], count: 1}` for
  // a legacy template so the editor can open it uniformly. If that synthesized
  // position round-trips back to the server as `positions: [{roles, count}]`
  // (no `_id`, because there never was one), buildShiftTemplatePayload sees a
  // real `positions` array and stores it — minting a fresh `_id` for the
  // position since none was sent. That `_id` is the generation idempotency
  // key (see keyOf in shift.helpers.js): every day already generated under
  // the OLD key (`template@start@`, from `templatePosition: null`) is now
  // orphaned, and the next generate writes a second full crew on top of it.
  //
  // So `positions` is sent on an update ONLY when the template already had
  // real declared positions (round-tripping their `_id`s keeps working
  // exactly as before), OR the admin actually edited the positions list this
  // session. Merely opening the editor and saving something else (break
  // minutes, colour, name) must not silently convert a legacy template.
  const originalHasPositionsRef = useRef(false);
  const positionsTouchedRef = useRef(false);
  function markPositionsTouched() {
    positionsTouchedRef.current = true;
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      employeeRoleService.list(token),
      departmentService.list(token),
    ])
      .then(([r, d]) => {
        if (cancelled) return;
        setRoles(r);
        setDepartments(d);
      })
      .catch(() => {
        if (cancelled) return;
        setRoles([]);
        setDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function toggleDay(draft: ShiftTemplateInput, day: number): number[] {
    const days = draft.daysOfWeek ?? [];
    return days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day].sort((a, b) => a - b);
  }

  function toggleRole(roles: string[], id: string): string[] {
    return roles.includes(id) ? roles.filter((r) => r !== id) : [...roles, id];
  }

  return (
    <OrgConfigPage<ShiftTemplate, ShiftTemplateInput>
      title="Shift templates"
      subtitle="Repeating patterns the weekly roster is generated from."
      icon={<PiClockCounterClockwiseDuotone />}
      noun="template"
      service={{
        ...shiftTemplateService,
        // See the C2 guard comment above `originalHasPositionsRef`. Only this
        // wrapped `update` decides whether `positions` rides along; `create`
        // is untouched — a brand-new template always has positions to send.
        update: (id, input, token) => {
          const keepPositions =
            originalHasPositionsRef.current || positionsTouchedRef.current;
          if (keepPositions) return shiftTemplateService.update(id, input, token);
          const { positions: _omit, ...withoutPositions } = input;
          return shiftTemplateService.update(id, withoutPositions, token);
        },
      }}
      emptyDraft={EMPTY}
      sorts={SORTS}
      toDraft={(t) => {
        // A fresh edit session: the touch tracker starts clean, and whether
        // this template already had real crew positions is fixed for the
        // whole session (re-crewing it mid-session is itself "touched").
        originalHasPositionsRef.current =
          Array.isArray(t.positions) && t.positions.length > 0;
        positionsTouchedRef.current = false;
        return {
          name: t.name,
          role: refId(t.role),
          // The normaliser turns a legacy single-role template into one position
          // so it opens the same way a template already using positions does.
          positions: templatePositions(t).map((p) => ({
            _id: p._id ?? undefined,
            roles: p.roles,
            count: p.count,
          })),
          department: refId(t.department) || null,
          startTime: t.startTime,
          endTime: t.endTime,
          endDayOffset: t.endDayOffset ?? 0,
          breakMinutes: t.breakMinutes,
          recurrence: t.recurrence ?? 'weekly',
          daysOfWeek: t.daysOfWeek ?? [],
          // A weekly template has no stored cycle, so the form falls back to
          // the same starting rotation a new template offers.
          cycleLength: t.cycleLength ?? 2,
          cycleDays: t.cycleDays?.length ? t.cycleDays : [0],
          anchorDate: t.anchorDate ?? null,
          color: t.color ?? '',
          note: t.note ?? '',
          isActive: t.isActive,
        };
      }}
      describeDelete={(t) =>
        t.shiftCount > 0
          ? `${t.shiftCount} upcoming ${
              t.shiftCount === 1 ? 'shift was' : 'shifts were'
            } generated from this template. Deleting will be refused — deactivate it instead.`
          : 'This cannot be undone. Deactivate it instead if you may need it later.'
      }
      columns={[
        {
          header: 'Template',
          render: (t) => (
            <div className="flex items-center gap-2.5">
              <span
                className="h-6 w-1.5 shrink-0 rounded-full"
                style={{ background: t.color || '#e5e7eb' }}
              />
              <div>
                <span className="font-semibold text-gray-900">{t.name}</span>
                <p className="text-xs text-gray-400">
                  {templateRepeatLabel(t)}
                  {t.recurrence === 'cycle' && t.anchorDate && (
                    <span className="text-gray-300"> · from {t.anchorDate}</span>
                  )}
                </p>
              </div>
            </div>
          ),
        },
        {
          header: 'Hours',
          render: (t) => (
            <span className="tabular-nums text-gray-600">
              {templateTimeLabel(t.startTime, t.endTime, t.endDayOffset)}
              {t.breakMinutes > 0 && (
                <span className="ml-1 text-xs text-gray-400">
                  · {t.breakMinutes}m break
                </span>
              )}
            </span>
          ),
        },
        {
          header: 'Positions',
          render: (t) =>
            templatePositions(t)
              .map((p) => positionLabel(p, roleNames))
              .join(', '),
        },
        {
          header: 'Department',
          render: (t) => labelFor(refId(t.department), deptNames),
        },
        {
          header: 'Upcoming',
          render: (t) => (
            <span className="font-semibold tabular-nums text-gray-900">
              {t.shiftCount}
            </span>
          ),
        },
        {
          header: 'Status',
          render: (t) => (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                t.isActive
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {t.isActive ? 'Active' : 'Inactive'}
            </span>
          ),
        },
      ]}
      renderForm={(draft, patch) => (
        <>
          <Field label="Template name">
            <input
              className={FIELD}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Weekday morning bar"
            />
          </Field>

          <Field label="Positions this shift needs">
            <div className="space-y-2">
              {(draft.positions ?? []).map((pos, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((r) => {
                      const on = pos.roles.includes(r._id);
                      return (
                        <button
                          key={r._id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            markPositionsTouched();
                            patch({
                              positions: (draft.positions ?? []).map((p, j) =>
                                j === i
                                  ? { ...p, roles: toggleRole(p.roles, r._id) }
                                  : p
                              ),
                            });
                          }}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            on
                              ? 'bg-[#b20202] text-white'
                              : 'border border-gray-200 bg-white text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                      Needed
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                        value={pos.count}
                        onChange={(e) => {
                          markPositionsTouched();
                          const count = clampPositionCount(e.target.value);
                          patch({
                            positions: (draft.positions ?? []).map((p, j) =>
                              j === i ? { ...p, count } : p
                            ),
                          });
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={(draft.positions ?? []).length === 1}
                      onClick={() => {
                        // Guarded in state as well as by `disabled`: a template
                        // with no positions has nothing to generate, and the
                        // disabled attribute is one refactor away from gone.
                        const positions = draft.positions ?? [];
                        if (positions.length <= 1) return;
                        markPositionsTouched();
                        patch({ positions: positions.filter((_, j) => j !== i) });
                      }}
                      title="Remove position"
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                    >
                      <PiTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  markPositionsTouched();
                  patch({
                    positions: [
                      ...(draft.positions ?? []),
                      { roles: [], count: 1 },
                    ],
                  });
                }}
                className="flex items-center gap-1 text-xs font-semibold text-[#b20202] hover:underline"
              >
                <PiPlus className="h-3.5 w-3.5" /> Add a position
              </button>
              <p className="text-xs text-gray-400">
                Pick every role that can cover a position — someone holding
                any of them qualifies. The first one picked is shown on the
                roster.
              </p>
            </div>
          </Field>

          <Field label="Department" hint="(optional)">
            <select
              className={FIELD}
              value={draft.department ?? ''}
              onChange={(e) => patch({ department: e.target.value || null })}
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input
                type="time"
                className={FIELD}
                value={draft.startTime}
                onChange={(e) => patch({ startTime: e.target.value })}
              />
            </Field>
            <Field label="Ends">
              <input
                type="time"
                className={FIELD}
                value={draft.endTime}
                onChange={(e) => patch({ endTime: e.target.value })}
              />
            </Field>
          </div>
          <Field label="End day">
            <select
              className={FIELD}
              value={draft.endDayOffset ?? 0}
              onChange={(e) => patch({ endDayOffset: Number(e.target.value) })}
            >
              <option value={0}>Same day</option>
              <option value={1}>Next day</option>
              <option value={2}>2 days later</option>
            </select>
          </Field>
          {(draft.endDayOffset ?? 0) > 0 ? (
            <p className="-mt-2 text-xs text-amber-600">
              This shift ends on a different calendar day ({(draft.endDayOffset ?? 0)} day{(draft.endDayOffset ?? 0) > 1 ? 's' : ''} later).
            </p>
          ) : draft.endTime <= draft.startTime && (
            <p className="-mt-2 text-xs text-amber-600">
              This shift runs past midnight and ends the following day.
            </p>
          )}

          <Field label="Unpaid break" hint="(minutes)">
            <input
              type="number"
              min={0}
              className={FIELD}
              value={draft.breakMinutes ?? 0}
              onChange={(e) => patch({ breakMinutes: Number(e.target.value) })}
            />
          </Field>

          <Field label="Repeats">
            <div className="flex gap-1.5">
              {(
                [
                  ['weekly', 'On weekdays'],
                  ['cycle', 'On a rotation'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={(draft.recurrence ?? 'weekly') === value}
                  onClick={() =>
                    patch({
                      recurrence: value,
                      // A rotation cannot be generated without an anchor, so one
                      // is offered the moment the admin asks for a rotation.
                      ...(value === 'cycle' && !draft.anchorDate
                        ? { anchorDate: localToday() }
                        : {}),
                    })
                  }
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    (draft.recurrence ?? 'weekly') === value
                      ? 'bg-[#b20202] text-white'
                      : 'border border-gray-200 bg-white text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {(draft.recurrence ?? 'weekly') === 'weekly' ? (
            <Field label="Repeats on">
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, day) => {
                  const on = (draft.daysOfWeek ?? []).includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => patch({ daysOfWeek: toggleDay(draft, day) })}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        on
                          ? 'bg-[#b20202] text-white'
                          : 'border border-gray-200 bg-white text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : (
            <>
              <Field
                label="Cycle length"
                hint="(days before the pattern repeats)"
              >
                <input
                  type="number"
                  min={1}
                  max={31}
                  className={FIELD}
                  value={draft.cycleLength ?? 2}
                  onChange={(e) => {
                    const length = Number(e.target.value);
                    patch({
                      cycleLength: length,
                      // Offsets the shorter cycle no longer has would be
                      // rejected by the server as outside it.
                      cycleDays: clampCycleDays(draft.cycleDays, length),
                    });
                  }}
                />
              </Field>

              <Field label="Days worked in the cycle">
                <div className="flex flex-wrap gap-1.5">
                  {cycleOffsets(draft.cycleLength).map((offset) => {
                    const on = (draft.cycleDays ?? []).includes(offset);
                    return (
                      <button
                        key={offset}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          patch({
                            cycleDays: toggleCycleDay(draft.cycleDays, offset),
                          })
                        }
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                          on
                            ? 'bg-[#b20202] text-white'
                            : 'border border-gray-200 bg-white text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {offset + 1}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  {cycleSummaryLabel(draft.cycleLength, draft.cycleDays)}
                </p>
              </Field>

              <Field
                label="Cycle starts on"
                hint="(day 1 of the rotation)"
              >
                <input
                  type="date"
                  className={FIELD}
                  value={draft.anchorDate ?? ''}
                  onChange={(e) => patch({ anchorDate: e.target.value || null })}
                />
              </Field>

              {/* A rotation is hard to picture and a wrong anchor is invisible
                  until the roster is generated — by which point it has invented
                  absences on days nobody was meant to work. */}
              <Field label={`Next ${PREVIEW_DAYS} days`}>
                {(() => {
                  const preview = cyclePreview(
                    {
                      cycleLength: draft.cycleLength,
                      cycleDays: draft.cycleDays,
                      anchorDate: draft.anchorDate,
                    },
                    localToday(),
                    PREVIEW_DAYS
                  );
                  if (!preview.length) {
                    return (
                      <p className="text-xs text-amber-600">
                        Pick a start date and at least one worked day to see the
                        rotation.
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      {preview.map((d) => (
                        <span
                          key={d.date}
                          title={d.date}
                          className={`rounded-md px-1.5 py-1 text-[11px] font-semibold tabular-nums ${
                            d.worked
                              ? 'bg-[#b20202]/10 text-[#b20202]'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {weekdayShort(d.date)} {d.date.slice(8)}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </Field>
            </>
          )}

          <Field label="Colour" hint="(used on the roster)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-gray-200"
                value={draft.color || '#b20202'}
                onChange={(e) => patch({ color: e.target.value })}
              />
              <input
                className={FIELD}
                value={draft.color ?? ''}
                onChange={(e) => patch({ color: e.target.value })}
                placeholder="#b20202"
              />
            </div>
          </Field>

          <Field label="Note" hint="(optional)">
            <textarea
              className={FIELD}
              rows={3}
              value={draft.note ?? ''}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-[#b20202] focus:ring-[#b20202]/20"
              checked={draft.isActive !== false}
              onChange={(e) => patch({ isActive: e.target.checked })}
            />
            Active
          </label>
        </>
      )}
      validate={(d) => {
        if (!d.positions?.length)
          return 'Add at least one position this shift needs';
        if (d.positions.some((p) => !p.roles.length)) {
          return 'Every position needs at least one role that can cover it';
        }
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(d.startTime))
          return 'Start time must be like 09:00';
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(d.endTime))
          return 'End time must be like 17:00';
        if ((d.recurrence ?? 'weekly') === 'cycle') {
          const length = Number(d.cycleLength);
          if (!Number.isInteger(length) || length < 1)
            return 'A cycle must be at least one day long';
          if (!(d.cycleDays ?? []).length)
            return 'Pick at least one worked day — a cycle with none generates nothing';
          // Without an anchor the phase would have to be guessed from whatever
          // range is generated, and March and April would disagree.
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d.anchorDate ?? ''))
            return 'Choose the date the cycle starts on';
        } else if (!(d.daysOfWeek ?? []).length)
          return 'Pick at least one day — a template with none generates nothing';
        if (d.color && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(d.color)) {
          return 'Colour must be a hex value like #b20202';
        }
        return null;
      }}
    />
  );
}
