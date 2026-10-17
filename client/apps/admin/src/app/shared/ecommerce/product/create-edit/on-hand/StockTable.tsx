import type { StockRow } from './stock-report';
export default function StockTable({ rows }: { rows: StockRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[920px] text-left text-sm">
        <caption className="sr-only">
          On-hand stock by tenant listing and size
        </caption>
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            {[
              'Tenant',
              'SKU',
              'Size',
              'On hand',
              'Reserved',
              'Available',
              'Availability',
              'Listing status',
            ].map((label) => (
              <th
                key={label}
                scope="col"
                className={`px-4 py-3 font-medium ${['On hand', 'Reserved', 'Available'].includes(label) ? 'text-right' : ''}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-gray-50/60">
              <th scope="row" className="px-4 py-4 font-medium text-gray-900">
                {row.tenant}
              </th>
              <td className="px-4 py-4 font-mono text-xs text-gray-500">
                {row.sku}
              </td>
              <td className="px-4 py-4 text-gray-700">{row.size}</td>
              {(['quantity', 'reserved', 'available'] as const).map((key) => (
                <td
                  key={key}
                  className="px-4 py-4 text-right font-semibold tabular-nums text-gray-900"
                >
                  {row[key] === null ? (
                    <span title="Quantity not supplied">—</span>
                  ) : (
                    row[key].toLocaleString('en-NG')
                  )}
                </td>
              ))}
              <td className="px-4 py-4">
                <span
                  className={`rounded-full px-2 py-1 text-xs capitalize ${row.quantity === 0 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {row.availability}
                </span>
              </td>
              <td className="px-4 py-4 capitalize text-gray-500">
                {row.listingStatus}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
