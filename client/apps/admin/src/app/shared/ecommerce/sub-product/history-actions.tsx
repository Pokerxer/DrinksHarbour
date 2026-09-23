'use client';

import React from 'react';
import { PiShoppingCart, PiReceipt } from 'react-icons/pi';

export type ProductHistoryType = 'purchased' | 'sold';

export default function HistoryActions({
  disabled = false,
  onOpen,
}: {
  disabled?: boolean;
  onOpen: (type: ProductHistoryType) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-3"
      role="group"
      aria-label="Product history"
    >
      {(
        [
          {
            type: 'purchased',
            label: 'Purchase history',
            Icon: PiShoppingCart,
          },
          { type: 'sold', label: 'Sales history', Icon: PiReceipt },
        ] as const
      ).map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => onOpen(type)}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
