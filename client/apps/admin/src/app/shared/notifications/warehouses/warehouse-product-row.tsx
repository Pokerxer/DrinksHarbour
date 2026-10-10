'use client';
import { PiArrowUpRight, PiMapPin } from 'react-icons/pi';
import type { InsightLine } from '@/services/notificationInsights.service';
import { units } from '../insights/presentation';
import { statusOf, statusLabels } from './warehouse-rules';
import WarehouseProductImage from './warehouse-product-image';
export default function WarehouseProductRow({
  line,
  onOpen,
}: {
  line: InsightLine;
  onOpen: () => void;
}) {
  const status = statusOf(line),
    critical = status === 'out',
    warning = status === 'low' || status === 'risk';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`View ${line.productName} ${line.sizeName} at ${line.warehouseName} details`}
      className={`group flex h-full w-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202] focus-visible:ring-offset-2 ${critical ? 'border-red-200' : warning ? 'border-amber-200' : 'border-gray-200'}`}
    >
      <span className="flex w-full items-start gap-3">
        <WarehouseProductImage
          src={line.productImage}
          name={line.productName}
        />
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
            className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${critical ? 'bg-red-50 text-red-700' : warning ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {statusLabels[status]}
          </span>
        </span>
      </span>
      <span className="mt-4 flex w-full items-end justify-between gap-3 border-t border-gray-100 pt-3">
        <span>
          <span className="block text-[11px] text-gray-500">
            Available / minimum
          </span>
          <span
            className={`mt-1 block text-lg font-semibold tabular-nums ${critical ? 'text-red-700' : 'text-gray-900'}`}
          >
            {units(line.available)}{' '}
            <span className="text-sm font-normal text-gray-400">
              / {units(line.threshold)} units
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#b20202]">
          View details{' '}
          <PiArrowUpRight
            aria-hidden
            className="h-4 w-4 transition group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </button>
  );
}
