import { fmtAmt } from '@/utils/print/print-shared';
import {
  buildPriceColumnGrid,
  type PriceColumn,
} from './inventory-pricelist-columns';
import type { PricableStockLine } from './inventory-pricelist-print';
export default function PricelistPreview({
  rows,
  columns,
  discountPercent,
  ready,
}: {
  rows: PricableStockLine[];
  columns: PriceColumn[];
  discountPercent: number;
  ready: boolean;
}) {
  if (!ready)
    return (
      <p className="text-xs text-gray-500">
        The price preview will appear once all selected rules and products are
        loaded.
      </p>
    );
  if (!rows.length || !columns.length) return null;
  const grid = buildPriceColumnGrid(rows, columns, discountPercent);
  const missing = grid.rows.reduce(
    (n, row) => n + row.prices.filter((p) => p.price == null).length,
    0
  );
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-700">
        Price preview · {grid.rows.length} product sizes
      </h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Product / Size</th>
              {columns.map((c, i) => (
                <th key={i} className="p-2 text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.slice(0, 5).map(({ line, prices }) => (
              <tr
                key={`${line.subProductId}:${line.sizeId}`}
                className="border-t border-gray-100"
              >
                <td className="p-2">
                  {line.productName}
                  <span className="block text-gray-500">{line.sizeName}</span>
                </td>
                {prices.map((q, i) => (
                  <td key={i} className="whitespace-nowrap p-2 text-right">
                    {q.price == null
                      ? '—'
                      : fmtAmt(
                          q.price,
                          columns[i].pricelist?.currency || 'NGN'
                        )}
                    {q.note && q.note !== 'Saved wholesale price' && (
                      <span className="block max-w-44 whitespace-normal text-[10px] text-amber-700">
                        {q.note}
                      </span>
                    )}
                    {q.quantity && (
                      <span className="block text-[10px] text-gray-500">
                        {q.quantity} units
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grid.rows.length > 5 && (
        <p className="text-[11px] text-gray-500">
          Showing the first 5 rows. Export includes all {grid.rows.length} rows.
        </p>
      )}
      {grid.rows.some((row) =>
        row.prices.some((q) => q.note === 'Saved wholesale price')
      ) && (
        <p className="text-xs text-amber-700">
          Products without a matching pricelist rule use their saved wholesale price.
        </p>
      )}
      {missing > 0 && (
        <p className="text-xs text-amber-700">
          {missing} prices are unavailable. Those cells export as “—”; check the
          bundle rule, pack quantity and cost/wholesale price.
        </p>
      )}
    </section>
  );
}
