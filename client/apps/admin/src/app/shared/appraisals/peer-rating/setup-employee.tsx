import type { PeerEmployee } from '@/services/peerAppraisal.service';
import type { RosterChoice } from './use-cycle-setup';
export default function SetupEmployee({
  employee: p,
  eligible,
  choice,
  busy,
  onChange,
}: {
  employee: PeerEmployee;
  eligible: boolean;
  choice?: RosterChoice;
  busy: boolean;
  onChange: (choice?: RosterChoice) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-100 p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          aria-label={`Include ${p.displayName}`}
          disabled={busy || (!eligible && !choice)}
          checked={Boolean(choice)}
          onChange={(e) =>
            onChange(
              e.target.checked ? { amount: '0', isAppraiser: true } : undefined
            )
          }
        />
        {p.displayName}
        {!eligible && (
          <span className="text-xs text-amber-700">
            Unavailable — remove from roster
          </span>
        )}
      </label>
      {choice && (
        <div className="flex flex-wrap items-center justify-between gap-3 pl-5">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              aria-label={`Allow ${p.displayName} to appraise`}
              disabled={busy || !eligible}
              checked={choice.isAppraiser}
              onChange={(e) =>
                onChange({ ...choice, isAppraiser: e.target.checked })
              }
            />
            Can appraise colleagues
          </label>
          <label className="text-xs text-gray-500">
            {p.displayName} bonus allocation (₦)
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={busy}
              value={choice.amount}
              onChange={(e) => onChange({ ...choice, amount: e.target.value })}
              className="mt-1 block w-40 rounded-lg border p-2 text-sm text-gray-900"
            />
          </label>
        </div>
      )}
    </div>
  );
}
