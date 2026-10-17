import { PiWarningCircle } from 'react-icons/pi';
import type { launchCycle } from '@/services/appraisal.service';
type LaunchResult = Awaited<ReturnType<typeof launchCycle>>;
function reasonLabel(reason: string): string {
  if (reason === 'no_manager') return 'No manager assigned';
  if (reason === 'self_manager')
    return 'Employee is listed as their own manager';
  return reason;
}
export default function LaunchResultPanel({
  result,
}: {
  result: LaunchResult;
}) {
  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {result.created}
          </p>
          <p className="text-xs text-gray-400">Created</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {result.alreadyExisted}
          </p>
          <p className="text-xs text-gray-400">Already existed</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {result.skipped.length}
          </p>
          <p className="text-xs text-gray-400">Skipped</p>
        </div>
      </div>

      {/* Created, but with an empty form. Rendered ABOVE `skipped` because it
          is the more misleading of the two: a skipped employee is visibly
          missing, while these appraisals appear in every count and look like
          work in progress right up until the deadline passes with nothing
          submitted. */}
      {(result.askedNothing?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700">
            <PiWarningCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            {result.askedNothing.length} employee
            {result.askedNothing.length === 1 ? ' has' : 's have'} an appraisal
            with NO questions in it
            {result.templateName ? ` — “${result.templateName}”` : ''} has no
            section covering their department.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.askedNothing.map((s, i) => (
              <li
                key={`${s.employee?._id}-${i}`}
                className="rounded-md bg-white px-3 py-2 text-xs"
              >
                {[s.employee?.firstName, s.employee?.lastName]
                  .filter(Boolean)
                  .join(' ') ? (
                  <span className="font-medium text-gray-700">
                    {[s.employee?.firstName, s.employee?.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                ) : (
                  <span className="font-mono text-gray-500">
                    Employee ID: {s.employee?._id}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-red-600">
            Give the form a section for their department, or set the
            employee&rsquo;s department, then launch again — re-launching only
            adds what is missing.
          </p>
        </div>
      )}

      {result.skipped.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
            {result.skipped.length} employee
            {result.skipped.length === 1 ? ' was' : 's were'} not enrolled —
            these need attention, not just a count.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.skipped.map((s, i) => (
              <li
                key={`${s.employee?._id}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs"
              >
                {/* launchCycle resolves each skipped id to a user, because an
                    HR user cannot chase an ObjectId. It falls back to `{_id}`
                    alone when the record can't be found, so show the id in
                    that case rather than an empty row. Never render
                    `s.employee` directly — it is an object, and React throws
                    "Objects are not valid as a React child". */}
                {[s.employee?.firstName, s.employee?.lastName]
                  .filter(Boolean)
                  .join(' ') ? (
                  <span className="font-medium text-gray-700">
                    {[s.employee?.firstName, s.employee?.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                ) : (
                  <span className="font-mono text-gray-500">
                    Employee ID: {s.employee?._id}
                  </span>
                )}
                <span className="font-medium text-amber-700">
                  {reasonLabel(s.reason)}
                </span>
              </li>
            ))}
          </ul>
          {/* This used to tell HR the response "only carries employee ids, not
              names — look these up in Employees", directly beneath a list
              rendering the names. The server resolves them now; the advice
              outlived the limitation it described. */}
          <p className="mt-2 text-[11px] text-gray-400">
            Fix the underlying record — usually a missing manager on the
            employee&rsquo;s profile — then launch again. Employees who already
            have an appraisal for this cycle are skipped, not duplicated.
          </p>
        </div>
      )}
    </div>
  );
}
