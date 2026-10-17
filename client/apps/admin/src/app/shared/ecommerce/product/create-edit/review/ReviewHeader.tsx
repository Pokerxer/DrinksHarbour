'use client';
import { DialogTitle, Description } from '@headlessui/react';
import { PiX, PiStorefront } from 'react-icons/pi';
import type { ReviewListing } from './types';
export default function ReviewHeader({
  listing,
  edited,
  busy,
  onClose,
}: {
  listing: ReviewListing | null;
  edited: number;
  busy: boolean;
  onClose: () => void;
}) {
  const status = listing?.status;
  const statusStyle =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : status === 'pending'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-gray-100 text-gray-600 ring-gray-200';
  return (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Review Sub-Product
          </DialogTitle>
          {status && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${statusStyle}`}
            >
              {status.replaceAll('_', ' ')}
            </span>
          )}
          {edited > 0 && (
            <span className="text-xs font-medium text-blue-700">
              Unsaved price edits · {edited}
            </span>
          )}
        </div>
        <h2 className="mt-2 break-words text-lg font-semibold leading-snug text-gray-900 sm:text-2xl">
          {listing?.product?.name || 'Product listing'}
        </h2>
        <Description
          as="div"
          className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 sm:text-sm"
        >
          {listing ? (
            <>
              <span className="sr-only">
                {listing.product?.name || 'Product listing'}.
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
                <PiStorefront aria-hidden className="shrink-0" />
                {listing.tenant?.name ||
                  listing.tenant?.businessName ||
                  'Unknown tenant'}
              </span>
              <span className="break-all font-mono text-xs">
                SKU: {listing.sku || 'Not supplied'}
              </span>
            </>
          ) : (
            'Check prices, stock and tenant terms before approval.'
          )}
        </Description>
      </div>
      <button
        type="button"
        aria-label="Close sub-product review"
        disabled={busy}
        onClick={onClose}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
      >
        <PiX size={22} aria-hidden />
      </button>
    </header>
  );
}
