'use client';
import { useState } from 'react';
import { DialogTitle, DialogDescription } from '@headlessui/react';
import { Modal } from '@core/modal-views/modal';
import type { PromotionSuggestion } from '@/services/promotionSuggestions.service';
import { money } from '../insights/presentation';
import { previewPrice } from './promotion-rules';
export default function PromotionModal({
  suggestion: s,
  close,
}: {
  suggestion: PromotionSuggestion;
  close: () => void;
}) {
  const [discount, setDiscount] = useState(s.pricing.discountPercent ?? 0);
  const [quantity, setQuantity] = useState(1);
  const price = previewPrice(s, discount);
  const quantityValid =
    Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= s.capacity;
  return (
    <Modal
      isOpen
      onClose={close}
      customSize={820}
      rounded="lg"
      containerClassName="bg-white"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#b20202]">
              Promotion preview
            </p>
            <DialogTitle className="mt-2 text-xl font-semibold">
              {s.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-gray-500">
              {s.warehouseName} · Suggestions do not change live prices.
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Close promotion details"
            onClick={close}
            className="rounded-lg border px-3 py-2"
          >
            Close
          </button>
        </div>
        <p className="mt-5 text-sm text-gray-700">{s.reasoning}</p>
        <dl className="mt-5 grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
          {s.products.map((p) => (
            <div key={p.key}>
              <dt className="text-xs text-gray-500">
                {p.productName} {p.sizeName}
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {p.units} net units sold · {p.available} available
              </dd>
              <p className="mt-1 text-xs text-gray-500">
                {p.sku} · {p.quantity} unit per offer
              </p>
            </div>
          ))}
          <div>
            <dt className="text-xs text-gray-500">
              Stock-limited offer quantity
            </dt>
            <dd className="mt-1 font-semibold">
              Up to {s.capacity} after protecting warehouse reserves
            </dd>
          </div>
          {s.evidence && (
            <>
              <div>
                <dt className="text-xs text-gray-500">Bought together</dt>
                <dd className="mt-1 font-semibold">
                  {s.evidence.jointBaskets} of {s.evidence.basketCount} eligible
                  baskets
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Affinity lift</dt>
                <dd className="mt-1 font-semibold">
                  {s.evidence.lift.toFixed(2)}× independent purchase frequency
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">
                  Observed joint purchase share
                </dt>
                <dd className="mt-1 font-semibold">
                  {(s.evidence.support * 100).toFixed(1)}%
                </dd>
              </div>
            </>
          )}
        </dl>
        {s.occasion && (
          <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            {s.occasion.name} · {s.occasion.date} · {s.occasion.daysAway} days
            away. Suggested window: {s.occasion.date}; return to normal prices
            after the event. Calendar occasions are not confirmation of
            officially observed public holidays.
          </p>
        )}
        {s.occasion?.sourceUrl && (
          <a
            href={s.occasion.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-semibold underline"
          >
            Event source
          </a>
        )}
        {s.pricing.offerPrice === null ? (
          <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            {s.pricing.reason}
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Preview discount (%)
                <input
                  type="number"
                  min={0}
                  max={s.pricing.discountPercent ?? 0}
                  step="0.01"
                  value={Number.isNaN(discount) ? '' : discount}
                  onChange={(e) =>
                    setDiscount(
                      e.target.value === '' ? NaN : Number(e.target.value)
                    )
                  }
                  className="mt-1 block w-full rounded-lg !border border-gray-300 p-3"
                />
              </label>
              <label className="text-sm font-semibold">
                Offer quantity
                <input
                  type="number"
                  min={1}
                  max={s.capacity}
                  step={1}
                  value={Number.isNaN(quantity) ? '' : quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value === '' ? NaN : Number(e.target.value)
                    )
                  }
                  className="mt-1 block w-full rounded-lg !border border-gray-300 p-3"
                />
              </label>
            </div>
            {price !== null && quantityValid && s.pricing.currency ? (
              <p className="text-lg font-semibold">
                {money(price, s.pricing.currency)} per offer ·{' '}
                {money(price * quantity, s.pricing.currency)} for {quantity}
              </p>
            ) : (
              <p role="alert" className="text-sm text-red-700">
                Choose a quantity within stock capacity and a discount within
                the recommended limit.
              </p>
            )}
            <p className="text-xs text-gray-500">
              Recommended maximum {s.pricing.discountPercent}% · projected gross
              margin at the recommendation {s.pricing.marginPercent}%. This
              preview cannot exceed the protected discount limit.
            </p>
          </div>
        )}
        <p className="mt-5 border-t pt-4 text-xs text-gray-500">
          Method: local basket association rules. Historical affinity is not a
          guaranteed sales increase. Verify prices, tax basis, other promotions
          and dates before creating an offer.
        </p>
      </div>
    </Modal>
  );
}
