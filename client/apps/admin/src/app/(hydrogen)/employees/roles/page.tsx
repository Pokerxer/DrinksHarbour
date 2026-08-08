'use client';

import { PiIdentificationBadgeDuotone } from 'react-icons/pi';
import OrgConfigPage, {
  Field,
  FIELD,
} from '@/app/shared/employees/org-config-page';
import {
  employeeRoleService,
  type EmployeeRole,
  type EmployeeRoleInput,
} from '@/services/orgStructure.service';

const EMPTY: EmployeeRoleInput = {
  name: '',
  hourlyCost: 0,
  color: '',
  note: '',
  isActive: true,
};

/**
 * HR/planning roles — what someone is capable of working (Cashier, Bartender,
 * Driver). A shift requires one; an employee holding it can be assigned to it.
 *
 * These grant no permissions. Access control lives on the employee's own role
 * (Owner / Admin / Staff) and is managed from the employee record.
 */
export default function EmployeeRolesPage() {
  return (
    <OrgConfigPage<EmployeeRole, EmployeeRoleInput>
      title="Roles"
      subtitle="What staff are qualified to work. Used to staff shifts — these grant no permissions."
      icon={<PiIdentificationBadgeDuotone />}
      noun="role"
      service={employeeRoleService}
      emptyDraft={EMPTY}
      toDraft={(r) => ({
        name: r.name,
        hourlyCost: r.hourlyCost,
        color: r.color ?? '',
        note: r.note ?? '',
        isActive: r.isActive,
      })}
      columns={[
        {
          header: 'Role',
          render: (r) => (
            <div className="flex items-center gap-2.5">
              <span
                className="h-6 w-1.5 shrink-0 rounded-full"
                style={{ background: r.color || '#e5e7eb' }}
              />
              <span className="font-semibold text-gray-900">{r.name}</span>
            </div>
          ),
        },
        {
          header: 'Hourly cost',
          render: (r) => (
            <span className="tabular-nums text-gray-600">
              {r.hourlyCost > 0 ? `₦${r.hourlyCost.toLocaleString()}` : '—'}
            </span>
          ),
        },
        {
          header: 'Employees',
          render: (r) => (
            <span className="font-semibold tabular-nums text-gray-900">
              {r.employeeCount}
            </span>
          ),
        },
        {
          header: 'Status',
          render: (r) => (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                r.isActive
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {r.isActive ? 'Active' : 'Inactive'}
            </span>
          ),
        },
      ]}
      renderForm={(draft, patch) => (
        <>
          <Field label="Role name">
            <input
              className={FIELD}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Bartender"
            />
          </Field>

          <Field label="Hourly cost" hint="(₦, 0 = not costed)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={FIELD}
              value={draft.hourlyCost ?? 0}
              onChange={(e) => patch({ hourlyCost: Number(e.target.value) })}
            />
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
        (d.hourlyCost ?? 0) < 0
          ? 'Hourly cost must be zero or more'
          : d.color && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(d.color)
            ? 'Colour must be a hex value like #b20202'
            : null
      }
    />
  );
}
