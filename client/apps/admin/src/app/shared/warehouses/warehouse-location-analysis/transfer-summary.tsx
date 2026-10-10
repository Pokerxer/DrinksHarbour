import Link from 'next/link';
import { routes } from '@/config/routes';
import type { TransferTotals, TransferTotalsRow } from '@/services/warehouseHistory.service';
const money = (value: number, currency: string) =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fields = [
  ['Transferred out', 'outgoingQuantity', 'outgoingValue'],
  ['Transfers received', 'incomingQuantity', 'incomingValue'],
  ['Returned to other warehouses', 'returnedOutQuantity', 'returnedOutValue'],
  ['Returns received', 'returnedInQuantity', 'returnedInValue'],
] as const;
export default function TransferSummary({ summary }: { summary: TransferTotals }) {
  const groups = (summary.kind === 'documents' ? summary.currencies : [summary]).map((row) => ({
    ...row,
    netIncomingQuantity: row.netIncomingQuantity ?? row.incomingQuantity - row.returnedOutQuantity,
    netOutgoingQuantity: row.netOutgoingQuantity ?? row.outgoingQuantity - row.returnedInQuantity,
  }));
  return (
    <section aria-label="Transfer and return totals" className="space-y-4">
      <div>
        <h3 className="font-semibold text-[#65594e]">Transfer and return totals</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          All matching records, across every page. Total transferred in = sum of receipts − returns
          sent back. Total transferred out = sum of transfers out − returns received back.{' '}
          {summary.kind === 'documents'
            ? 'Values cover sent/received transfer documents. Quantities show actual shipments/receipts; partial receipts can differ from document value. Returns are cumulative on matching transfers, including returns recorded after the selected transfer date range.'
            : 'Stock movement quantities. Monetary values were not reliably recorded for these movements; choose Transfer documents to see document values.'}
        </p>
      </div>
      {!groups.length && (
        <p className="text-sm text-gray-500">No sent or received transfers match these filters.</p>
      )}
      {!!groups.length && (
        <div className="overflow-x-auto rounded-xl border border-[#ece4d6] bg-white">
          <table className="w-full min-w-[500px] text-left text-sm">
            <caption className="px-4 py-3 text-left font-semibold text-[#65594e]">
              All matching transfers
            </caption>
            <thead className="bg-[#f8f5f0] text-[#8b7a6b]">
              <tr>
                {['Scope', 'Total transferred in', 'Total transferred out'].map((label) => (
                  <th scope="col" key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((row, index) => (
                <tr key={index}>
                  <th scope="row" className="px-4 py-4 font-medium">
                    All warehouses{'currency' in row ? ` · ${row.currency}` : ''}
                  </th>
                  {(['Incoming', 'Outgoing'] as const).map((direction) => (
                    <td key={direction} className="px-4 py-4 tabular-nums">
                      <div className="text-lg font-semibold text-[#2a2420]">
                        {row[`net${direction}Quantity`].toLocaleString()} units
                      </div>
                      {'currency' in row && (
                        <div className="mt-1 text-xs text-gray-500">
                          {money(row[`net${direction}Value`], row.currency)}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {groups.map((row, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {fields.map(([label, quantity, value]) => (
            <div key={label} className="rounded-xl border border-[#ece4d6] bg-[#fcfaf7] p-4">
              <p className="text-xs font-medium text-[#8b7a6b]">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-[#2a2420]">
                {'currency' in row
                  ? money(row[value], row.currency)
                  : row[quantity].toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">{row[quantity].toLocaleString()} units</p>
            </div>
          ))}
        </div>
      ))}
      {summary.kind === 'documents' && !!summary.pairs.length && (
        <div className="overflow-x-auto rounded-xl border border-[#ece4d6] bg-white">
          <table className="w-full min-w-[850px] text-left text-xs">
            <caption className="px-4 py-3 text-left text-sm font-semibold text-[#65594e]">
              Between warehouses · currencies kept separate
            </caption>
            <thead className="bg-[#f8f5f0] text-[#8b7a6b]">
              <tr>
                {[
                  'Other warehouse',
                  'Transferred out',
                  'Received',
                  'Returned out',
                  'Returns received',
                  'Transferred in after returns',
                  'Transferred out after returns',
                ].map((label) => (
                  <th scope="col" key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.pairs.map((row) => (
                <tr key={`${row.warehouseId}:${row.currency}`}>
                  <td className="px-4 py-3">
                    {row.warehouseId ? (
                      <Link
                        href={routes.warehouses.locationAnalysis(row.warehouseId)}
                        className="font-semibold text-[#b20202] hover:underline"
                      >
                        {row.warehouseName}
                      </Link>
                    ) : (
                      <span>{row.warehouseName}</span>
                    )}
                  </td>
                  {(['outgoing', 'incoming', 'returnedOut', 'returnedIn'] as const).map(
                    (prefix) => (
                      <td key={prefix} className="whitespace-nowrap px-4 py-3 tabular-nums">
                        {money(
                          row[`${prefix}Value` as keyof TransferTotalsRow] as number,
                          row.currency,
                        )}
                        <div className="mt-1 text-gray-400">
                          {(
                            row[`${prefix}Quantity` as keyof TransferTotalsRow] as number
                          ).toLocaleString()}{' '}
                          units
                        </div>
                      </td>
                    ),
                  )}
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {money(row.netIncomingValue, row.currency)}
                    <div className="mt-1 text-gray-400">
                      {(
                        row.netIncomingQuantity ?? row.incomingQuantity - row.returnedOutQuantity
                      ).toLocaleString()}{' '}
                      units
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {money(row.netOutgoingValue, row.currency)}
                    <div className="mt-1 text-gray-400">
                      {(
                        row.netOutgoingQuantity ?? row.outgoingQuantity - row.returnedInQuantity
                      ).toLocaleString()}{' '}
                      units
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
