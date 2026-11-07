import type { PriceDraft, PriceLine, ReviewListing } from './types';
import { tenantDefaultRate } from './selling-markup';
const percent = (rate: number | null | undefined) =>
  rate == null
    ? 'Unavailable'
    : `${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 4 }).format(rate)}%`;
export default function SellingMarkupSummary({
  line,
  listing,
  draft,
  rate,
  disabled,
  onEdit,
}: {
  line: PriceLine;
  listing: ReviewListing;
  draft: PriceDraft;
  rate: number | null;
  disabled: boolean;
  onEdit: (field: keyof PriceDraft, value: string) => void;
}) {
  const defaultRate = tenantDefaultRate(line, listing);
  const inheritedPrice = line.pricing.inheritedMarketplacePrice;
  const canReset =
    defaultRate !== null &&
    typeof inheritedPrice === 'number' &&
    Number.isFinite(inheritedPrice) &&
    inheritedPrice > 0;
  const changed = Number(draft.normal) !== line.pricing.platformSellingPrice;
  const source =
    draft.inherit === 'true'
      ? 'Will inherit tenant default on approval.'
      : changed
        ? 'Will save a product percentage override on approval.'
        : line.pricing.isSellingPriceMarkupOverridden === true
          ? 'Saved product override'
          : line.pricing.isSellingPriceMarkupOverridden === false
            ? 'Inherits tenant default'
            : 'Review the current pricing source before approval.';
  return (
    <section
      aria-label={`Selling-price markup for ${line.label}`}
      className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
    >
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-gray-500">Tenant default</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums">
            {percent(defaultRate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Markup to save</dt>
          <dd
            aria-label="Markup to save"
            aria-live="polite"
            className="mt-1 text-lg font-semibold tabular-nums text-blue-800"
          >
            {percent(rate)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs font-medium text-gray-700">{source}</p>
      <p className="mt-2 text-xs leading-5 text-gray-600">
        Tenant selling price is the payout. The percentage is added to that
        price; commission and cost-based markup do not apply.
      </p>
      <p className="mt-2 text-xs leading-5 text-gray-500">
        Price edits save a percentage. Later tenant selling-price changes
        recalculate the marketplace price. Tenant default changes affect
        inherited listings only.
      </p>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
        disabled={disabled || !canReset}
        onClick={() => {
          onEdit('normal', String(inheritedPrice));
          onEdit('inherit', 'true');
        }}
      >
        Use tenant default ({percent(defaultRate)})
      </button>
    </section>
  );
}
