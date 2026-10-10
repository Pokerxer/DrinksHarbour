import type { OrderGroup } from './order-draft';
import { money, units } from '../insights/presentation';
export default function VendorOrderCard({
  group: g,
  disabled,
  onPrepare,
  preparing = false,
}: {
  group: OrderGroup;
  disabled: boolean;
  onPrepare: () => void;
  preparing?: boolean;
}) {
  const leads = g.lines
    .map((l) => l.selected.leadTimeDays)
    .filter(Number.isFinite);
  const review = g.lines.filter((l) => l.selected.needsManualReview).length;
  return (
    <article
      aria-label={`${g.vendorName} order to ${g.warehouseName} in ${g.currency}`}
      className="rounded-xl border border-gray-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">{g.vendorName}</h2>
          <p className="mt-1 text-xs text-gray-600">
            Deliver to {g.warehouseName} · {g.currency}
          </p>
        </div>
        <div className="text-right">
          <strong className="text-lg text-gray-900">
            {money(g.estimatedCost, g.currency)}
          </strong>
          <p className="text-xs text-gray-500">Estimated product subtotal</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-600">
        {g.lines.length} product sizes ·{' '}
        {units(g.lines.reduce((n, l) => n + l.selected.quantity, 0))} units
        {leads.length === g.lines.length
          ? ` · Delivery estimate ${Math.min(...leads) === Math.max(...leads) ? Math.max(...leads) : `${Math.min(...leads)}–${Math.max(...leads)}`} days`
          : ' · Confirm delivery timing'}
      </p>
      {!!review && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {review} manually reviewed {review === 1 ? 'quantity' : 'quantities'}.
          Confirm stock, existing purchases and transfers before saving.
        </p>
      )}
      <ul className="my-4 divide-y divide-gray-100">
        {g.lines.map((l) => (
          <li
            key={l.key}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-gray-900">
                {l.productName} · {l.sizeName}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {l.sku} · {units(l.selected.packagingQty)} units per pack
              </p>
              {l.selected.needsManualReview && (
                <p className="mt-1 max-w-xl text-xs text-amber-800">
                  {l.selected.manualReviewReason ||
                    'Reviewed manual order quantity'}
                </p>
              )}
            </div>
            <div className="text-right">
              <p>
                {units(l.selected.quantity)} units / {units(l.selected.packs)}{' '}
                packs
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {money(l.selected.unitPrice, g.currency)}/unit ·{' '}
                {money(l.selected.estimatedCost, g.currency)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onPrepare}
        disabled={disabled}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {preparing ? 'Opening purchase…' : 'Prepare purchase'}
      </button>
      <p className="mt-2 text-xs text-gray-500">
        Opens an editable purchase form with every product in this order.
        Current terms are checked again. Taxes and delivery charges are not
        included.
      </p>
    </article>
  );
}
