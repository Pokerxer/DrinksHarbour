import Link from 'next/link';
import type { StockRow } from '@/services/warehouseStock.service';
import { routes } from '@/config/routes';
import { finite } from './inventory-dashboard-analysis';
export default function ValuationNote({ rows }: { rows: StockRow[] }) {
  const estimated = rows.filter((row) => finite(row.estimatedQuantity) > 0).length;
  const unpriced = rows.filter(
    (row) =>
      finite(row.unpricedQuantity) > 0 ||
      (row.unpricedQuantity === undefined && row.currentQuantity !== 0 && !finite(row.costPrice)),
  ).length;
  const mismatch = rows.filter((row) => row.batchQuantityMismatch).length;
  return (
    <section
      aria-label="Valuation basis"
      className="border-b border-gray-200 bg-white px-4 py-3 text-[11px] leading-relaxed text-gray-500 sm:px-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-4xl">
          <strong className="text-gray-700">On-hand cost value</strong> includes reserved units.
          FIFO values the remaining cost layers; average uses weighted batch costs. Average carrying
          cost is total value divided by on-hand units. Selling value is shown separately.
        </p>
        <Link
          href={routes.warehouses.settings}
          className="shrink-0 font-semibold text-[#b20202] hover:underline"
        >
          Valuation settings →
        </Link>
      </div>
      {(estimated > 0 || unpriced > 0 || mismatch > 0) && (
        <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          {estimated} {estimated === 1 ? 'line includes' : 'lines include'} estimates · {unpriced}{' '}
          lines have units without a known cost · {mismatch} lines have batch quantities that differ
          from on-hand. Estimates use saved standard costs; negative stock retains a signed
          estimate. Review these lines before relying on the total.
        </p>
      )}
    </section>
  );
}
