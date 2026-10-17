import type { SaleRow } from './sales-report';
const number = (n: number) => n.toLocaleString('en-NG');
const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const time = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
export default function SalesTable({ rows }: { rows: SaleRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <caption className="sr-only">
          Product sales, buyers and returned quantities. Dates and times are in Lagos
          time.
        </caption>
        <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
          <tr>
            {[
              'Sale date · Lagos',
              'Buyer',
              'Reference / channel',
              'Tenant / size',
              'Sold',
              'Returned',
              'Net sold',
            ].map((label, i) => (
              <th
                scope="col"
                key={label}
                className={`px-4 py-3 font-medium ${i >= 4 ? 'text-right' : ''}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-gray-50/70">
              <td className="whitespace-nowrap px-4 py-4">
                {row.soldAt ? (
                  <>
                    <div className="font-medium text-gray-900">
                      {date.format(new Date(row.soldAt))}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {time.format(new Date(row.soldAt))}
                    </div>
                  </>
                ) : (
                  <span className="text-amber-700">Date unavailable</span>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  {row.dateBasis}
                  {row.dateBasis === 'Recorded' ? ' · payment time unavailable' : ''}
                </div>
              </td>
              <td className="max-w-60 break-words px-4 py-4">
                <div className="font-medium text-gray-900">{row.buyer}</div>
                {row.buyerId && (
                  <div title={row.buyerId} className="mt-1 text-xs text-gray-500">
                    Customer ID · {row.buyerId.slice(-8)}
                  </div>
                )}
              </td>
              <td className="max-w-60 break-words px-4 py-4">
                <div className="font-medium text-gray-900">{row.reference}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {row.source} · {row.status.replaceAll('_', ' ')}
                </div>
              </td>
              <td className="max-w-60 break-words px-4 py-4">
                <div>{row.tenant}</div>
                <div className="mt-1 text-xs text-gray-500">{row.size}</div>
              </td>
              <td className="px-4 py-4 text-right tabular-nums">
                {number(row.gross)}
              </td>
              <td
                className={`px-4 py-4 text-right tabular-nums ${row.returned ? 'text-amber-700' : 'text-gray-400'}`}
              >
                {number(row.returned)}
              </td>
              <td className="px-4 py-4 text-right font-semibold tabular-nums text-gray-900">
                {number(row.net)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
