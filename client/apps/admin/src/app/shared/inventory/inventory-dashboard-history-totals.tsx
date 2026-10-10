import { movementTotals } from './inventory-dashboard-analysis';
import type { InventoryMovement } from '@/services/inventory.service';
export default function HistoryTotals({
  movements,
  available,
}: {
  movements: InventoryMovement[];
  available: boolean;
}) {
  const totals = movementTotals(movements);
  const fields = [
    ['Total transferred in', totals.transferIn],
    ['Total transferred out', totals.transferOut],
    ['Returned into source', totals.transferReturnedIn],
    ['Returned out of destination', totals.transferReturnedOut],
    ['Net transferred in', totals.netTransferIn],
    ['Net transferred out', totals.netTransferOut],
    ['Received', totals.received],
    ['Issued', totals.issued],
    ['Other returns in', totals.returnedIn],
    ['Other returns out', totals.returnedOut],
  ] as const;
  return (
    <section
      aria-label="Filtered movement totals"
      className="mb-6 rounded-2xl border border-[#ece4d6] bg-white p-4 sm:p-5"
    >
      <h2 className="text-sm font-semibold text-gray-800">Movement totals · selected history</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        Confirmed stock movements across all loaded pages. Transfer returns reverse the original
        direction: net in = transferred in − returned out; net out = transferred out − returned in.
        These are units, separate from current stock and cash refunds.
      </p>
      {available ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {fields.map(([name, quantity]) => (
            <div key={name} className="rounded-xl bg-[#faf8f3] p-3">
              <p className="text-xs text-gray-500">{name}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[#65594e]">
                {quantity.toLocaleString()} <span className="text-xs font-normal">units</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          History is unavailable. Retry to calculate movement totals.
        </p>
      )}
    </section>
  );
}
