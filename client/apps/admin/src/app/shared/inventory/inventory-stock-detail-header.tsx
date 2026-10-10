'use client';
import { useState } from 'react';
import { PiImage, PiX } from 'react-icons/pi';
import type { StockRow } from '@/services/warehouseStock.service';
import StockProductLink from './inventory-stock-product-link';
import { statusOf, STATUS_BADGE } from './inventory-stock-search';
function ProductImage({ row }: { row: StockRow }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-2">
      {row.productImage && !failed ? (
        <img
          src={row.productImage}
          alt={row.productName}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <PiImage aria-label="No product image" className="h-8 w-8 text-gray-300" />
      )}
    </div>
  );
}
export default function StockDetailHeader({ row, close }: { row: StockRow; close: () => void }) {
  const status = STATUS_BADGE[statusOf(row)];
  return (
    <header className="flex shrink-0 items-start gap-3 border-b border-gray-200 bg-white p-4">
      <ProductImage key={row.productImage || 'empty'} row={row} />
      <div className="min-w-0 flex-1">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}
        >
          {status.label}
        </span>
        <h2 className="mt-1.5 text-sm font-bold leading-snug text-gray-900">
          <StockProductLink id={row.subProductId} name={row.productName} />
        </h2>
        <p className="mt-1 break-all text-[11px] text-gray-500">{row.sku || 'No SKU'}</p>
        <p className="mt-1 text-xs text-gray-600">
          {row.sizeName} · {row.warehouseName}
        </p>
      </div>
      <button
        type="button"
        aria-label="Close stock details"
        onClick={close}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800"
      >
        <PiX className="h-5 w-5" />
      </button>
    </header>
  );
}
