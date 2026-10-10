import Link from 'next/link';
import type {
  InsightLine,
  SupplierOffer,
} from '@/services/notificationInsights.service';
import { validQuantity } from '../vendor-orders/order-draft';
import { units } from '../insights/presentation';
import { performanceLink } from '../performance/performance-rules';
export default function RestockRecommendation({
  line,
  offer,
  quantity = offer?.quantity ?? 0,
  stock = true,
  demand = true,
}: {
  line: InsightLine;
  offer?: SupplierOffer | null;
  quantity?: number;
  stock?: boolean;
  demand?: boolean;
}) {
  const p = stock && demand ? offer?.replenishment : undefined;
  const valid = !!offer && validQuantity(quantity, offer);
  const t = stock ? line.transferPlan : undefined;
  return (
    <div className="mt-4 space-y-3">
      {valid &&
        quantity > 0 &&
        offer?.suggestedUnits != null &&
        quantity < offer.suggestedUnits && (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            This order is {units(offer.suggestedUnits - quantity)} units below
            the calculated requirement. Review another supply source or the risk
            of running short.
          </p>
        )}
      {p?.manualReviewReason && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {p.manualReviewReason} Known warehouse figures remain below;
          demand-dependent quantities are unavailable.
        </p>
      )}
      {p && (
        <dl className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs sm:grid-cols-3">
          {[
            ['Demand through delivery + cover', p.forecastUnits],
            ['Forecast demand after delivery', p.forecastAfterDeliveryUnits],
            ['After outgoing commitments', p.availableAfterCommitments],
            ['Timely incoming units', p.incomingUnits],
            ['Safety reserve', p.safetyUnits],
            ['Minimum target at delivery', p.minimumTargetUnits],
            ['Ending balance before this order', p.projectedEndingUnits],
            ['Required units before packs', offer?.suggestedUnits ?? null],
            [
              'Units above forecast requirement',
              valid && offer?.suggestedUnits != null
                ? Math.max(0, quantity - offer.suggestedUnits)
                : null,
            ],
            [
              'Ending balance after reviewed order',
              valid && p.projectedEndingUnits != null
                ? p.projectedEndingUnits + quantity
                : null,
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="mt-1 font-semibold text-gray-900">
                {typeof value === 'number' && Number.isFinite(value)
                  ? `${units(value)} units`
                  : 'Unavailable'}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {p &&
        p.shortfallBeforeDelivery !== null &&
        p.shortfallBeforeDelivery > 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {units(p.shortfallBeforeDelivery)} units may run short before the
            supplier can arrive. Review an earlier delivery or internal
            transfer; this order cannot cover the earlier gap.
          </p>
        )}
      {p && p.forecastAfterDeliveryUnits != null && (
        <p className="text-xs text-gray-500">
          Missed sales before delivery are excluded from this order. Required
          units cover demand after arrival, outstanding commitments and the
          applicable stock reserve before rounding to supplier packs and
          minimums.
        </p>
      )}
      {p && (
        <p className="text-xs text-gray-500">
          {p.horizonDays}-day delivery + cover horizon
          {p.deliveryDate &&
            ` · Estimated delivery ${new Date(p.deliveryDate).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' })}`}
          .
          {p.excludedIncomingUnits > 0 &&
            ` ${units(p.excludedIncomingUnits)} incoming units excluded from timed supply (overdue, undated or outside this horizon).`}{' '}
          Arrivals count on their Lagos calendar day; confirm delivery times.
        </p>
      )}
      {t &&
        ['follow_up', 'approval_review', 'transfer_review'].includes(
          t.nextStep
        ) && (
          <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            {t.nextStep === 'approval_review'
              ? 'A transfer awaits approval.'
              : t.nextStep === 'transfer_review'
                ? `${units(t.additionalUnits - t.uncoveredUnits)} units could come from other warehouses.`
                : `${units(t.pendingUnits)} transfer units await receipt.`}{' '}
            Review transfers before placing a supplier order.
          </p>
        )}
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-primary">
        {stock && (
          <Link href={performanceLink('/notifications/warehouses', line)}>
            Review warehouse supply →
          </Link>
        )}
        {demand && (
          <Link href={performanceLink('/notifications/forecasts', line)}>
            Review demand forecast →
          </Link>
        )}
      </div>
    </div>
  );
}
