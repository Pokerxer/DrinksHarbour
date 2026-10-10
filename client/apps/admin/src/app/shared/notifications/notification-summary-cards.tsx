import { PiArrowRight, PiChartBar } from 'react-icons/pi';
export interface SummaryCard {
  label: string;
  value: number | string;
  detail: string;
  valueId: string;
}
export default function NotificationSummaryCards({
  cards,
  active,
  onSelect,
}: {
  cards: SummaryCard[];
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 ${cards.length > 4 ? 'lg:grid-cols-3 xl:grid-cols-5' : cards.length > 2 ? 'lg:grid-cols-4' : ''}`}
    >
      {cards.map((card, index) => (
        <button
          type="button"
          key={card.valueId}
          aria-label={`Filter: ${card.label}`}
          aria-pressed={active === card.valueId}
          onClick={() => onSelect(card.valueId)}
          className={`group rounded-2xl border bg-white p-5 text-left transition hover:border-[#b20202] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202] ${active === card.valueId ? 'border-[#b20202] ring-1 ring-[#b20202]' : 'border-gray-200'}`}
        >
          <span className="flex items-center justify-between gap-2">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${index === 1 ? 'bg-red-50 text-red-700' : index === 2 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}
            >
              <PiChartBar aria-hidden className="h-5 w-5" />
            </span>
            <PiArrowRight
              aria-hidden
              className="h-4 w-4 text-gray-400 group-hover:text-[#b20202]"
            />
          </span>
          <span className="mt-4 block text-xs font-semibold text-gray-600">
            {card.label}
          </span>
          <span className="mt-1 block text-3xl font-bold tabular-nums text-gray-900">
            {typeof card.value === 'number'
              ? card.value.toLocaleString('en-NG')
              : card.value}
          </span>
          <span className="mt-2 block text-xs leading-5 text-gray-500">
            {card.detail}
          </span>
        </button>
      ))}
    </div>
  );
}
