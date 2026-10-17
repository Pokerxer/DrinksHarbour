import Link from 'next/link';
import type { CustomerReturn } from '@/services/customerReturns.service';
import { routes } from '@/config/routes';
import {
  returnDestination,
  returnQuantity,
  returnStatus,
} from './customer-return-status';
export default function CustomerReturnDetail({
  row,
  onClose,
  onPrint,
}: {
  row: CustomerReturn;
  onClose: () => void;
  onPrint: () => void;
}) {
  const status = returnStatus(row);
  const href =
    row.source === 'sales'
      ? routes.eCommerce.salesDetails(row.sourceId)
      : `${routes.pos.orders}?receipt=${encodeURIComponent(row.sourceNumber)}&order=${encodeURIComponent(row.sourceId)}`;
  return (
    <section
      aria-label="Return detail"
      className="m-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Customer return
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {row.reference || row.sourceNumber}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
        >
          Close detail
        </button>
      </div>
      <span
        className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status.color}`}
      >
        {status.label}
      </span>
      <p className="mt-4 font-semibold">
        {row.product}{' '}
        <span className="font-normal text-gray-500">· {row.size}</span>
      </p>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        {[
          ['Returned units', returnQuantity(row.returned)],
          ['Restocked units', returnQuantity(row.restocked)],
          ['Not-restocked units', returnQuantity(row.notRestocked)],
          ['Destination', returnDestination(row)],
          ['Source', `${row.source.toUpperCase()} · ${row.sourceNumber}`],
          [
            'Recorded date',
            row.date
              ? new Date(row.date).toLocaleString('en-GB')
              : 'Date unavailable',
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {row.reason && <p className="mt-4 text-sm text-gray-600">{row.reason}</p>}
      <p className="mt-4 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-500">
        {row.source === 'sales'
          ? 'Sales quantities are cumulative. The recorded date is the latest matching return movement. '
          : ''}
        Returned goods and monetary refunds are tracked separately.{' '}
        {row.stockEvidence === 'unverified'
          ? 'Stock evidence is incomplete; unknown quantities are not zero.'
          : 'Stock disposition is supported by the saved return records.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={href}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-brand"
        >
          {row.source === 'sales' ? 'Open Sales order' : 'Open POS receipt'}
        </Link>
        <button
          type="button"
          onClick={onPrint}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
        >
          Print return note
        </button>
      </div>
    </section>
  );
}
