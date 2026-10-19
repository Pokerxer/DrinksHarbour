import ExamRecipients from './recipients';
import type { PeerEmployee } from '@/services/peerAppraisal.service';
import AttendanceRange from './attendance-range';
import type { ExamConfiguration } from '@/services/examination.service';
import type { ScopeOptionDoc } from '@/services/appraisal.service';
export default function SetupSettings({
  config,
  onChange,
  departments,
  reloadDepartments,
  recipients,
  rosterDirty,
  selectedIds,
}: {
  config: ExamConfiguration;
  onChange: (config: ExamConfiguration) => void;
  departments: ScopeOptionDoc[];
  reloadDepartments: () => void;
  recipients?: PeerEmployee[];
  rosterDirty?: boolean;
  selectedIds?: string[];
}) {
  return (
    <div className="min-w-0 space-y-4">
      <AttendanceRange config={config} onChange={onChange} />
      <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-sm font-medium">
          Examination duration (minutes)
          <input
            type="number"
            min={1}
            max={240}
            step={1}
            value={config.durationMinutes ?? 30}
            onChange={(e) =>
              onChange({ ...config, durationMinutes: Number(e.target.value) })
            }
            className="mt-2 block w-32 rounded-lg border border-gray-200 p-2.5 text-sm focus:border-[#b20202] focus:ring-[#b20202]"
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-gray-500">
          Each employee starts their own timer. Time keeps running if they leave
          or refresh. When it ends, saved answers are marked and unanswered
          questions score zero.
        </p>
      </div>
      <fieldset className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
        <legend className="px-1 text-sm font-medium">
          Departments receiving the examination
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {departments.map((d) => (
            <label
              key={d._id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${config.departments.includes(d._id) ? 'border-red-200 bg-red-50 text-[#790505]' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <input
                type="checkbox"
                checked={config.departments.includes(d._id)}
                onChange={(e) =>
                  onChange({
                    ...config,
                    departments: e.target.checked
                      ? [...config.departments, d._id]
                      : config.departments.filter((id) => id !== d._id),
                  })
                }
                className="rounded border-gray-300 text-[#b20202] focus:ring-[#b20202]"
              />
              {d.name}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">
          Employees you leave unchecked use appraisal and attendance equally.
        </p>
        <button
          type="button"
          onClick={reloadDepartments}
          className="mt-2 text-xs font-medium underline"
        >
          Reload departments
        </button>
      </fieldset>
      <ExamRecipients
        employees={recipients}
        selectedDepartments={config.departments}
        departments={departments}
        rosterDirty={rosterDirty}
        selectedIds={selectedIds}
        onSelectionChange={(recipientIds) =>
          onChange({ ...config, recipientIds })
        }
      />
    </div>
  );
}
