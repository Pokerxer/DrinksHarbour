import Link from 'next/link';
import type { InsightLine } from '@/services/notificationInsights.service';
import InsightEvidence from './insight-evidence';
import { formatCover, methodLabel, units } from './presentation';
export default function InsightProductCard({
  line,
  mode,
  stock,
  demand,
  purchase,
}: {
  line: InsightLine;
  mode: 'stock' | 'warehouses' | 'forecasts';
  stock: boolean;
  demand: boolean;
  purchase: boolean;
}) {
  return (
    <article className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900">
            {line.productName}{' '}
            <span className="text-sm font-normal text-gray-500">
              {line.sizeName}
            </span>
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {line.warehouseName}
            {line.sku && ` · ${line.sku}`}
          </p>
        </div>
        {line.urgency && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${line.urgency === 'urgent' ? 'bg-red-50 text-red-700' : line.urgency === 'high' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {line.urgency}
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
        {stock && (
          <div>
            <dt className="text-xs text-gray-500">Available</dt>
            <dd className="mt-1 font-bold">{units(line.available)} units</dd>
          </div>
        )}
        {demand && (
          <>
            <div>
              <dt className="text-xs text-gray-500">Net sold · past 30 days</dt>
              <dd className="mt-1 font-bold">{units(line.units30)} units</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Sales speed</dt>
              <dd className="mt-1 font-bold">
                {units(line.dailySales)} units/day
              </dd>
            </div>
            {
              <div>
                <dt className="text-xs text-gray-500">
                  {mode === 'forecasts'
                    ? 'Expected next 30 days'
                    : 'Stock cover'}
                </dt>
                <dd className="mt-1 font-bold">
                  {mode === 'forecasts'
                    ? `${units(line.forecast?.demand30)} units`
                    : line.forecast?.method === 'insufficient_history'
                      ? 'Unknown'
                      : formatCover(line.daysOfCover)}
                </dd>
              </div>
            }
          </>
        )}
      </dl>
      {line.forecast && (
        <p className="mt-3 text-xs text-indigo-700">
          {methodLabel(line.forecast.method)}
          {line.forecast.model && ` · ${line.forecast.model}`}
        </p>
      )}
      {line.periodUnits !== undefined && (
        <p className="mt-3 text-sm text-gray-600">
          Net sold · selected period:{' '}
          <strong>{units(line.periodUnits)} units</strong>
        </p>
      )}
      <InsightEvidence line={line} />
      {purchase && (
        <Link
          href={`/notifications/restock?subProductId=${line.subProductId}&sizeId=${line.sizeId}${line.warehouseId ? `&warehouseId=${line.warehouseId}` : ''}`}
          className="mt-3 inline-block text-xs font-bold text-[#b20202]"
        >
          Review restock →
        </Link>
      )}
    </article>
  );
}
