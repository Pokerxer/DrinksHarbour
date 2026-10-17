import Link from 'next/link';
import { Button } from 'rizzui';
import type { PersonRef, StalledAppraisal } from '@/services/appraisal.service';
import AppraisalStateBadge from '../state-badge';
function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}
export default function StalledList({
  rows,
  skippingId,
  onSkipPeers,
}: {
  rows: StalledAppraisal[];
  skippingId: string | null;
  onSkipPeers: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-400">
        No peer-review appraisals are stalled right now.
      </p>
    );
  }
  return (
    <>
      {/* Phone: a card per stalled appraisal. The 5-column table below put the
          Action column — the only reason this list exists — off the right edge
          behind a horizontal scroller. */}
      <div className="mt-3 flex flex-col gap-2.5 md:hidden">
        {rows.map((row) => {
          const isSkipping = skippingId === row._id;
          return (
            <div
              key={row._id}
              className="rounded-xl border border-gray-100 bg-white p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {personName(row.employee)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    Manager: {personName(row.manager)}
                  </p>
                </div>
                <div className="shrink-0">
                  <AppraisalStateBadge state={row.state} />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Since {formatDate(row.since)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-50 pt-3">
                {row.state === 'nominating' && (
                  <Link
                    href={`/appraisals/${row._id}/nominate`}
                    className="text-xs font-semibold text-[#b20202] hover:underline"
                  >
                    Nominate on their behalf
                  </Link>
                )}
                {row.state === 'pending_peer_approval' && (
                  <Link
                    href={`/appraisals/${row._id}`}
                    className="text-xs font-semibold text-[#b20202] hover:underline"
                  >
                    Approve peers
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="ms-auto"
                  onClick={() => onSkipPeers(row._id)}
                  disabled={isSkipping}
                >
                  {isSkipping ? 'Skipping…' : 'Skip peers'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <th className="py-2 pr-3">Employee</th>
              <th className="py-2 pr-3">Manager</th>
              <th className="py-2 pr-3">State</th>
              <th className="py-2 pr-3">Since</th>
              <th className="py-2 pr-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const isSkipping = skippingId === row._id;
              return (
                <tr key={row._id}>
                  <td className="py-2.5 pr-3 text-sm font-medium text-gray-900">
                    {personName(row.employee)}
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-gray-600">
                    {personName(row.manager)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <AppraisalStateBadge state={row.state} />
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-gray-500">
                    {formatDate(row.since)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {row.state === 'nominating' && (
                        <Link
                          href={`/appraisals/${row._id}/nominate`}
                          className="text-xs font-semibold text-[#b20202] hover:underline"
                        >
                          Nominate on their behalf
                        </Link>
                      )}
                      {row.state === 'pending_peer_approval' && (
                        <Link
                          href={`/appraisals/${row._id}`}
                          className="text-xs font-semibold text-[#b20202] hover:underline"
                        >
                          Approve peers
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSkipPeers(row._id)}
                        disabled={isSkipping}
                      >
                        {isSkipping ? 'Skipping…' : 'Skip peers'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
