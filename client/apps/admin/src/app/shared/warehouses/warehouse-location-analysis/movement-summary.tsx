import type { MovementTotals } from '@/services/warehouseHistory.service';
export default function MovementSummary({ summary }: { summary: MovementTotals }) {
  return (
    <section aria-label="Stock movement totals" className="space-y-3">
      <p className="text-xs text-gray-500">
        All {summary.records.toLocaleString()} matching movements, across every page. Units are
        summed across the selected products and sizes; these changes are not your current stock
        balance.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['Stock added', summary.incomingQuantity],
            ['Stock removed', summary.outgoingQuantity],
            ['Net stock change', summary.netQuantity],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#ece4d6] bg-white p-4">
            <p className="text-xs font-medium text-[#8b7a6b]">{label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-[#2a2420]">
              {value.toLocaleString()} units
            </p>
          </div>
        ))}
      </div>
      {!!summary.unknownChanges && (
        <p role="status" className="text-sm text-amber-700">
          {summary.unknownChanges.toLocaleString()} older recounts have no saved previous balance.
          Their changes are unavailable and excluded from these totals.
        </p>
      )}
    </section>
  );
}
