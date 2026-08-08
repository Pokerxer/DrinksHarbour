'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiBriefcaseDuotone } from 'react-icons/pi';
import OrgConfigPage, {
  Field,
  FIELD,
} from '@/app/shared/employees/org-config-page';
import {
  buildLabelMap,
  headcountStatus,
  labelFor,
} from '@/app/shared/employees/org-config-utils';
import {
  jobPositionService,
  departmentService,
  refId,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  type JobPosition,
  type JobPositionInput,
  type Department,
} from '@/services/orgStructure.service';

const EMPTY: JobPositionInput = {
  name: '',
  department: null,
  employmentType: 'full_time',
  expectedHeadcount: 0,
  description: '',
  requirements: '',
  isActive: true,
};

const TONE_CLASS: Record<string, string> = {
  unset: 'text-gray-600',
  under: 'text-amber-600',
  over: 'text-blue-600',
  met: 'text-green-700',
};

export default function JobPositionsPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [departments, setDepartments] = useState<Department[]>([]);
  const deptNames = buildLabelMap(departments);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    departmentService
      .list(token)
      .then((rows) => !cancelled && setDepartments(rows))
      .catch(() => !cancelled && setDepartments([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <OrgConfigPage<JobPosition, JobPositionInput>
      title="Job positions"
      subtitle="Posts within a department. An employee's job title is their own wording for the post they hold."
      icon={<PiBriefcaseDuotone />}
      noun="position"
      service={jobPositionService}
      emptyDraft={EMPTY}
      toDraft={(p) => ({
        name: p.name,
        department: refId(p.department) || null,
        employmentType: p.employmentType,
        expectedHeadcount: p.expectedHeadcount,
        description: p.description ?? '',
        requirements: p.requirements ?? '',
        isActive: p.isActive,
      })}
      columns={[
        {
          header: 'Position',
          render: (p) => (
            <span className="font-semibold text-gray-900">{p.name}</span>
          ),
        },
        {
          header: 'Department',
          render: (p) => (
            <span className="text-gray-600">
              {labelFor(refId(p.department), deptNames)}
            </span>
          ),
        },
        {
          header: 'Type',
          render: (p) => (
            <span className="text-gray-600">
              {EMPLOYMENT_TYPE_LABELS[p.employmentType]}
            </span>
          ),
        },
        {
          header: 'Headcount',
          render: (p) => {
            const s = headcountStatus(p.employeeCount, p.expectedHeadcount);
            return (
              <span className={`font-medium ${TONE_CLASS[s.tone]}`}>
                {s.label}
              </span>
            );
          },
        },
        {
          header: 'Status',
          render: (p) => (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                p.isActive
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {p.isActive ? 'Active' : 'Inactive'}
            </span>
          ),
        },
      ]}
      renderForm={(draft, patch) => (
        <>
          <Field label="Position name">
            <input
              className={FIELD}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Cashier"
            />
          </Field>

          <Field label="Department">
            <select
              className={FIELD}
              value={draft.department ?? ''}
              onChange={(e) => patch({ department: e.target.value || null })}
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            {!departments.length && (
              <p className="mt-1 text-xs text-amber-600">
                No departments yet. Create one first so positions can be filed
                under it.
              </p>
            )}
          </Field>

          <Field label="Employment type">
            <select
              className={FIELD}
              value={draft.employmentType ?? 'full_time'}
              onChange={(e) =>
                patch({
                  employmentType: e.target
                    .value as JobPositionInput['employmentType'],
                })
              }
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Expected headcount" hint="(0 = no target)">
            <input
              type="number"
              min={0}
              className={FIELD}
              value={draft.expectedHeadcount ?? 0}
              onChange={(e) =>
                patch({ expectedHeadcount: Number(e.target.value) })
              }
            />
          </Field>

          <Field label="Description" hint="(optional)">
            <textarea
              className={FIELD}
              rows={3}
              value={draft.description ?? ''}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>

          <Field label="Requirements" hint="(optional)">
            <textarea
              className={FIELD}
              rows={3}
              value={draft.requirements ?? ''}
              onChange={(e) => patch({ requirements: e.target.value })}
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
      validate={(d) =>
        (d.expectedHeadcount ?? 0) < 0
          ? 'Expected headcount must be zero or more'
          : null
      }
    />
  );
}
