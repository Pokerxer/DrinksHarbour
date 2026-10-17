import { evaluatePrice, money } from './pricing';
export default function PriceOutcomes({
  value,
  currency,
}: {
  value: ReturnType<typeof evaluatePrice>;
  currency: string;
}) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 xl:grid-cols-4">
        {[
          ['Customer pays', money(value.customer, currency)],
          ['Tenant receives', money(value.payout, currency)],
          ['Tenant gross profit', money(value.tenantProfit, currency)],
          ['Platform gross profit', money(value.platformProfit, currency)],
        ].map(([label, amount]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-gray-900">
              {amount}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
        <span>
          Tenant margin{' '}
          {value.tenantMargin === null
            ? 'unknown'
            : `${value.tenantMargin.toFixed(1)}%` +
              (value.rates.tenant !== null
                ? ` · target ${value.rates.tenant.toFixed(1)}%`
                : '')}
        </span>
        <span>
          Platform margin{' '}
          {value.platformMargin === null
            ? 'unknown'
            : `${value.platformMargin.toFixed(1)}%` +
              (value.rates.platform !== null
                ? ` · target ${value.rates.platform.toFixed(1)}%`
                : '')}
        </span>
      </div>
      {value.tenantTargetMet === false && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Tenant target is not met. Required payout:{' '}
          {money(value.requiredPayout, currency)}.
          {value.commission
            ? ' Commission stays at the agreed rate; compare a higher selling price with the tenant’s store price before applying it.'
            : ' A website price change cannot increase this fixed payout; review the tenant’s revenue terms.'}
        </p>
      )}
      {value.platformTargetMet === false && !value.error && (
        <p className="mt-2 text-xs text-amber-800">
          The platform margin is below the selected target.
        </p>
      )}
      {value.error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {value.error}
        </p>
      )}
    </>
  );
}
