'use client';
import { useState } from 'react';
import NotificationFeatureHeader from '../notification-feature-header';
import NotificationTimeframe from '../notification-timeframe';
import PromotionSettings, { defaultSettings } from './promotion-settings';
import PromotionResults from './promotion-results';
import { usePromotionSuggestions } from './use-promotion-suggestions';
export default function PromotionPage() {
  const [range, setRange] = useState({ startDate: '', endDate: '' }),
    [warehouseId, setWarehouse] = useState(''),
    [settings, setSettings] = useState(defaultSettings);
  const params = new URLSearchParams({
    ...settings,
    ...(range.startDate ? range : {}),
    ...(warehouseId ? { warehouseId } : {}),
  });
  const result = usePromotionSuggestions(params.toString()),
    plan = result.data;
  return (
    <section className="space-y-5 pb-8">
      <NotificationFeatureHeader
        title="Promotion suggestions"
        description="Learn which products customers buy together, and review offers for slow movers and special days."
        warehouse="Your tenant’s sales and stock"
        period={
          plan
            ? `${plan.days} days of recorded customer sales · ${plan.basketCount} eligible baskets`
            : 'Last 90 completed days by default'
        }
        loading={result.loading}
        refresh={result.refresh}
        refreshLabel="Refresh suggestions"
      />
      <NotificationTimeframe
        {...range}
        disabled={result.loading}
        onApply={(startDate, endDate) => setRange({ startDate, endDate })}
      />
      <div className="rounded-2xl border bg-white p-4">
        <label className="text-xs font-semibold text-gray-600">
          Warehouse
          <select
            aria-label="Promotion warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouse(e.target.value)}
            className="mt-1 block h-11 min-w-60 rounded-xl border px-3 text-sm font-normal"
          >
            <option value="">
              All warehouses · separate offers per location
            </option>
            {plan?.warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PromotionSettings
        canPrice={plan?.canPrice ?? false}
        occasions={plan?.occasions || []}
        disabled={result.loading}
        apply={setSettings}
      />
      {result.error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {result.error}
          <button
            onClick={() => void result.refresh()}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      {result.loading && (
        <p role="status" className="text-sm text-gray-500">
          Analysing sales baskets and stock…
        </p>
      )}
      {plan && (
        <>
          <div className="rounded-xl bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
            <p className="font-semibold">Model: {plan.model}</p>
            <p className="mt-1">
              Sales affinity informs combos. Discounts are guarded previews;
              seasonal lift is not guessed.
            </p>
            {plan.occasions.length > 0 && (
              <p className="mt-2">
                Upcoming:{' '}
                {plan.occasions.map((e) => `${e.name} (${e.date})`).join(' · ')}
              </p>
            )}
          </div>
          {plan.warnings.map((w) => (
            <p key={w} className="text-xs text-gray-500">
              {w}
            </p>
          ))}
          {plan.truncated && (
            <p
              role="status"
              className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              Showing up to 500 suggestions. Choose a warehouse to narrow the
              evidence.
            </p>
          )}
          <PromotionResults key={result.scope} plan={plan} />
        </>
      )}
    </section>
  );
}
