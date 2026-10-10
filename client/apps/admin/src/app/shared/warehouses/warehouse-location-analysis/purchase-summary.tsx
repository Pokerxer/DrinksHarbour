import type { PurchaseTotals } from '@/services/warehouseHistory.service';
const fields = [
  ['Total received', 'receivedQuantity', 'receivedValue'],
  ['Total returned', 'returnedQuantity', 'returnedValue'],
  ['Total purchased after returns', 'netReceivedQuantity', 'netReceivedValue'],
] as const;
export default function PurchaseSummary({ summary, scope = 'this warehouse' }: { summary: PurchaseTotals; scope?: string }) {
  return (
    <section aria-label="Purchase and return totals" className="space-y-3">
      <p className="text-xs leading-relaxed text-gray-500">
        All matching purchases, across every page. Only receipts and applied returns at {scope} are counted. Total purchased after returns = received − returned. Receipt values
        use saved purchase line costs and tax; return values use saved return lines. These are goods
        values, not cash refunds or current stock. Date filters select purchase creation dates;
        returns are cumulative, including later returns.
      </p>
      {summary.currencies.length ? (
        <div className="overflow-x-auto rounded-xl border border-[#ece4d6] bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <caption className="px-4 py-3 text-left font-semibold text-[#65594e]">
              All matching purchases
            </caption>
            <thead className="bg-[#f8f5f0] text-[#8b7a6b]">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Currency
                </th>
                {fields.map(([label]) => (
                  <th scope="col" key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.currencies.map((row) => (
                <tr key={row.currency}>
                  <th scope="row" className="px-4 py-4 font-medium">
                    {row.currency}
                  </th>
                  {fields.map(([label, quantity, value]) => (
                    <td key={label} className="px-4 py-4 tabular-nums">
                      <div className="text-lg font-semibold text-[#2a2420]">
                        {row[quantity].toLocaleString()} units
                      </div>
                      <div className="mt-1 whitespace-nowrap text-xs text-gray-500">
                        {row.currency}{' '}
                        {row[value].toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No purchases match these filters.</p>
      )}
    </section>
  );
}
