import { salesUnits } from '../insights/list-rules';
import type { InsightLine } from '@/services/notificationInsights.service';
import ProductImage from '../warehouses/warehouse-product-image';
import { units } from '../insights/presentation';
import { trend, type TrendStatus } from './performance-rules';
export const trendStyle: Record<TrendStatus, string> = {
  rising: 'bg-emerald-50 text-emerald-800',
  new: 'bg-emerald-50 text-emerald-800',
  falling: 'bg-amber-50 text-amber-800',
  steady: 'bg-gray-100 text-gray-600',
  no_sales: 'bg-gray-100 text-gray-600',
  incomplete: 'bg-blue-50 text-blue-800',
};
export default function PerformanceProductCard({
  line,
  onOpen,
}: {
  line: InsightLine;
  onOpen: () => void;
}) {
  const change = trend(line);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${line.productName} ${line.sizeName} performance`}
      className="flex w-full items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202]"
    >
      <ProductImage src={line.productImage} name={line.productName} />
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 font-semibold leading-snug text-gray-900">
          {line.productName}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {line.sizeName}
          {line.sku && ` · ${line.sku}`}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-semibold tabular-nums text-gray-900">
            {salesUnits(line) == null
              ? 'Needs history'
              : `${units(salesUnits(line))} units`}
            <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
              {line.periodUnits !== undefined
                ? 'Net sold · selected period'
                : 'Net sold · 30 days'}
            </span>
          </p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${trendStyle[change.status]}`}
          >
            {change.label}
            {change.percent !== null &&
              change.percent !== 0 &&
              ` · ${change.percent > 0 ? '+' : ''}${units(change.percent)}%`}
          </span>
        </div>
      </div>
    </button>
  );
}
