import NotificationSummaryCards from '../notification-summary-cards';
import type { InsightPlan } from '@/services/notificationInsights.service';
import {
  type StockFilter,
  warehouseSummaries,
  needsAttention,
  hasTransferFollowUp,
  statusOf,
} from './warehouse-rules';
export default function WarehouseSummary({
  plan,
  selected,
  onSelect,
  status,
  onStatus,
}: {
  plan: InsightPlan;
  selected: string;
  onSelect: (id: string) => void;
  status: StockFilter;
  onStatus: (status: StockFilter) => void;
}) {
  const cards = warehouseSummaries(plan.lines, plan.warehouses);
  const lines = plan.lines.filter(
    (l) =>
      !selected ||
      (selected === 'unassigned' ? !l.warehouseId : l.warehouseId === selected)
  );
  const count = (status: string) =>
    lines.filter((l) => statusOf(l) === status).length;
  const stats = [
    {
      label: 'Needs attention',
      value: lines.filter(needsAttention).length,
      detail: 'Product / size / location entries',
      color: 'text-[#b20202]',
    },
    {
      label: 'Out of stock',
      value: count('out'),
      detail: 'Zero or negative available stock',
      color: 'text-red-700',
    },
    {
      label: 'Stock at risk',
      value: count('risk'),
      detail: 'Forecast risk or committed outgoing stock',
      color: 'text-amber-700',
    },
    {
      label: 'Transfer follow-ups',
      value: lines.filter(hasTransferFollowUp).length,
      detail: 'Stock entries with pending transfers',
      color: 'text-blue-700',
    },
    {
      label: 'Stock unknown',
      value: count('unknown'),
      detail: 'Verify balances before ordering',
      color: 'text-gray-600',
    },
  ];
  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        Overview for the selected location and current product scope
      </p>
      <NotificationSummaryCards
        active={status}
        onSelect={(value) => onStatus(value as StockFilter)}
        cards={stats.map((card, index) => ({
          ...card,
          valueId: ['attention', 'out', 'risk', 'transfers', 'unknown'][index],
        }))}
      />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-900">By warehouse</h2>
        <button
          onClick={() => onSelect('')}
          aria-pressed={!selected}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${!selected ? 'bg-[#b20202] text-white' : 'border bg-white text-gray-600'}`}
        >
          All warehouses
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const active = selected === (c.id || 'unassigned');
          return (
            <button
              key={c.id || 'unassigned'}
              onClick={() => onSelect(c.id || 'unassigned')}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition hover:border-[#b20202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202] ${active ? 'border-[#b20202] bg-red-50 ring-1 ring-[#b20202]' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gray-900">{c.name}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-bold ${c.attention ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}
                >
                  {c.attention.toLocaleString('en-NG')} needs attention
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                {c.total} stock entries · {c.out} out of stock · {c.unknown}{' '}
                unknown · {c.transferFollowUps} transfer follow-ups
              </p>
              {c.total === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  No recorded stock entries in this scope.
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
