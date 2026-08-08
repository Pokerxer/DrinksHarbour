'use client';

// The org-structure parts of the employee profile form: department, job
// position, planning roles and approvers.
//
// Extracted from employee-profile-form.tsx (1,500+ lines) because these fields
// stopped being plain text inputs — they now load option lists, cross-reference
// each other, and default the job title from the chosen position. Keeping that
// in the parent would have grown a file that is already hard to hold in one
// piece.

import { useEffect, useState } from 'react';
import {
  departmentService,
  jobPositionService,
  employeeRoleService,
  refId,
  type Department,
  type JobPosition,
  type EmployeeRole,
} from '@/services/orgStructure.service';

const PFIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

export interface OrgOptions {
  departments: Department[];
  positions: JobPosition[];
  roles: EmployeeRole[];
  loading: boolean;
  /** True when the tenant has no org structure configured at all. */
  empty: boolean;
}

/**
 * Load the three option lists once per form mount.
 *
 * Only ACTIVE records are offered: a retired department must not be assignable
 * to someone new, while employees already in it keep rendering, because the
 * server refuses to delete a referenced record and the id therefore always
 * resolves.
 */
export function useOrgOptions(token: string): OrgOptions {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      departmentService.list(token, { isActive: true }),
      jobPositionService.list(token, { isActive: true }),
      employeeRoleService.list(token, { isActive: true }),
    ])
      .then(([d, p, r]) => {
        if (cancelled) return;
        setDepartments(d);
        setPositions(p);
        setRoles(r);
      })
      .catch(() => {
        // Non-fatal. The pickers render empty with a prompt to configure the
        // org structure rather than taking the whole profile form down.
        if (!cancelled) {
          setDepartments([]);
          setPositions([]);
          setRoles([]);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [token]);

  return {
    departments,
    positions,
    roles,
    loading,
    empty: !loading && !departments.length && !positions.length && !roles.length,
  };
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-amber-600">{children}</p>;
}

/**
 * Department / Job Position / Job Title.
 *
 * Picking a position fills an EMPTY job title with the position's name and
 * leaves a title the user has already written alone — the position is the
 * shared, countable post; the title is this person's wording for it.
 */
export function WorkOrgFields({
  departmentId,
  positionId,
  jobTitle,
  options,
  setP,
}: {
  departmentId: string;
  positionId: string;
  jobTitle: string;
  options: OrgOptions;
  setP: (path: string, value: unknown) => void;
}) {
  const { departments, positions } = options;

  // Positions filed under the chosen department, plus any that are unfiled.
  // Filing is advisory, so an unfiled position stays selectable everywhere
  // rather than becoming unreachable.
  const visiblePositions = departmentId
    ? positions.filter((p) => {
        const d = refId(p.department);
        return !d || d === departmentId;
      })
    : positions;

  function chooseDepartment(id: string) {
    setP('work.department', id);
    // A position filed under a different department is now contradictory —
    // clear it rather than leave the two disagreeing.
    if (id && positionId) {
      const current = positions.find((p) => p._id === positionId);
      const filed = current ? refId(current.department) : '';
      if (filed && filed !== id) setP('work.jobPosition', '');
    }
  }

  function choosePosition(id: string) {
    setP('work.jobPosition', id);
    if (!id) return;
    const picked = positions.find((p) => p._id === id);
    if (picked && !jobTitle.trim()) setP('work.jobTitle', picked.name);
    // Filing the employee into the position's department saves a second pick.
    const filed = picked ? refId(picked.department) : '';
    if (filed && !departmentId) setP('work.department', filed);
  }

  return (
    <>
      <label className="text-sm font-medium text-gray-700">
        Department
        <select
          className={`mt-1.5 ${PFIELD}`}
          value={departmentId}
          onChange={(e) => chooseDepartment(e.target.value)}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        {!options.loading && !departments.length && (
          <Hint>No departments yet — create one under Organisation → Departments.</Hint>
        )}
      </label>

      <label className="text-sm font-medium text-gray-700">
        Job Position
        <select
          className={`mt-1.5 ${PFIELD}`}
          value={positionId}
          onChange={(e) => choosePosition(e.target.value)}
        >
          <option value="">—</option>
          {visiblePositions.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        {!options.loading && !visiblePositions.length && (
          <Hint>
            {departments.length
              ? 'No positions available for this department.'
              : 'No job positions yet — create one under Organisation → Job Positions.'}
          </Hint>
        )}
      </label>

      <label className="col-span-2 text-sm font-medium text-gray-700">
        Job Title{' '}
        <span className="font-normal text-gray-400">
          (defaults from the position; override for this person)
        </span>
        <input
          className={`mt-1.5 ${PFIELD}`}
          value={jobTitle}
          onChange={(e) => setP('work.jobTitle', e.target.value)}
          placeholder="e.g. Senior Bartender"
        />
      </label>
    </>
  );
}

/**
 * Planning roles: what this person is qualified to work. Multi-select, because
 * most staff can cover more than one role, and the default is what the roster
 * reaches for first.
 */
export function PlanningRoleFields({
  roleIds,
  defaultRoleId,
  options,
  setP,
}: {
  roleIds: string[];
  defaultRoleId: string;
  options: OrgOptions;
  setP: (path: string, value: unknown) => void;
}) {
  const { roles } = options;

  function toggle(id: string) {
    const next = roleIds.includes(id) ? roleIds.filter((r) => r !== id) : [...roleIds, id];
    setP('planning.roles', next);
    // A default the employee no longer holds would silently mis-staff the
    // roster, so clear it alongside.
    if (defaultRoleId === id && !next.includes(id)) setP('planning.defaultRole', '');
  }

  return (
    <>
      <div className="col-span-2">
        <p className="text-sm font-medium text-gray-700">
          Roles{' '}
          <span className="font-normal text-gray-400">(what they can be scheduled for)</span>
        </p>
        {!options.loading && !roles.length ? (
          <Hint>No roles yet — create one under Organisation → Roles.</Hint>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {roles.map((r) => {
              const on = roleIds.includes(r._id);
              return (
                <button
                  key={r._id}
                  type="button"
                  onClick={() => toggle(r._id)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? 'border-[#b20202] bg-[#b20202]/5 font-semibold text-[#b20202]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: r.color || '#d1d5db' }}
                  />
                  {r.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <label className="col-span-2 text-sm font-medium text-gray-700">
        Default Role
        <select
          className={`mt-1.5 ${PFIELD}`}
          value={defaultRoleId}
          onChange={(e) => setP('planning.defaultRole', e.target.value)}
        >
          <option value="">—</option>
          {/* Only roles they actually hold — a default outside that list would
              schedule them for work they are not marked capable of. */}
          {roles
            .filter((r) => roleIds.includes(r._id))
            .map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
        </select>
        {!!roleIds.length === false && !options.loading && roles.length > 0 && (
          <Hint>Select at least one role above to choose a default.</Hint>
        )}
      </label>
    </>
  );
}

/**
 * Approvers. Refs now rather than typed names — an approver that cannot be
 * resolved to an account cannot have a request routed to them.
 */
export function ApproverFields({
  values,
  colleagues,
  setP,
}: {
  values: { hrResponsible: string; expense: string; timeOff: string };
  colleagues: { _id: string; firstName: string; lastName: string; email: string }[];
  setP: (path: string, value: unknown) => void;
}) {
  const fields: { key: keyof typeof values; label: string; hint?: string }[] = [
    { key: 'hrResponsible', label: 'HR Responsible' },
    { key: 'expense', label: 'Expense' },
    { key: 'timeOff', label: 'Time Off', hint: 'Falls back to their manager when unset' },
  ];

  return (
    <>
      {fields.map((f) => (
        <label key={f.key} className="col-span-2 text-sm font-medium text-gray-700">
          {f.label}
          {f.hint && <span className="ml-1 font-normal text-gray-400">({f.hint})</span>}
          <select
            className={`mt-1.5 ${PFIELD}`}
            value={values[f.key]}
            onChange={(e) => setP(`approvers.${f.key}`, e.target.value)}
          >
            <option value="">—</option>
            {colleagues.map((c) => (
              <option key={c._id} value={c._id}>
                {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}
              </option>
            ))}
          </select>
        </label>
      ))}
    </>
  );
}
