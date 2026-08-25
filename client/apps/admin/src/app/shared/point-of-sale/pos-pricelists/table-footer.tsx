'use client';

import React from 'react';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';

const PAGE_SIZE = 50;

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPage(p: number): void;
}

export default function TableFooter({ page, totalPages, total, onPage }: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5 text-xs text-gray-500">
      <span>
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
        {total}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p =
            totalPages <= 7 ? i + 1 : i === 0 ? 1 : i === 6 ? totalPages : page - 2 + i;
          return (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              onClick={() => onPage(p)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${
                p === page ? 'text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              style={p === page ? { backgroundColor: BRAND, borderColor: BRAND } : {}}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
