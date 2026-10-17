import { evaluatePrice, money, saleActive, suggestPrice } from './pricing';
import type { PriceDraft, PriceLine, PriceTargets, ReviewListing } from './types';
import PriceOutcomes from './PriceOutcomes';
import PriceComparison from './PriceComparison';
import { isCommission } from './agreement';
const input =
  'min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50';
export default function PricingCard({
  line,
  listing,
  draft,
  targets,
  onEdit,
  disabled,
  changed = false,
  onReset,
}: {
  line: PriceLine;
  listing: ReviewListing;
  draft: PriceDraft;
  targets: PriceTargets;
  onEdit: (field: keyof PriceDraft, value: string) => void;
  disabled: boolean;
  changed?: boolean;
  onReset?: () => void;
}) {
  const commission = isCommission(line, listing);
  const normal = evaluatePrice(line, draft.normal, listing, targets);
  const suggested = suggestPrice(line, listing, targets);
  const packSuggested = suggestPrice(
    line,
    listing,
    targets,
    true,
    Number(draft.normal)
  );
  const pack = draft.pack
    ? evaluatePrice(line, draft.pack, listing, targets, true, Number(draft.normal))
    : null;
  const packEligible =
    (line.pricing.packPlatformCostPrice || 0) > 0 && !!line.packThreshold;
  const packSale = saleActive(listing) || line.pricing.productDiscount?.active;
  const useButton =
    'min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40';
  return (
    <section
      aria-label={`Pricing for ${line.label}`}
      className={`rounded-2xl border bg-white p-4 sm:p-5 ${changed ? 'border-blue-200 shadow-sm' : 'border-gray-200'}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{line.label}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {line.sku || 'No SKU'} · {line.currency}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs capitalize text-gray-600">
          {line.pricing.revenueModel ||
            listing.tenant?.revenueModel ||
            'Revenue model unavailable'}
        </span>
      </header>
      {changed && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
            Edited price
          </span>
          {onReset && (
            <button
              type="button"
              aria-label={`Reset price for ${line.label}`}
              disabled={disabled}
              onClick={onReset}
              className="min-h-11 rounded-lg px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
            >
              Reset this price
            </button>
          )}
        </div>
      )}
      <dl className="mb-4 grid grid-cols-2 gap-3 border-b border-gray-100 pb-4">
        {[
          ['Recorded supplier cost', money(normal.supplier, line.currency)],
          [
            'Tenant store price',
            money(line.pricing.tenantSellingPrice, line.currency),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {line.pricing.isPlatformCostFromWholesale && (
        <p className="mb-3 text-xs leading-5 text-amber-800">
          The payout uses a wholesale pricing basis. Confirm the supplier cost and
          settlement terms before approval.
        </p>
      )}
      {line.pricing.productDiscount?.active && (
        <p className="mb-3 text-xs leading-5 text-amber-800">
          A catalogue discount is active and is already included in the website
          price. Approved prices can recalculate when costs or sales change.
        </p>
      )}
      {normal.supplier === null && (
        <p className="mb-3 text-xs text-amber-800">
          Supplier cost is missing. Tenant profit and target cannot be verified.
        </p>
      )}
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <label className="text-xs font-medium text-gray-600">
          Website price {saleActive(listing) && '(before listing sale)'}
          <input
            aria-label={`Website price for ${line.label}`}
            inputMode="decimal"
            value={draft.normal}
            disabled={disabled}
            onChange={(e) => onEdit('normal', e.target.value)}
            className={`${input} mt-1`}
          />
        </label>
        <button
          type="button"
          className={useButton}
          disabled={disabled || suggested === null}
          aria-label={`Use suggested price for ${line.label}`}
          onClick={() => suggested !== null && onEdit('normal', String(suggested))}
        >
          Use{' '}
          {suggested !== null
            ? money(suggested, line.currency)
            : 'unavailable suggestion'}
        </button>
      </div>
      <PriceComparison
        original={line.pricing.platformSellingPrice}
        entered={draft.normal}
        currency={line.currency}
        label="website price"
      />
      <PriceOutcomes value={normal} currency={line.currency} />
      {normal.customer !== null &&
        (line.pricing.tenantSellingPrice || 0) > 0 &&
        normal.customer > (line.pricing.tenantSellingPrice || 0) && (
          <p className="mt-3 text-xs leading-5 text-amber-800">
            The customer price exceeds this tenant’s store price. Review
            competitiveness and the revenue terms; do not reduce the website price
            below the payout to force a discount.
          </p>
        )}
      <p className="mt-3 text-xs leading-5 text-gray-400">
        {commission
          ? 'Commission is fixed by the tenant agreement and applies after merchandise discounts. Suggestions target tenant margin without adding another platform markup.'
          : 'Suggestion preserves the agreed tenant payout and targets the selected platform margin.'}{' '}
        Based on recorded costs and settings, not a market valuation.
      </p>
      {packEligible && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="text-sm font-semibold text-gray-800">
            Pack rate · {line.packThreshold}+ units
          </h4>
          {packSale ? (
            <p className="mt-2 text-xs text-amber-800">
              Pack pricing is suspended while a sale is active.
            </p>
          ) : (
            <>
              <div className="my-3 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                <label className="text-xs font-medium text-gray-600">
                  Price per sellable unit
                  <input
                    aria-label={`Pack price for ${line.label}`}
                    inputMode="decimal"
                    value={draft.pack}
                    disabled={disabled}
                    onChange={(e) => onEdit('pack', e.target.value)}
                    placeholder="Keep current pack setting"
                    className={`${input} mt-1`}
                  />
                </label>
                <button
                  type="button"
                  className={useButton}
                  disabled={disabled || packSuggested === null}
                  aria-label={`Use suggested pack price for ${line.label}`}
                  onClick={() =>
                    packSuggested !== null && onEdit('pack', String(packSuggested))
                  }
                >
                  Use{' '}
                  {packSuggested !== null
                    ? money(packSuggested, line.currency)
                    : 'unavailable suggestion'}
                </button>
              </div>
              {draft.pack.trim() && (
                <PriceComparison
                  original={line.pricing.packUnitPrice}
                  entered={draft.pack}
                  currency={line.currency}
                  label="pack price"
                />
              )}
              {pack && (
                <>
                  <PriceOutcomes value={pack} currency={line.currency} />
                  <p className="mt-2 text-xs text-gray-500">
                    At {line.packThreshold} units:{' '}
                    {money(
                      (pack.customer || 0) * (line.packThreshold || 0),
                      line.currency
                    )}{' '}
                    total.
                  </p>
                </>
              )}
              {!packSuggested && (
                <p className="mt-2 text-xs text-gray-500">
                  No cheaper pack price meets the platform target at the current
                  normal price.
                </p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Leave blank to keep the current pack setting. Quantity stays in
                sellable units. Automatic pack prices and availability are rechecked
                when the normal price changes.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
