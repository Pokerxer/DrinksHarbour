'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiClockCounterClockwiseDuotone } from 'react-icons/pi';
import OrgConfigPage, {
  Field,
  FIELD,
} from '@/app/shared/employees/org-config-page';
import {
  buildLabelMap,
  labelFor,
} from '@/app/shared/employees/org-config-utils';
import {
  templateDaysLabel,
  templateTimeLabel,
} from '@/app/shared/employees/shift-roster-utils';
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
  role: '',
  department: null,
  startTime: '09:00',
  endTime: '17:00',
  endDayOffset: 0,
  breakMinutes: 0,
  daysOfWeek: [1, 2, 3, 4, 5],
  color: '',
  note: '',
  isActive: true,
};

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

  return (
    <OrgConfigPage<ShiftTemplate, ShiftTemplateInput>
      title="Shift templates"
      subtitle="Repeating patterns the weekly roster is generated from."
      icon={<PiClockCounterClockwiseDuotone />}
      noun="template"
      service={shiftTemplateService}
      emptyDraft={EMPTY}
      sorts={SORTS}
      toDraft={(t) => ({
        name: t.name,
        role: refId(t.role),
        department: refId(t.department) || null,
        startTime: t.startTime,
        endTime: t.endTime,
        endDayOffset: t.endDayOffset ?? 0,
        breakMinutes: t.breakMinutes,
        daysOfWeek: t.daysOfWeek ?? [],
        color: t.color ?? '',
        note: t.note ?? '',
        isActive: t.isActive,
      })}
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
                  {templateDaysLabel(t.daysOfWeek)}
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
        { header: 'Role', render: (t) => labelFor(refId(t.role), roleNames) },
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

          <Field label="Role required">
            <select
              className={FIELD}
              value={draft.role}
              onChange={(e) => patch({ role: e.target.value })}
            >
              <option value="">Choose a role…</option>
              {roles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
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
        if (!d.role) return 'Choose the role this shift requires';
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(d.startTime))
          return 'Start time must be like 09:00';
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(d.endTime))
          return 'End time must be like 17:00';
        if (!(d.daysOfWeek ?? []).length)
          return 'Pick at least one day — a template with none generates nothing';
        if (d.color && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(d.color)) {
          return 'Colour must be a hex value like #b20202';
        }
        return null;
      }}
    />
  );
}
