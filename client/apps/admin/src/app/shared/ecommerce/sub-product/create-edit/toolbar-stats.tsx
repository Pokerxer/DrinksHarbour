import {
  PiArrowCounterClockwise,
  PiPackage,
  PiShoppingCart,
  PiTrendUp,
} from 'react-icons/pi';

export type ProductHistory = 'purchased' | 'sold' | 'returns';
export interface ToolbarStatsProps {
  stock: number;
  price: number;
  currency: string;
  purchased: number | null;
  sold: number | null;
  editing: boolean;
  disabled: boolean;
  onHistory: (history: ProductHistory) => void;
}

function formatPrice(price: number, currency: string) {
  if (!Number.isFinite(price) || price <= 0) return 'Not set';
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString('en-NG')}`;
  }
}

export default function ToolbarStats(props: ToolbarStatsProps) {
  const history = [
    {
      key: 'purchased' as const,
      label: 'Purchased',
      value: props.purchased,
      icon: PiShoppingCart,
    },
    { key: 'sold' as const, label: 'Sold', value: props.sold, icon: PiTrendUp },
    {
      key: 'returns' as const,
      label: 'Returns',
      value: null,
      icon: PiArrowCounterClockwise,
    },
  ];
  return (
    <div
      role="group"
      aria-label="Product stock, price and history"
      tabIndex={0}
      className="flex min-w-0 items-center gap-2 overflow-x-auto px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-500 sm:px-6"
    >
      <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-gray-50 px-3 text-xs text-gray-600">
        <PiPackage aria-hidden="true" className="h-4 w-4" />
        On hand{' '}
        <strong className="tabular-nums text-gray-900">
          {props.stock.toLocaleString('en-NG')}
        </strong>
      </div>
      <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-gray-50 px-3 text-xs text-gray-600">
        Price{' '}
        <strong className="tabular-nums text-gray-900">
          {formatPrice(props.price, props.currency)}
        </strong>
      </div>
      {props.editing &&
        history.map(({ key, label, value, icon: Icon }) => (
          <button
            key={key}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onHistory(key)}
            aria-label={`View ${label.toLowerCase()} history`}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-transparent px-3 text-xs text-gray-600 hover:border-gray-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-40"
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
            {value !== null && (
              <strong className="tabular-nums text-gray-900">
                {value.toLocaleString('en-NG')}
              </strong>
            )}
          </button>
        ))}
    </div>
  );
}
