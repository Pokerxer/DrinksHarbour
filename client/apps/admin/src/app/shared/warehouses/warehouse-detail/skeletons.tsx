'use client';

// app/shared/warehouses/warehouse-detail/skeletons.tsx
// Loading placeholders matching each view's final layout.

import { motion } from 'framer-motion';

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-4 h-12 animate-pulse rounded-lg bg-gray-100" />
        </motion.div>
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="space-y-3 p-4">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="h-11 w-11 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-7 w-24 animate-pulse rounded-full bg-gray-100" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
