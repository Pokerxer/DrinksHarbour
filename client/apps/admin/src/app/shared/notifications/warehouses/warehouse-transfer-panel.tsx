import Link from 'next/link';
import { transferPreparationHref } from './warehouse-transfer-links';
import WarehouseTransferStatus from './warehouse-transfer-status';
import type { WarehouseTransferPlan } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
const labels = {
  verify_stock: 'Verify stock and transfer receipts',
  monitor: 'Monitor this location',
  approval_review: 'Review transfer approval',
  follow_up: 'Follow up existing transfers',
  transfer_review: 'Review internal replenishment',
  purchase_review: 'Review supplier replenishment',
};
export default function WarehouseTransferPanel({
  plan,
  productId,
  sizeId,
  destinationId,
  manage,
  coverDays,
}: {
  plan: WarehouseTransferPlan;
  productId: string;
  sizeId: string;
  destinationId: string;
  manage: boolean;
  coverDays: number;
}) {
  if (
    plan.nextStep === 'monitor' &&
    !plan.outboundUnits &&
    !plan.pending.length &&
    !plan.outgoing?.length
  )
    return null;
  return (
    <section
      className="mt-4 space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
      aria-label="Transfer replenishment guidance"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-blue-950">
          {labels[plan.nextStep]}
        </h4>
        <span className="text-xs text-blue-800">
          {plan.basis === 'forecast'
            ? 'Sales-based planning target'
            : 'Minimum-stock guidance'}
        </span>
      </div>
      {plan.outboundUnits > 0 && (
        <p className="text-xs text-gray-600">
          {units(plan.outboundUnits)} units committed to outgoing transfers ·{' '}
          {units(plan.availableAfterCommitments)} available after commitments.
          This stock must remain protected.
        </p>
      )}
      {plan.needUnits > 0 && (
        <p className="text-xs text-gray-600">
          Planning target {units(plan.needUnits)} units ·{' '}
          {units(plan.pendingUnits)} already in confirmed/in-flight transfers ·{' '}
          {units(plan.additionalUnits)} additional units to review.
        </p>
      )}
      {!!plan.outgoing?.length && (
        <div className="space-y-2" aria-label="Outgoing transfer follow-ups">
          <h5 className="text-xs font-bold text-blue-950">
            Outgoing transfers
          </h5>
          {plan.outgoing.map((p) => (
            <WarehouseTransferStatus
              key={p.transferId}
              transfer={p}
              outgoing
              manage={manage}
            />
          ))}
        </div>
      )}
      {!!plan.pending.length && (
        <div className="space-y-2" aria-label="Incoming transfer follow-ups">
          <h5 className="text-xs font-bold text-blue-950">
            Incoming transfers
          </h5>
          {plan.pending.map((p) => (
            <WarehouseTransferStatus
              key={p.transferId}
              transfer={p}
              manage={manage}
            />
          ))}
        </div>
      )}
      {!!plan.sources.length && (
        <div className="space-y-2">
          {plan.sources.map((s) => {
            return (
              <div
                key={s.sourceWarehouseId}
                className="rounded-lg border border-blue-100 bg-white p-3"
              >
                <p className="text-xs font-bold text-gray-800">
                  {s.sourceWarehouseName} · review {units(s.recommendedUnits)}{' '}
                  units
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {s.usualSource ? 'Usual source' : 'Alternative source'} ·{' '}
                  {s.deliveries} completed deliveries · {units(s.safeSurplus)}{' '}
                  units safe surplus
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Protect {units(s.protectedUnits)} units for this source and{' '}
                  {units(s.outboundUnits)} already committed to other transfers.
                </p>
                {s.typicalTransitDays !== null && (
                  <p className="mt-1 text-xs text-gray-500">
                    Past transit typically {s.typicalTransitDays} days; confirm
                    dispatch and arrival before relying on this estimate.
                  </p>
                )}
                {s.needsManualReview && (
                  <p className="mt-1 text-xs text-amber-800">
                    Verify source demand and quantity; complete local sales
                    evidence is unavailable.
                  </p>
                )}
                {manage && (
                  <Link
                    className="mt-2 inline-block text-xs font-bold text-blue-800 hover:underline"
                    href={transferPreparationHref(
                      productId,
                      sizeId,
                      destinationId,
                      s.sourceWarehouseId,
                      s.recommendedUnits,
                      coverDays
                    )}
                  >
                    Prepare transfer →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!plan.sources.length && !!plan.usualSources.length && (
        <p className="text-xs text-gray-600">
          Usual source:{' '}
          {plan.usualSources.map((s) => s.sourceWarehouseName).join(', ')}. No
          additional safe transfer allocation is available in this plan; review
          its stock and current commitments.
        </p>
      )}
      {plan.uncoveredUnits > 0 && (
        <p className="text-xs text-amber-800">
          {units(plan.uncoveredUnits)} units remain uncovered by current
          transfers or safe source stock. Review another source or a supplier
          purchase after confirming the transfer position.
        </p>
      )}
      {plan.transfersDisabled && (
        <p className="text-xs text-amber-800">
          New inter-warehouse transfers are disabled in tenant settings.
        </p>
      )}
    </section>
  );
}
