import type { ExamConfiguration } from '@/services/examination.service';
export default function AttendanceRange({
  config,
  onChange,
}: {
  config: ExamConfiguration;
  onChange: (next: ExamConfiguration) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
      <h3 className="text-sm font-semibold text-gray-900">
        1. Attendance period
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          Attendance start date
          <input
            type="date"
            value={config.attendanceFrom ?? ''}
            max={config.attendanceTo || undefined}
            onChange={(e) =>
              onChange({ ...config, attendanceFrom: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-900"
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Attendance end date
          <input
            type="date"
            value={config.attendanceTo ?? ''}
            min={config.attendanceFrom || undefined}
            onChange={(e) =>
              onChange({ ...config, attendanceTo: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-900"
          />
        </label>
      </div>
      <p className="text-xs leading-5 text-gray-500">
        Both dates are included. Use up to 366 days. Finalize after the period
        and its published shifts finish; missing attendance is never treated as
        zero.
      </p>
    </div>
  );
}
