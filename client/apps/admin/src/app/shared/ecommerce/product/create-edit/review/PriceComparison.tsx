import { money } from './pricing';
export default function PriceComparison({
  original,
  entered,
  currency,
  label,
}: {
  original?: number | null;
  entered: string;
  currency: string;
  label: string;
}) {
  const price = entered.trim() ? Number(entered) : NaN;
  const valid = Number.isFinite(price) && price > 0;
  if (valid && original === price) return null;
  const difference =
    valid && original != null && Number.isFinite(original) ? price - original : null;
  return (
    <div
      aria-label={`${label} comparison`}
      className="my-3 grid grid-cols-3 gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-3 text-xs"
    >
      <div>
        <p className="text-gray-500">Current {label}</p>
        <p className="mt-1 font-semibold tabular-nums text-gray-700">
          {money(original, currency)}
        </p>
      </div>
      <div>
        <p className="text-blue-700">Proposed {label}</p>
        <p className="mt-1 font-semibold tabular-nums text-blue-800">
          {valid ? money(price, currency) : 'Check price'}
        </p>
      </div>
      <div>
        <p className="text-gray-500">Change</p>
        <p className="mt-1 font-semibold tabular-nums text-gray-700">
          {difference === null
            ? '—'
            : `${difference > 0 ? '+' : ''}${money(difference, currency)}`}
        </p>
        {difference !== null && original != null && original > 0 && (
          <p className="mt-1 text-gray-500">
            {difference > 0 ? '+' : ''}
            {((difference / original) * 100).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}
