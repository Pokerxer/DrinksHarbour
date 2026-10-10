import type { InsightLine } from '@/services/notificationInsights.service';
import { type Selection } from '../vendor-orders/order-draft';
import RestockRecommendation from './restock-recommendation';
import InsightEvidence from '../insights/insight-evidence';
import { units } from '../insights/presentation';
import RestockSupplierControls from './restock-supplier-controls';
export default function RestockLine({
  line,
  selection,
  onChange,
  stock = true,
  demand = true,
  embedded = false,
}: {
  line: InsightLine;
  selection?: Selection;
  onChange: (choice: Selection) => void;
  stock?: boolean;
  demand?: boolean;
  embedded?: boolean;
}) {
  const offer = selection
    ? line.alternatives?.find((o) => o.offerId === selection.offerId)
    : line.selected;
  const quantity = selection?.quantity ?? offer?.quantity ?? 0;
  const urgency =
    (offer?.needsManualReview ? line.urgency : offer?.urgency) ||
    line.urgency ||
    'Unknown';
  return (
    <article
      className={embedded ? 'p-4 sm:p-5' : 'rounded-xl border bg-white p-5'}
    >
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">
              {line.productName}{' '}
              <span className="text-sm font-normal text-gray-500">
                {line.sizeName}
              </span>
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {line.warehouseName}
              {stock && ` · ${units(line.available)} available`}
              {demand && ` · ${units(line.units30)} sold / 30 days`}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">
            {urgency}
          </span>
        </div>
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {stock && `${units(line.available)} available units`}
            {stock && demand && ' · '}
            {demand && `${units(line.units30)} sold / 30 days`}
          </p>
          {stock && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-800">
              {urgency}
            </span>
          )}
        </div>
      )}
      {demand && (line.transferUnits30 ?? 0) > 0 && (
        <p className="mt-3 text-xs text-gray-600">
          {units(line.transferUnits30)} units transferred out ·{' '}
          {units(line.demandUnits30)} units total warehouse demand / 30 days.
          Forecasts include sales and posted net transfers out.
        </p>
      )}
      {demand && line.periodUnits !== undefined && (
        <p className="mt-3 text-xs text-gray-600">
          Net sold · selected period: {units(line.periodUnits)} units
        </p>
      )}
      {!!line.alternatives?.length ? (
        <RestockSupplierControls
          line={line}
          offer={offer}
          quantity={quantity}
          onChange={onChange}
          stock={stock}
          demand={demand}
        />
      ) : (
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          {!line.warehouseId
            ? 'Identify the receiving warehouse before ordering.'
            : 'No current supplier price matches this product and size. Review vendor pricelists.'}
          {demand && line.forecast?.method === 'insufficient_history' && (
            <span className="mt-2 block">
              The restock forecast also needs complete demand and location
              history.
            </span>
          )}
        </p>
      )}
      {offer && (
        <p className="mt-3 text-xs text-gray-500">
          {offer.needsManualReview
            ? offer.manualReviewReason ||
              'Forecast unavailable. Enter a reviewed manual quantity.'
            : `Suggested ${offer.quantity} units / ${offer.packs} packs.`}{' '}
          Delivery estimate from{' '}
          {offer.leadTimeSource === 'observed_receipts'
            ? 'past completed purchases'
            : 'the vendor pricelist'}
          . Prices exclude unspecified tax/delivery charges.
        </p>
      )}
      {offer && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
          {stock && demand && !offer.needsManualReview && (
            <button
              type="button"
              className="rounded-lg border px-3 py-2 hover:bg-gray-50"
              onClick={() =>
                onChange({ offerId: offer.offerId, quantity: offer.quantity })
              }
            >
              Use suggested quantity
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border px-3 py-2 hover:bg-gray-50"
            onClick={() => onChange({ offerId: offer.offerId, quantity: 0 })}
          >
            Exclude from order
          </button>
        </div>
      )}
      <RestockRecommendation
        line={line}
        offer={offer}
        quantity={quantity}
        stock={stock}
        demand={demand}
      />
      {demand && (
        <InsightEvidence
          line={{
            ...line,
            ...(!stock
              ? {
                  available: undefined,
                  threshold: undefined,
                  buffer: undefined,
                  incoming: undefined,
                  incomingUnits: undefined,
                  daysOfCover: undefined,
                  suggestedUnits: undefined,
                }
              : {}),
            ...(stock && offer
              ? {
                  daysOfCover:
                    offer.replenishment?.forecastUnits === null
                      ? undefined
                      : offer.daysOfCover,
                  suggestedUnits: offer.suggestedUnits,
                }
              : {}),
          }}
        />
      )}
    </article>
  );
}
