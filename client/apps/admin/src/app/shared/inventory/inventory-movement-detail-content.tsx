import Link from 'next/link';
import type { InventoryMovement } from '@/services/inventory.service';
import { movementDetails } from './inventory-movement-detail-data';
import StockProductLink from './inventory-stock-product-link';
export default function MovementDetailContent({ move }: { move: InventoryMovement }) {
  const detail = movementDetails(move);
  const tone =
    (detail.delta ?? 0) > 0
      ? 'text-emerald-600'
      : (detail.delta ?? 0) < 0
        ? 'text-red-600'
        : 'text-gray-600';
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-1 divide-gray-100 border-b border-gray-100 sm:grid-cols-3 sm:divide-x">
        {[
          { label: 'Posted change', value: detail.change, tone },
          { label: 'Unit cost', value: detail.unitCost, tone: 'text-gray-900' },
          { label: 'Recorded value', value: detail.cost, tone: 'text-[#b20202]' },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {item.label}
            </p>
            <p className={`mt-0.5 break-words text-sm font-bold tabular-nums ${item.tone}`}>
              {item.value}
            </p>
            {item.label === 'Posted change' && (
              <p className="mt-1 text-[10px] text-gray-500">Recorded quantity: {detail.quantity}</p>
            )}
          </div>
        ))}
      </div>
      <p className="border-b border-gray-100 px-5 py-2 text-[11px] text-gray-500">
        {detail.postingNote}
      </p>
      <div className="border-b border-gray-100 px-5 py-3">
        <p className="break-words text-sm font-bold text-gray-900">
          <StockProductLink id={detail.productId} name={detail.productName} />
        </p>
        {detail.size && <p className="text-xs text-gray-400">{detail.size}</p>}
      </div>
      <dl className="space-y-2 border-b border-gray-100 px-5 py-3 text-xs">
        {detail.rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 font-semibold text-gray-500">{row.label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-gray-800">
              {row.href ? (
                <Link
                  href={row.href}
                  aria-label={row.label === 'Warehouse' ? row.value : `${row.label}: ${row.value}`}
                  className="text-[#b20202] hover:underline"
                >
                  {row.value}
                </Link>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-3 px-5 py-3 text-xs">
        {[
          { label: 'Reason', text: move.reason },
          { label: 'Notes', text: move.notes },
        ]
          .filter((item) => item.text)
          .map((item) => (
            <div key={item.label}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {item.label}
              </p>
              <p className="whitespace-pre-wrap break-words text-gray-600">{item.text}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
