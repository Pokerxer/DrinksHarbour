'use client';
import { useId, useState } from 'react';
export type PublicServing = {
  subProductId: string;
  sizeId: string;
  name: string;
  sizeLabel: string;
  unitPriceMinor: number;
  taxMinor: number;
  currency: string;
  alcoholic: boolean;
  abv: number;
  available: boolean;
  display?: string;
  categoryId?: string;
};
export default function ServingPicker({ items }: { items: PublicServing[] }) {
  const id = useId();
  const [size, setSize] = useState(items[0]?.sizeId || '');
  const item = items.find((row) => row.sizeId === size) || items[0];
  if (!item) return null;
  return (
    <article
      className={`space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm ${item.available ? '' : 'border-dashed'}`}
    >
      <h4 className="font-semibold">{item.name}</h4>
      <label className="block text-sm" htmlFor={id}>
        Portion for {item.name}
        <select
          id={id}
          className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800"
          value={item.sizeId}
          onChange={(event) => setSize(event.target.value)}
        >
          {items.map((row) => (
            <option key={row.sizeId} value={row.sizeId}>
              {row.sizeLabel}
            </option>
          ))}
        </select>
      </label>
      <p className="text-lg font-semibold tabular-nums">
        {new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: item.currency,
        }).format((item.unitPriceMinor + item.taxMinor) / 100)}
      </p>
      <p className="text-xs text-stone-600">Including configured tax</p>
      <p
        className={
          item.available
            ? 'text-sm font-medium text-green-800'
            : 'text-sm text-stone-600'
        }
      >
        {item.available
          ? 'Stock available at this location'
          : 'Currently unavailable'}
      </p>
      {item.alcoholic && (
        <p className="text-sm text-stone-600">
          Alcohol · {item.abv}% ABV · age verification required
        </p>
      )}
    </article>
  );
}
