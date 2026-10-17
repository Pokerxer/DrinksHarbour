'use client';
import { useState } from 'react';
import { money } from '../../../../../../../packages/sales-money';
export default function SalesAdjustmentPanel({
  kind,
  value,
  onApply,
  onClose,
}: {
  kind: 'shipping' | 'discount';
  value: number;
  onApply: (value: number) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState(kind === 'shipping' ? String(value) : '');
  const [error, setError] = useState('');
  const shipping = kind === 'shipping';
  function apply() {
    const number = Number(input);
    if (
      !input.trim() ||
      !Number.isFinite(number) ||
      number < 0 ||
      (!shipping && number > 100)
    ) {
      setError(
        shipping
          ? 'Enter a valid shipping amount of zero or more.'
          : 'Enter a percentage from 0 to 100.',
      );
      return;
    }
    onApply(shipping ? money(number) : number);
    onClose();
  }
  return (
    <section
      aria-label={shipping ? 'Shipping charge' : 'Product-line discount'}
      className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <p className="text-xs text-gray-600">
        {shipping
          ? 'Flat delivery charge, added after goods discounts.'
          : 'This replaces existing product-line discounts. Enter 0 to clear them.'}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-xs font-medium text-gray-700">
          {shipping ? 'Shipping amount' : 'Discount on all product lines (%)'}
          <input
            aria-label={
              shipping ? 'Shipping amount' : 'Discount on all product lines (%)'
            }
            type="number"
            min={0}
            max={shipping ? undefined : 100}
            step={shipping ? '0.01' : 'any'}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
            className="mt-1 w-full min-w-24 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-right text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={apply}
          className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white"
        >
          {shipping ? 'Apply shipping' : 'Apply discount'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-2 text-xs text-gray-600"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
