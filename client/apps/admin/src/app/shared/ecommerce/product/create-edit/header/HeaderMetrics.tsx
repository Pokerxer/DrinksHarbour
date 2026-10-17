'use client';
import { PiPackage, PiStack, PiTrendUp } from 'react-icons/pi';
import type { ProductHeaderMetrics } from './types';
const number = (value: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-NG')
    : '—';
export default function HeaderMetrics({
  metrics,
  onVariants,
  onOnHand,
  onSold,
}: {
  metrics: ProductHeaderMetrics;
  onVariants: () => void;
  onOnHand: () => void;
  onSold: () => void;
}) {
  return (
    <dl
      aria-label="Product metrics"
      className="grid w-full grid-cols-2 gap-x-5 gap-y-3 sm:w-auto sm:grid-cols-4 sm:gap-x-6"
    >
      <div>
        <dt className="sr-only">On hand</dt>
        <dd>
          <button
            type="button"
            onClick={onOnHand}
            aria-label="View on-hand stock"
            aria-haspopup="dialog"
            className="-ml-2 min-h-11 rounded-lg px-2 py-1 text-left hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <PiPackage aria-hidden />
              On hand
            </span>
            <span className="mt-1 block text-sm font-semibold tabular-nums text-blue-700">
              {number(metrics.onHand)} <span className="font-normal">units</span>
            </span>
          </button>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Reference price</dt>
        <dd className="mt-1 text-sm font-semibold tabular-nums text-gray-900">
          {metrics.price > 0 && Number.isFinite(metrics.price)
            ? new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                maximumFractionDigits: 0,
              }).format(metrics.price)
            : '—'}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-1.5 text-xs text-gray-500">
          <PiStack aria-hidden />
          Tenant listings
        </dt>
        <dd className="mt-1">
          <button
            type="button"
            aria-label="View tenant listings"
            onClick={onVariants}
            className="rounded text-sm font-semibold tabular-nums text-blue-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {number(metrics.variants)} <span className="font-normal">listings</span>
          </button>
        </dd>
      </div>
      <div>
        <dt className="sr-only">Sold</dt>
        <dd>
          <button
            type="button"
            onClick={onSold}
            aria-label="View sold history"
            aria-haspopup="dialog"
            title="View purchases and returns · net sold units"
            className="-ml-2 min-h-11 rounded-lg px-2 py-1 text-left hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <PiTrendUp aria-hidden />
              Sold
            </span>
            <span className="mt-1 block text-sm font-semibold tabular-nums text-blue-700">
              {number(metrics.sold)} <span className="font-normal">units</span>
            </span>
          </button>
        </dd>
      </div>
    </dl>
  );
}
