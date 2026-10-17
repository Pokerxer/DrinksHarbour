import type { CustomerReturn } from '@/services/customerReturns.service';
import {
  returnDestination,
  returnQuantity,
  returnStatus,
} from './customer-return-status';
function Badge({ row }: { row: CustomerReturn }) {
  const status = returnStatus(row);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status.color}`}
    >
      {status.label}
    </span>
  );
}
export default function CustomerReturnList({
  rows,
  onSelect,
}: {
  rows: CustomerReturn[];
  onSelect: (row: CustomerReturn) => void;
}) {
  const open = (row: CustomerReturn) => (
    <button
      type="button"
      aria-label={`View ${row.reference || row.sourceNumber}`}
      onClick={() => onSelect(row)}
      className="font-semibold text-brand hover:underline"
    >
      {row.reference || row.sourceNumber}
    </button>
  );
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Customer return history</caption>
          <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
            <tr>
              {[
                'Return / source',
                'Product',
                'Returned',
                'Restocked',
                'Not restocked',
                'Disposition',
                'Destination',
              ].map((label) => (
                <th key={label} className="px-4 py-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 hover:bg-gray-50/50"
              >
                <td className="px-4 py-4">
                  {open(row)}
                  <p className="mt-1 text-xs text-gray-500">
                    {row.source.toUpperCase()} · {row.sourceNumber}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-gray-900">{row.product}</p>
                  <p className="mt-1 text-xs text-gray-500">{row.size}</p>
                </td>
                <td className="px-4 py-4 font-semibold tabular-nums">
                  {returnQuantity(row.returned)}
                </td>
                <td className="px-4 py-4 tabular-nums">
                  {returnQuantity(row.restocked)}
                </td>
                <td className="px-4 py-4 tabular-nums">
                  {returnQuantity(row.notRestocked)}
                </td>
                <td className="px-4 py-4">
                  <Badge row={row} />
                </td>
                <td className="px-4 py-4 text-gray-500">
                  {returnDestination(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-gray-100 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {open(row)}
              <Badge row={row} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{row.product}</p>
              <p className="text-xs text-gray-500">
                {row.size} · {row.source.toUpperCase()} · {row.sourceNumber}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              {[
                ['Returned', row.returned],
                ['Restocked', row.restocked],
                ['Not restocked', row.notRestocked],
              ].map(([label, qty]) => (
                <div key={String(label)}>
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {returnQuantity(qty as number | null)}
                  </dd>
                </div>
              ))}
            </dl>
            {(row.warehouse || row.destinations?.length) && (
              <p className="text-xs text-gray-500">
                Destination: {returnDestination(row)}
              </p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
