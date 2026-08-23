'use client';

// app/shared/warehouses/warehouse-analysis/skeletons.tsx
// Loading placeholders matching the page's final layout.

export function AnalysisSkeleton() {
  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202] opacity-40" />
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-3 h-7 w-60 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-2 h-3 w-80 animate-pulse rounded-full bg-gray-50" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="bg-[#b20202]/8 col-span-2 h-[118px] animate-pulse rounded-2xl lg:col-span-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[118px] animate-pulse rounded-2xl border border-[#ece4d6] bg-white"
          />
        ))}
      </div>
      <div className="mt-5 h-[440px] animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
    </div>
  );
}
