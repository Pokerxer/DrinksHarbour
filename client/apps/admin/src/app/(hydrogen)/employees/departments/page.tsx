'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiBuildingsDuotone } from 'react-icons/pi';
import OrgConfigPage, {
  Field,
  FIELD,
} from '@/app/shared/employees/org-config-page';
import {
  labelFor,
  buildLabelMap,
} from '@/app/shared/employees/org-config-utils';
import {
  departmentService,
  refId,
  type Department,
  type DepartmentInput,
} from '@/services/orgStructure.service';
import { employeeService, type Employee } from '@/services/employee.service';

const EMPTY: DepartmentInput = {
  name: '',
  code: '',
  parent: null,
  manager: null,
  color: '',
  note: '',
  isActive: true,
};

export default function DepartmentsPage() {
  // Kept so the parent picker can name a department stored as a bare id, and so
  // a department cannot be offered as its own parent.
  const [all, setAll] = useState<Department[]>([]);
  const names = buildLabelMap(all);

  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [staff, setStaff] = useState<Employee[]>([]);

  // Only admins and owners can be a department manager: the manager is who
  // reviews the department's appraisals, and a tenant_staff account cannot.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    employeeService
      .getEmployees(token, { status: 'active' })
      .then((res) => {
        if (cancelled) return;
        setStaff(
          res.data.employees.filter(
            (e) => e.role === 'tenant_admin' || e.role === 'tenant_owner'
          )
        );
      })
      .catch(() => {
        // Non-fatal: the picker degrades to "no eligible managers" rather than
        // taking the whole page down.
        if (!cancelled) setStaff([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const managerName = (id: string) => {
    const m = staff.find((s) => s._id === id);
    return m
      ? [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email
      : '';
  };

  return (
    <OrgConfigPage<Department, DepartmentInput>
      title="Departments"
      subtitle="Units of the organisation. A department's manager reviews its appraisals."
      icon={<PiBuildingsDuotone />}
      noun="department"
      service={departmentService}
      onLoaded={setAll}
      emptyDraft={EMPTY}
      toDraft={(d) => ({
        name: d.name,
        code: d.code ?? '',
        parent: refId(d.parent) || null,
        manager: refId(d.manager) || null,
        color: d.color ?? '',
        note: d.note ?? '',
        isActive: d.isActive,
      })}
      columns={[
        {
          header: 'Department',
          render: (d) => (
            <div className="flex items-center gap-2.5">
              <span
                className="h-6 w-1.5 shrink-0 rounded-full"
                style={{ background: d.color || '#e5e7eb' }}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{d.name}</p>
                {d.code && (
                  <p className="text-[11px] uppercase text-gray-400">
                    {d.code}
                  </p>
                )}
              </div>
            </div>
          ),
        },
        {
          header: 'Parent',
          render: (d) => (
            <span className="text-gray-600">
              {labelFor(refId(d.parent), names)}
            </span>
          ),
        },
        {
          header: 'Manager',
          render: (d) => {
            const id = refId(d.manager);
            return (
              <span className={id ? 'text-gray-600' : 'text-amber-600'}>
                {id ? managerName(id) || 'Unknown' : 'Unassigned'}
              </span>
            );
          },
        },
        {
          header: 'Employees',
          render: (d) => (
            <span className="font-semibold tabular-nums text-gray-900">
              {d.employeeCount}
            </span>
          ),
        },
        {
          header: 'Status',
          render: (d) => (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                d.isActive
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {d.isActive ? 'Active' : 'Inactive'}
            </span>
          ),
        },
      ]}
      renderForm={(draft, patch, { rows, editingId }) => (
        <>
          <Field label="Name">
            <input
              className={FIELD}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Sales"
            />
          </Field>

          <Field label="Code" hint="(optional)">
            <input
              className={FIELD}
              value={draft.code ?? ''}
              onChange={(e) => patch({ code: e.target.value })}
              placeholder="SLS"
            />
          </Field>

          <Field label="Parent department" hint="(optional)">
            <select
              className={FIELD}
              value={draft.parent ?? ''}
              onChange={(e) => patch({ parent: e.target.value || null })}
            >
              <option value="">— None —</option>
              {rows
                // A department cannot be its own parent; deeper cycles are
                // rejected by the server, which sees the whole tree.
                .filter((d) => d._id !== editingId)
                .map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Manager" hint="(reviews this department's appraisals)">
            <select
              className={FIELD}
              value={draft.manager ?? ''}
              onChange={(e) => patch({ manager: e.target.value || null })}
            >
              <option value="">— Unassigned —</option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {[s.firstName, s.lastName].filter(Boolean).join(' ') ||
                    s.email}
                </option>
              ))}
            </select>
            {!staff.length && (
              <p className="mt-1 text-xs text-amber-600">
                No admins available. Promote someone to Admin first.
              </p>
            )}
          </Field>

          <Field label="Colour" hint="(used on the shift roster)">
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
      validate={(d) =>
        d.color && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(d.color)
          ? 'Colour must be a hex value like #b20202'
          : null
      }
    />
  );
}
