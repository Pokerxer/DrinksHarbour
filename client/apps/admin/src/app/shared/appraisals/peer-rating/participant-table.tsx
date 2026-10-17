import type { PeerParticipant } from '@/services/peerAppraisal.service';
import { formatMoney } from './result-card';
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? '?'}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}
export default function ParticipantTable({
  participants,
  closed,
}: {
  participants: PeerParticipant[];
  closed: boolean;
}) {
  return (
    <div className="overflow-x-auto border-t border-gray-100">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">
          Participant completion and bonus results
        </caption>
        <thead className="bg-gray-50/80 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            {[
              'Employee',
              'Submission',
              'Allocation',
              ...(closed ? ['Score', 'Bonus'] : []),
            ].map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`whitespace-nowrap px-5 py-3 font-semibold ${i >= 2 ? 'text-right' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {participants.map((p) => (
            <tr
              key={p.employee}
              className="transition-colors hover:bg-gray-50/70"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600"
                  >
                    {initials(p.displayName)}
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">
                      {p.displayName}
                    </span>
                    {p.unavailable && (
                      <span className="mt-1 block text-xs text-amber-700">
                        Employee unavailable
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${p.submittedAt ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-current"
                  />
                  {p.submittedAt ? 'Submitted' : 'Pending'}
                </span>
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-gray-600">
                {formatMoney(p.allocationMinor)}
              </td>
              {closed && (
                <>
                  <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-gray-900">
                    {p.result ? `${p.result.averageScore.toFixed(2)} / 5` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-gray-900">
                    {p.result ? formatMoney(p.result.bonusMinor) : '—'}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
