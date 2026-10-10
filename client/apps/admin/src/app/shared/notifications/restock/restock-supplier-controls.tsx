import type {
  InsightLine,
  SupplierOffer,
} from '@/services/notificationInsights.service';
import { validQuantity, type Selection } from '../vendor-orders/order-draft';
import { money, units, formatCover } from '../insights/presentation';
export default function RestockSupplierControls({
  line,
  offer,
  quantity,
  onChange,
  stock,
  demand,
}: {
  line: InsightLine;
  offer?: SupplierOffer | null;
  quantity: number;
  onChange: (choice: Selection) => void;
  stock: boolean;
  demand: boolean;
}) {
  const valid = offer ? validQuantity(quantity, offer) : false;
  const minimum = offer
    ? Math.ceil(offer.minQuantity / offer.packagingQty) * offer.packagingQty
    : 0;
  const next = offer
    ? Math.max(
        minimum,
        Number.isFinite(quantity) && quantity >= 0
          ? (Math.floor(quantity / offer.packagingQty) + 1) * offer.packagingQty
          : offer.packagingQty
      )
    : 0;
  const previous =
    offer && Number.isFinite(quantity)
      ? Math.max(
          0,
          (Math.ceil(quantity / offer.packagingQty) - 1) * offer.packagingQty
        )
      : 0;
  const canAdd = !!offer && validQuantity(next, offer);
  const id = `restock-${line.key}`;
  const unavailable =
    offer?.replenishment?.forecastUnits === null ||
    (!offer?.replenishment &&
      offer?.needsManualReview &&
      offer?.daysOfCover == null);
  return (
    <section className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <label className="block text-sm font-semibold text-gray-700">
        Supplier
        <select
          aria-label={`Supplier for ${line.productName} at ${line.warehouseName}`}
          value={offer?.offerId || ''}
          onChange={(e) => {
            const selected = line.alternatives?.find(
              (o) => o.offerId === e.target.value
            );
            onChange({
              offerId: selected?.offerId || '',
              quantity: selected?.quantity ?? 0,
            });
          }}
          className="mt-2 h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 pr-8 text-sm font-normal text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Select a supplier</option>
          {line.alternatives?.map((o) => (
            <option key={o.offerId} value={o.offerId}>
              {o.vendorName} · {money(o.unitPrice, o.currency)}/unit ·{' '}
              {o.leadTimeDays} days{o.isPreferred ? ' · preferred' : ''}
            </option>
          ))}
        </select>
      </label>
      {offer ? (
        <>
          <p className="break-words text-sm font-medium text-gray-900">
            {offer.vendorName}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <span>{money(offer.unitPrice, offer.currency)} per unit</span>
            <span>
              {units(offer.packagingQty)} units per pack ·{' '}
              {money(offer.unitPrice * offer.packagingQty, offer.currency)} per
              pack
            </span>
            <span>
              Minimum {units(offer.minQuantity)} units
              {offer.maxQuantity != null
                ? ` · Maximum ${units(offer.maxQuantity)} units`
                : ''}
            </span>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${id}-quantity`}
                className="block text-sm font-semibold text-gray-700"
              >
                Order units (packs of {offer.packagingQty})
              </label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Remove one pack"
                  disabled={!Number.isFinite(quantity) || quantity <= 0}
                  onClick={() =>
                    onChange({
                      offerId: offer.offerId,
                      quantity: previous >= minimum ? previous : 0,
                    })
                  }
                  className="h-11 w-11 shrink-0 rounded-lg border border-gray-300 text-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <input
                  id={`${id}-quantity`}
                  aria-label={`Order units for ${line.productName} at ${line.warehouseName}`}
                  aria-invalid={!valid}
                  aria-describedby={`${id}-help${!valid ? ` ${id}-error` : ''}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={offer.maxQuantity ?? undefined}
                  step={offer.packagingQty}
                  value={Number.isFinite(quantity) ? quantity : ''}
                  onChange={(e) =>
                    onChange({
                      offerId: offer.offerId,
                      quantity:
                        e.target.value === '' ? NaN : Number(e.target.value),
                    })
                  }
                  className={`h-11 w-full min-w-0 rounded-lg !border bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 ${valid ? 'border-gray-300 focus:border-primary focus:ring-primary/20' : 'border-red-400 focus:ring-red-200'}`}
                />
                <button
                  type="button"
                  aria-label="Add one pack"
                  disabled={!canAdd}
                  onClick={() =>
                    onChange({ offerId: offer.offerId, quantity: next })
                  }
                  className="h-11 w-11 shrink-0 rounded-lg border border-gray-300 text-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <p id={`${id}-help`} className="mt-2 text-xs text-gray-500">
                Enter units in whole packs of {offer.packagingQty}. Use 0 to
                leave this product out.
              </p>
              {!valid && (
                <p
                  id={`${id}-error`}
                  role="alert"
                  className="mt-2 text-xs text-red-700"
                >
                  Use whole packs, at least {offer.minQuantity} units
                  {offer.maxQuantity !== null
                    ? ` and no more than ${offer.maxQuantity}`
                    : ''}
                  , or 0 to exclude this product.
                </p>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="text-xs text-gray-500">Reviewed order total</p>
              <p className="mt-1 font-semibold text-gray-900">
                {valid
                  ? quantity > 0
                    ? `${quantity / offer.packagingQty} packs · ${money(quantity * offer.unitPrice, offer.currency)}`
                    : 'No units selected'
                  : 'Review quantity'}
              </p>
              <p className="mt-2 text-xs text-gray-600">
                Estimated delivery: {offer.leadTimeDays} days
              </p>
              {stock && demand && (
                <p className="mt-1 text-xs text-gray-500">
                  {unavailable
                    ? 'Stock cover unavailable — see the review reason below.'
                    : `${formatCover(offer.daysOfCover)} cover before this order`}
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Choose a supplier to review terms and enter an order quantity.
        </p>
      )}
    </section>
  );
}
