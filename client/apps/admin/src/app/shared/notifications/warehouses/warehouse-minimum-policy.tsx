import type { StockMinimumPolicy } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
export default function WarehouseMinimumPolicy({
  policy,
  demand,
}: {
  policy: StockMinimumPolicy;
  demand: boolean;
}) {
  const automatic = policy.status === 'active';
  const early = policy.confidence === 'early';
  const activity =
    policy.demandBasis === 'transfers'
      ? 'posted transfers out'
      : policy.demandBasis === 'sales_and_transfers'
        ? 'local sales and posted transfers out'
        : 'local sales';
  const lead =
    policy.leadSource === 'transfer_history'
      ? 'recorded transfer history'
      : policy.leadSource === 'purchase_history'
        ? 'recorded purchase history'
        : 'a 7-day planning assumption';
  const gradual =
    typeof policy.leadUnits === 'number' &&
    typeof policy.safetyUnits === 'number' &&
    policy.units > Math.ceil(policy.leadUnits + policy.safetyUnits);
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${automatic ? 'border-emerald-100 bg-emerald-50/60 text-emerald-950' : 'border-amber-100 bg-amber-50/60 text-amber-950'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {automatic
            ? early
              ? 'Automatic estimate'
              : 'Automatic minimum'
            : 'Learning demand history'}{' '}
          · {units(policy.units)} units
        </p>
        {automatic && policy.calculatedAt && (
          <span className="text-[11px]">
            Updated{' '}
            {new Date(policy.calculatedAt).toLocaleDateString('en-NG', {
              timeZone: 'Africa/Lagos',
            })}
          </span>
        )}
      </div>
      <p className="mt-1 leading-relaxed">
        {automatic
          ? early
            ? `An early estimate that updates as more ${activity} are recorded.`
            : `Updates with this product’s ${activity} and replenishment time.`
          : policy.status === 'incomplete'
            ? 'Sales or transfer records need reliable warehouse assignments and dates. The fallback minimum remains in use.'
            : 'The fallback minimum remains until there are 7 dated local days with at least one recorded sale or posted transfer out.'}
      </p>
      {automatic && demand && (
        <p className="mt-2 leading-relaxed">
          {units(policy.leadUnits)} units for a {policy.leadDays}-day
          replenishment window + {units(policy.safetyUnits)} safety units.
          Delivery time uses {lead}.
          {gradual &&
            ' A gradual reduction limit keeps the current minimum higher.'}
        </p>
      )}
      {automatic && early && demand && (
        <p className="mt-2 leading-relaxed">
          Early{' '}
          {policy.demandBasis && policy.demandBasis !== 'sales'
            ? 'demand'
            : 'sales'}{' '}
          baseline · {policy.historyDays} days of recorded local history, using{' '}
          {activity}. A trained forecast still needs more history.
        </p>
      )}
    </div>
  );
}
