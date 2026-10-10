import type { InsightLine } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
export default function WarehouseDemandBreakdown({
  line,
}: {
  line: InsightLine;
}) {
  if (
    (!line.demandBasis || line.demandBasis === 'sales') &&
    line.transferDataStatus !== 'incomplete'
  )
    return null;
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <p className="text-sm font-semibold text-blue-950">
        Sales + transfers out · 30 days
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-blue-900">
        <p>
          Customer sales
          <span className="mt-1 block text-lg font-semibold">
            {units(line.units30)}
          </span>
        </p>
        <p>
          Net transfers out
          <span className="mt-1 block text-lg font-semibold">
            {line.transferDataStatus === 'incomplete'
              ? 'Needs history'
              : units(line.transferUnits30)}
          </span>
        </p>
        <p>
          Total demand
          <span className="mt-1 block text-lg font-semibold">
            {units(line.demandUnits30)}
          </span>
        </p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-blue-800">
        Posted transfers out are treated as demand for this warehouse’s minimum
        and forecast. Units returned to the source are deducted. Unposted
        commitments are tracked separately.
      </p>
    </div>
  );
}
