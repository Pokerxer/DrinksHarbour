import type { InsightLine } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
import { hasForecast, localCover } from './warehouse-rules';
export default function WarehouseProductMetrics({
  line,
}: {
  line: InsightLine;
}) {
  const includesTransfers =
    (line.demandBasis && line.demandBasis !== 'sales') ||
    (line.transferUnits30 ?? 0) > 0 ||
    line.transferDataStatus === 'incomplete';
  const movement =
    line.demandUnits30 !== undefined ? line.demandUnits30 : line.units30;
  const demandKnown =
    line.transferDataStatus !== 'incomplete' &&
    typeof movement === 'number' &&
    Number.isFinite(movement);
  const stockKnown =
    typeof line.available === 'number' && Number.isFinite(line.available);
  const depleted = stockKnown && line.available! <= 0;
  const incoming =
    line.incoming?.reduce((n, s) => n + Math.max(0, s.quantity), 0) || 0;
  const demandDetail = demandKnown
    ? movement === 0
      ? includesTransfers
        ? 'No sales or transfers out recorded in the last 30 days'
        : 'No sales recorded in the last 30 days'
      : `${units(movement! / 30)} units/day · ${includesTransfers ? 'customer sales + net transfers out' : 'recorded net sales'}`
    : line.salesDataStatus === 'incomplete_location'
      ? `${units(line.recordedUnits30)} units assigned here; other sales have no confirmed location`
      : line.transferDataStatus === 'incomplete'
        ? 'Some posted transfers are missing reliable dates or quantities'
        : 'Some fulfilled sales are missing reliable dates or quantities';
  return (
    <dl className="grid divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div className="p-4">
        <dt className="text-xs font-medium text-gray-500">
          {includesTransfers
            ? 'Stock movement · 30 days'
            : 'Sold here · 30 days'}
        </dt>
        <dd className="mt-2 text-lg font-semibold tabular-nums text-gray-900">
          {demandKnown ? (
            <>
              {units(movement)}{' '}
              <span className="text-xs font-normal text-gray-500">units</span>
            </>
          ) : line.salesDataStatus === 'incomplete_location' ? (
            'Needs location data'
          ) : includesTransfers ? (
            'Demand data incomplete'
          ) : (
            'Sales data incomplete'
          )}
        </dd>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          {demandDetail}
        </p>
      </div>
      <div className="p-4">
        <dt className="text-xs font-medium text-gray-500">Stock cover</dt>
        <dd className="mt-2 text-lg font-semibold text-gray-900">
          {!stockKnown
            ? 'Verify balance'
            : depleted
              ? 'Depleted'
              : hasForecast(line)
                ? localCover(line)
                : 'Not enough history'}
        </dd>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          {depleted
            ? 'Replenishment is needed now'
            : !stockKnown
              ? 'Check this warehouse’s stock record'
              : hasForecast(line)
                ? 'Based on recorded demand and commitments'
                : `${line.forecast?.historyDays || 0} recorded days · 28 needed for a baseline`}
        </p>
      </div>
      <div className="p-4">
        <dt className="text-xs font-medium text-gray-500">
          Incoming to this location
        </dt>
        <dd className="mt-2 text-lg font-semibold tabular-nums text-gray-900">
          {units(incoming)}{' '}
          <span className="text-xs font-normal text-gray-500">units</span>
        </dd>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          {incoming
            ? 'Pending supply · receipt still required'
            : 'No confirmed incoming supply recorded'}
        </p>
      </div>
    </dl>
  );
}
