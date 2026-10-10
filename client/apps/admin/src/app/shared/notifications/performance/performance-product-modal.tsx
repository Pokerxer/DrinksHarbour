import { salesUnits } from '../insights/list-rules';
import { DialogTitle, DialogDescription } from '@headlessui/react';
import { Modal } from '@core/modal-views/modal';
import { PiX } from 'react-icons/pi';
import Link from 'next/link';
import type { InsightLine } from '@/services/notificationInsights.service';
import ProductImage from '../warehouses/warehouse-product-image';
import { units } from '../insights/presentation';
import { trend, performanceLink } from './performance-rules';
import { trendStyle } from './performance-product-card';
export default function PerformanceProductModal({
  line,
  onClose,
  stock,
  purchase,
}: {
  line: InsightLine;
  onClose: () => void;
  stock: boolean;
  purchase: boolean;
}) {
  const change = trend(line),
    custom = line.periodUnits !== undefined,
    current = custom ? line.periodUnits : line.units7,
    previous = custom ? line.periodPreviousUnits : line.previousUnits7,
    max = Math.max(current || 0, previous || 0, 1);
  const advice =
    change.status === 'incomplete'
      ? 'Review dated sales records and their warehouse assignments before making a decision.'
      : change.status === 'no_sales'
        ? 'Check product availability, visibility and pricing before ordering more. No sales are recorded in this sales window.'
        : change.status === 'falling'
          ? 'Check availability and recent sales activity before increasing the next order.'
          : change.status === 'new'
            ? 'Recent sales have started after a period without recorded sales. Watch subsequent sales before treating this as a sustained trend.'
            : change.status === 'rising'
              ? 'Review stock and replenishment needs so the stronger sales pace can be supported.'
              : 'Compare stock and replenishment needs with the current sales pace.';
  return (
    <Modal
      isOpen
      onClose={onClose}
      customSize={760}
      rounded="lg"
      containerClassName="overflow-hidden bg-white"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex shrink-0 gap-4 border-b border-gray-100 bg-gray-50/60 p-5">
          <ProductImage src={line.productImage} name={line.productName} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Product sales performance
            </p>
            <DialogTitle className="mt-1 text-lg font-semibold text-gray-900">
              {line.productName}{' '}
              <span className="font-normal text-gray-500">{line.sizeName}</span>
            </DialogTitle>
            <DialogDescription className="mt-2 text-xs text-gray-500">
              {line.warehouseName}
              {line.sku && ` · ${line.sku}`}
            </DialogDescription>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Close performance details"
            className="self-start rounded-full p-2 text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#b20202]"
          >
            <PiX aria-hidden className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-5 overflow-y-auto p-5">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${trendStyle[change.status]}`}
          >
            {change.label}
            {change.percent !== null &&
              ` · ${change.percent > 0 ? '+' : ''}${units(change.percent)}%`}
          </span>
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div>
              <dt className="text-xs text-gray-500">
                {custom ? 'Net sold · selected period' : 'Net sold · 30 days'}
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {salesUnits(line) == null
                  ? 'Needs history'
                  : `${units(salesUnits(line))} units`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Average sales speed</dt>
              <dd className="mt-1 text-xl font-semibold">
                {line.dailySales == null
                  ? 'Needs history'
                  : `${units(line.dailySales)} units/day`}
              </dd>
            </div>
            {stock && (
              <div>
                <dt className="text-xs text-gray-500">Available stock</dt>
                <dd className="mt-1 font-semibold">
                  {line.available == null
                    ? 'Verify balance'
                    : `${units(line.available)} units`}
                </dd>
              </div>
            )}
          </dl>
          {change.status !== 'incomplete' && (
            <div className="space-y-3 rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold">Weekly sales comparison</h3>
              {[
                {
                  label: custom ? 'Previous equal period' : 'Previous 7 days',
                  quantity: previous || 0,
                },
                {
                  label: custom ? 'Selected period' : 'Last 7 days',
                  quantity: current || 0,
                },
              ].map((bar) => (
                <div key={bar.label}>
                  <p className="mb-1 flex justify-between text-xs text-gray-600">
                    <span>{bar.label}</span>
                    <span>{units(bar.quantity)} units</span>
                  </p>
                  <div
                    aria-hidden
                    className="h-2 overflow-hidden rounded-full bg-gray-100"
                  >
                    <div
                      className="h-full rounded-full bg-[#b20202]"
                      style={{ width: `${(bar.quantity / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-blue-50/60 p-4 text-sm leading-relaxed text-blue-950">
            <p className="font-semibold">Suggested next step</p>
            <p className="mt-1">{advice}</p>
          </div>
          <p className="text-xs leading-relaxed text-gray-500">
            Customer sales are net of recorded returns. Internal transfers are
            excluded. Complete days are compared using Africa/Lagos time.
            Stockouts and missing records can understate sales; a weekly change
            does not establish its cause.
          </p>
          {change.status === 'incomplete' && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              {line.salesDataStatus === 'incomplete_location'
                ? 'Some sales cannot be reliably assigned to this warehouse.'
                : 'Some sales records are missing reliable dates or quantities.'}
            </p>
          )}
          <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
            {stock && (
              <Link
                href={performanceLink('/notifications/warehouses', line)}
                className="rounded-lg border px-3 py-2 text-xs font-semibold"
              >
                Review warehouse stock
              </Link>
            )}
            <Link
              href={performanceLink('/notifications/forecasts', line)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
            >
              View demand forecast
            </Link>
            {purchase && (
              <Link
                href={performanceLink('/notifications/restock', line)}
                className="rounded-lg bg-[#b20202] px-3 py-2 text-xs font-semibold text-white"
              >
                Review restock
              </Link>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
