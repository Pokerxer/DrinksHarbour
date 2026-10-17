import type { PriceTargets } from './types';
export default function ReviewTargets({
  targets,
  onChange,
  disabled,
  commission = false,
  rate,
}: {
  targets: PriceTargets;
  onChange: (targets: PriceTargets) => void;
  disabled: boolean;
  commission?: boolean;
  rate?: number;
}) {
  const invalid = Object.values(targets).some(
    (v) =>
      v.trim() && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) >= 100)
  );
  const custom = !!(targets.platform.trim() || targets.tenant.trim());
  return (
    <details className="group rounded-xl border border-gray-200 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 rounded-xl p-4 focus-visible:ring-2 focus-visible:ring-blue-500">
        <span className="text-sm font-semibold text-gray-800">Margin targets</span>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
          {custom ? 'Custom targets' : 'Existing settings'}
        </span>
        {invalid && <span className="text-xs text-red-700">Check targets</span>}
        <span
          aria-hidden
          className="ml-auto text-xs text-blue-700 group-open:hidden"
        >
          Adjust ↓
        </span>
      </summary>
      <div className="border-t border-gray-100 p-4 sm:p-5">
        <p className="text-sm leading-6 text-gray-500">
          Adjust these targets to explore suggestions. Tenant revenue terms remain
          unchanged.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            [
              'platform',
              commission ? 'Agreed commission (%)' : 'Platform target margin (%)',
            ],
            ['tenant', 'Tenant target margin (%)'],
          ].map(([key, label]) => (
            <label key={key} className="text-xs font-medium text-gray-600">
              {label}
              <input
                aria-label={label}
                inputMode="decimal"
                value={
                  commission && key === 'platform'
                    ? String(rate ?? '')
                    : targets[key as keyof PriceTargets]
                }
                disabled={disabled || (commission && key === 'platform')}
                onChange={(e) => onChange({ ...targets, [key]: e.target.value })}
                placeholder="Use existing settings for each price"
                className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-400">
          {commission
            ? 'The agreed commission is fixed, with any pack rate shown on its price card. Only the tenant margin target is adjustable; it does not change the agreement.'
            : 'Blank targets use each price’s configured platform markup converted to margin and its current tenant margin. Targets are local to this review.'}
        </p>
        {invalid && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            Target margins must be zero or greater and below 100%.
          </p>
        )}
      </div>
    </details>
  );
}
