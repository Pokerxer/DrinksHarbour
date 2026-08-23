'use client';

import { PiClockCounterClockwise } from 'react-icons/pi';
import type { HistoryEntry } from '@/services/vendorPricelist.service';
import { fmtCur } from '../purchases-analytics-helpers';
import DeltaBadge from './delta-badge';

export default function PriceHistoryPanel({
  history,
  currency,
}: {
  history?: HistoryEntry[];
  currency: string;
}) {
  if (!history || history.length === 0) {
    return <p className="px-4 py-3 text-xs text-gray-400">No price history yet.</p>;
  }
  const rows = [...history].reverse();
  return (
    <div className="px-4 py-3">
      <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <PiClockCounterClockwise className="h-3.5 w-3.5" /> Price history
      </p>
      <div className="space-y-1">
        {rows.map((h, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {h.date ? new Date(h.date).toLocaleDateString() : '—'}
              <span className="ml-2 rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {h.source === 'po' ? `PO ${h.poNumber || ''}`.trim() : 'Manual'}
              </span>
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="font-medium text-[#2a2420]">
                {fmtCur(h.unitPrice, currency)}
              </span>
              <DeltaBadge delta={typeof h.changePercent === 'number' ? h.changePercent : null} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
