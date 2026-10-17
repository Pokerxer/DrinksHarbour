'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Badge } from 'rizzui';
import {
  PiStorefront,
  PiCurrencyNgnBold,
  PiStackBold,
  PiClockBold,
  PiEyeBold,
  PiSpinnerBold,
  PiCheckCircleBold,
  PiXCircleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { StatusBadge, type SubProductItem } from './listing-primitives';
export default function SubProductRows({
  subProducts,
  actionLoading,
  onReview,
  onApprove,
  onDecline,
}: {
  subProducts: SubProductItem[];
  actionLoading: Record<string, string>;
  onReview: (id: string) => void;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-gray-100">
      <AnimatePresence initial={false}>
        {subProducts.map((sp, i) => {
          const needsReview = sp.status === 'pending' || sp.status === 'draft';
          const isActioning = !!actionLoading[sp._id];
          const actionType = actionLoading[sp._id];

          return (
            <motion.div
              key={sp._id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'flex items-start gap-4 px-6 py-4 transition-colors hover:bg-gray-50/60 sm:items-center',
                needsReview && 'bg-amber-50/50 hover:bg-amber-50'
              )}
            >
              {/* Tenant icon */}
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border',
                  needsReview
                    ? 'border-amber-200 bg-amber-100'
                    : 'border-blue-100 bg-blue-50'
                )}
              >
                <PiStorefront
                  className={cn(
                    'h-5 w-5',
                    needsReview ? 'text-amber-600' : 'text-blue-500'
                  )}
                />
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Text className="truncate text-sm font-semibold text-gray-900">
                    {sp.tenant?.name || 'Unknown Tenant'}
                  </Text>
                  <StatusBadge status={sp.status} />
                  {needsReview && (
                    <Badge color="warning" variant="outline" className="text-xs">
                      Needs Review
                    </Badge>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {sp.sku && (
                    <span className="font-mono text-xs text-gray-400">
                      SKU: {sp.sku}
                    </span>
                  )}
                  {sp.baseSellingPrice != null && (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-gray-600">
                      <PiCurrencyNgnBold className="h-3 w-3" />
                      {sp.baseSellingPrice.toLocaleString()}
                      {sp.currency && sp.currency !== 'NGN' && (
                        <span className="ml-0.5 text-gray-400">{sp.currency}</span>
                      )}
                    </span>
                  )}
                  {sp.availableStock != null && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                      <PiStackBold className="h-3 w-3" />
                      {sp.availableStock} in stock
                    </span>
                  )}
                  {sp.sizes && sp.sizes.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {sp.sizes.length} size{sp.sizes.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {sp.createdAt && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                      <PiClockBold className="h-3 w-3" />
                      {new Date(sp.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                {/* Review button — always visible */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onReview(sp._id)}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                >
                  <PiEyeBold className="h-3 w-3" />
                  Review
                </motion.button>
                {needsReview ? (
                  <>
                    {/* Approve */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onApprove(sp._id)}
                      disabled={isActioning}
                      className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActioning && actionType === 'approving' ? (
                        <PiSpinnerBold className="h-4 w-4 animate-spin" />
                      ) : (
                        <PiCheckCircleBold className="h-4 w-4" />
                      )}
                      Approve
                    </motion.button>
                    {/* Decline */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onDecline(sp._id)}
                      disabled={isActioning}
                      className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActioning && actionType === 'declining' ? (
                        <PiSpinnerBold className="h-4 w-4 animate-spin" />
                      ) : (
                        <PiXCircleBold className="h-4 w-4" />
                      )}
                      Decline
                    </motion.button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    {sp.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => onDecline(sp._id)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {isActioning ? (
                          <PiSpinnerBold className="h-3 w-3 animate-spin" />
                        ) : (
                          <PiXCircleBold className="h-3 w-3" />
                        )}
                        Deactivate
                      </button>
                    )}
                    {sp.status === 'archived' && (
                      <button
                        type="button"
                        onClick={() => onApprove(sp._id)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-green-200 hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
                      >
                        {isActioning ? (
                          <PiSpinnerBold className="h-3 w-3 animate-spin" />
                        ) : (
                          <PiCheckCircleBold className="h-3 w-3" />
                        )}
                        Reactivate
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
