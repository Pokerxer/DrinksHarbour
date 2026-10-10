import Link from 'next/link';
import WarehouseMinimumPolicy from './warehouse-minimum-policy';
import { PiArrowRight, PiPackage } from 'react-icons/pi';
import type { InsightLine } from '@/services/notificationInsights.service';
import InsightEvidence from '../insights/insight-evidence';
import { units } from '../insights/presentation';
import {
  hasForecast,
  localCover,
  statusOf,
  statusLabels,
} from './warehouse-rules';
import WarehouseTransferPanel from './warehouse-transfer-panel';
import WarehouseProductMetrics from './warehouse-product-metrics';
import WarehouseDemandBreakdown from './warehouse-demand-breakdown';
import { transferPreparationHref } from './warehouse-transfer-links';
export default function WarehouseProductDetails({
  line,
  demand,
  purchase,
  manageTransfers = false,
  coverDays = 14,
}: {
  line: InsightLine;
  demand: boolean;
  purchase: boolean;
  manageTransfers?: boolean;
  coverDays?: number;
}) {
  const status = statusOf(line),
    critical = status === 'out',
    warning = status === 'low' || status === 'risk';
  const reason = critical
    ? line.available! < 0
      ? 'The stock balance is negative. Verify it and review replenishment.'
      : 'This warehouse has no available stock. Review internal supply before ordering.'
    : status === 'low'
      ? `Stock has reached the minimum of ${units(line.threshold)} units.`
      : status === 'risk'
        ? (line.transferPlan?.outboundUnits || 0) > 0
          ? `Outgoing commitments leave ${units(line.transferPlan?.availableAfterCommitments)} units. Review the allocation.`
          : `Recorded demand suggests stock could run out in ${localCover(line).toLowerCase()}.`
        : status === 'unknown'
          ? 'Verify the local stock record before preparing replenishment.'
          : 'Stock is above its current minimum.';
  const query = new URLSearchParams({ subProductId: line.subProductId });
  if (line.sizeId) query.set('sizeId', line.sizeId);
  if (line.warehouseId) query.set('warehouseId', line.warehouseId);
  const source = line.transferPlan?.sources[0];
  const sourceAction = manageTransfers && source && line.warehouseId;
  const stockKnown =
    typeof line.available === 'number' && Number.isFinite(line.available);
  const progress =
    stockKnown && line.threshold! > 0
      ? Math.min(100, Math.max(0, (line.available! / line.threshold!) * 100))
      : 0;
  return (
    <div className="space-y-4 p-5">
      <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
        <div>
          <p className="text-xs font-medium text-gray-500">Available now</p>
          <p
            className={`mt-1 text-4xl font-semibold tabular-nums tracking-tight ${critical ? 'text-red-700' : 'text-gray-900'}`}
          >
            {stockKnown ? units(line.available) : '—'}{' '}
            <span className="text-xs font-normal tracking-normal text-gray-500">
              {stockKnown ? 'units' : 'Verify balance'}
            </span>
          </p>
          <div
            aria-hidden
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"
          >
            <div
              style={{ width: `${progress}%` }}
              className={`h-full rounded-full ${critical ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-emerald-500'}`}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Minimum {units(line.threshold)} units
          </p>
        </div>
        <div
          className={`rounded-xl px-4 py-3 ${critical ? 'bg-red-50' : warning ? 'bg-amber-50' : 'bg-gray-50'}`}
        >
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
            <PiPackage aria-hidden className="h-4 w-4" />
            {critical
              ? 'Replenishment needed'
              : status === 'unknown'
                ? 'Stock verification needed'
                : source
                  ? 'Internal stock available'
                  : 'Stock position'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{reason}</p>
          {source && (
            <p className="mt-2 text-xs font-semibold text-blue-800">
              {source.sourceWarehouseName} can supply{' '}
              {units(source.recommendedUnits)} units after protecting its own
              reserve.
            </p>
          )}
        </div>
      </div>
      {line.minimumPolicy && (
        <WarehouseMinimumPolicy policy={line.minimumPolicy} demand={demand} />
      )}
      {demand && <WarehouseDemandBreakdown line={line} />}
      {demand && <WarehouseProductMetrics line={line} />}
      {demand && !hasForecast(line) && (
        <p className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-900">
          Forecast not ready.{' '}
          {line.salesDataStatus === 'incomplete_location'
            ? 'Some sales have no reliable warehouse assignment.'
            : line.salesDataStatus === 'incomplete_history'
              ? 'Some fulfilled sales are missing dated records.'
              : line.transferDataStatus === 'incomplete'
                ? 'Some posted transfers are missing reliable dates or quantities.'
                : 'More dated local sales or transfer history is needed.'}{' '}
          Replenishment guidance uses the current stock minimum until a forecast
          is available.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        {sourceAction && (
          <Link
            href={transferPreparationHref(
              line.subProductId,
              line.sizeId,
              line.warehouseId,
              source.sourceWarehouseId,
              source.recommendedUnits,
              coverDays
            )}
            className="inline-flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#900202]"
          >
            Prepare transfer · {units(source.recommendedUnits)} units
            <PiArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        )}
        {purchase && line.warehouseId && status !== 'unknown' && (
          <Link
            href={`/notifications/restock?${query}`}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${sourceAction ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-[#b20202] text-white hover:bg-[#900202]'}`}
          >
            {source || line.transferPlan?.pending.length
              ? 'Review supplier alternative'
              : 'Review restock'}
            <PiArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        )}
        {demand && line.warehouseId && (
          <Link
            href={`/notifications/forecasts?${query}`}
            className="ml-auto inline-flex items-center gap-1.5 px-1 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            {hasForecast(line)
              ? 'View local forecast'
              : line.demandBasis && line.demandBasis !== 'sales'
                ? 'Review demand history'
                : 'Review sales history'}
            <PiArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {line.transferPlan && (
        <WarehouseTransferPanel
          plan={line.transferPlan}
          productId={line.subProductId}
          sizeId={line.sizeId}
          destinationId={line.warehouseId}
          manage={manageTransfers}
          coverDays={coverDays}
        />
      )}
      {demand && <InsightEvidence line={line} compactMissing />}
    </div>
  );
}
