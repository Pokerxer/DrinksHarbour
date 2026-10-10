import { PiArrowUpRight, PiMapPin } from 'react-icons/pi';
import type { InsightLine } from '@/services/notificationInsights.service';
import ProductImage from '../warehouses/warehouse-product-image';
import { units } from '../insights/presentation';
import { reviewForecast } from './forecast-rules';
const fits = {
  good: 'Good recent fit',
  mixed: 'Mixed recent fit',
  weak: 'Weak recent fit',
  unvalidated: 'Not validated yet',
  unavailable: 'History needed',
};
export default function ForecastProductCard({
  line,
  days,
  stock,
  asOf,
  onOpen,
}: {
  line: InsightLine;
  days: number;
  stock: boolean;
  asOf?: string;
  onOpen: () => void;
}) {
  const r = reviewForecast(line, days, asOf);
  const attention = stock && r.attention;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`View ${line.productName} ${line.sizeName} at ${line.warehouseName} forecast details`}
      className={`group flex h-full w-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${attention ? 'border-amber-200' : 'border-gray-200'}`}
    >
      <span className="flex w-full items-start gap-3">
        <ProductImage src={line.productImage} name={line.productName} />
        <span className="min-w-0 flex-1">
          <span
            role="heading"
            aria-level={3}
            className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900"
          >
            {line.productName}{' '}
            <span className="font-normal text-gray-500">{line.sizeName}</span>
          </span>
          <span className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <PiMapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{line.warehouseName}</span>
          </span>
          <span
            className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.fit === 'good' ? 'bg-emerald-50 text-emerald-800' : r.fit === 'weak' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {fits[r.fit]}
          </span>
        </span>
      </span>
      <span className="mt-4 grid w-full grid-cols-2 gap-3 border-t border-gray-100 pt-3">
        <span>
          <span className="block text-[11px] text-gray-500">
            Expected next {days} days
          </span>
          <span className="mt-1 block text-lg font-semibold tabular-nums text-gray-900">
            {r.demand === null ? 'History needed' : `${units(r.demand)} units`}
          </span>
        </span>
        {stock && !line.summary && (
          <span>
            <span className="block text-[11px] text-gray-500">
              Forecast shortfall
            </span>
            <span
              className={`mt-1 block text-lg font-semibold tabular-nums ${attention ? 'text-amber-800' : 'text-gray-900'}`}
            >
              {r.shortfall === null
                ? 'Needs review'
                : `${units(r.shortfall)} units`}
            </span>
          </span>
        )}
      </span>
      <span className="mt-3 inline-flex items-center gap-1 self-end text-xs font-semibold text-primary">
        View details{' '}
        <PiArrowUpRight
          aria-hidden
          className="h-4 w-4 transition group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}
