import { Users } from 'lucide-react';
import type { PeerEmployee } from '@/services/peerAppraisal.service';
import type { ScopeOptionDoc } from '@/services/appraisal.service';
export default function ExamRecipients({
  employees,
  selectedDepartments,
  departments,
  rosterDirty = false,
  selectedIds,
  onSelectionChange,
}: {
  employees?: PeerEmployee[];
  selectedDepartments: string[];
  departments: ScopeOptionDoc[];
  rosterDirty?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}) {
  const recipients =
    employees?.filter(
      (p) => p.department && selectedDepartments.includes(p.department)
    ) ?? [];
  const ids = selectedIds ?? recipients.map((p) => p.employee);
  const selectedCount = recipients.filter((p) =>
    ids.includes(p.employee)
  ).length;
  return (
    <section
      aria-label="Examination recipients"
      className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Users aria-hidden="true" className="h-4 w-4 text-gray-500" />
        Examination recipients
      </div>
      {!selectedDepartments.length ? (
        <p className="text-xs leading-5 text-gray-500">
          Select a department to preview recipients.
        </p>
      ) : !employees ? (
        <p role="status" className="text-xs text-gray-500">
          Recipient preview is available when the cycle roster loads.
        </p>
      ) : !employees.length ? (
        <p className="text-xs leading-5 text-gray-500">
          Select employees in the cycle roster to preview recipients.
        </p>
      ) : (
        <>
          <p role="status" className="text-sm font-medium text-[#790505]">
            {selectedCount} {selectedCount === 1 ? 'employee' : 'employees'}{' '}
            will receive the exam
          </p>
          {recipients.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <button
                type="button"
                className="text-[#790505] underline"
                onClick={() =>
                  onSelectionChange?.(recipients.map((p) => p.employee))
                }
              >
                Select all employees
              </button>
              <button
                type="button"
                className="text-gray-600 underline"
                onClick={() => onSelectionChange?.([])}
              >
                Clear selection
              </button>
              <span className="text-gray-500">
                {recipients.length} eligible employees
              </span>
            </div>
          )}
          {!recipients.length && (
            <p className="text-xs leading-5 text-gray-500">
              No selected cycle participants belong to these departments.
            </p>
          )}
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {selectedDepartments.map((id) => {
              const people = recipients.filter((p) => p.department === id);
              return (
                <div
                  key={id}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <p className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700">
                    <span>
                      {departments.find((d) => d._id === id)?.name ??
                        'Selected department'}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 tabular-nums">
                      {people.filter((p) => ids.includes(p.employee)).length}/
                      {people.length}
                    </span>
                  </p>
                  {people.length ? (
                    <ul className="mt-2 divide-y divide-gray-100">
                      {people.map((p) => (
                        <li key={p.employee} className="text-sm text-gray-800">
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 hover:bg-red-50/50">
                            <input
                              type="checkbox"
                              aria-label={`Send exam to ${p.displayName}`}
                              checked={ids.includes(p.employee)}
                              onChange={(event) =>
                                onSelectionChange?.(
                                  event.target.checked
                                    ? [...ids, p.employee]
                                    : ids.filter((id) => id !== p.employee)
                                )
                              }
                              className="rounded border-gray-300 text-[#b20202] focus:ring-[#b20202]"
                            />
                            <span
                              aria-hidden="true"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-[#790505]"
                            >
                              {p.displayName.trim().slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 break-words">
                              {p.displayName}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">
                      No cycle participants in this department.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {rosterDirty && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">
          This preview includes unsaved roster changes. Save the roster before
          saving examination settings.
        </p>
      )}
      <p className="text-xs leading-5 text-gray-500">
        Check the employees who should receive questions. Only checked employees
        receive an exam when the cycle launches.
      </p>
    </section>
  );
}
