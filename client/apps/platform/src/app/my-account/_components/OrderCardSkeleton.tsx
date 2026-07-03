'use client';
import React from 'react';

export default function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Row 1: order number + status badge */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-stone-100 animate-pulse rounded" />
          <div className="h-3 w-20 bg-stone-100 animate-pulse rounded" />
        </div>
        <div className="h-6 w-20 bg-stone-100 animate-pulse rounded-md" />
      </div>

      {/* Row 2: thumbnails + text + price */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-12 h-12 rounded-xl border-2 border-white bg-stone-100 animate-pulse" />
            <div className="w-12 h-12 rounded-xl border-2 border-white bg-stone-100 animate-pulse" />
            <div className="w-12 h-12 rounded-xl border-2 border-white bg-stone-100 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-16 bg-stone-100 animate-pulse rounded" />
            <div className="h-3 w-24 bg-stone-100 animate-pulse rounded" />
          </div>
        </div>
        <div className="space-y-1.5 text-right">
          <div className="h-3 w-12 bg-stone-100 animate-pulse rounded ml-auto" />
          <div className="h-4 w-20 bg-stone-100 animate-pulse rounded ml-auto" />
        </div>
      </div>
    </div>
  );
}
