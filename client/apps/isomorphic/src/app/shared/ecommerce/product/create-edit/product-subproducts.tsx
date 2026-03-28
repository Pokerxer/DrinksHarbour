// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Badge, Text } from 'rizzui';
import {
  PiStorefront,
  PiCheckCircleBold,
  PiXCircleBold,
  PiSpinnerBold,
  PiPackageBold,
  PiArrowsClockwiseBold,
  PiClockBold,
  PiWarningBold,
  PiCurrencyNgnBold,
  PiStackBold,
} from 'react-icons/pi';
import { subproductService } from '@/services/subproduct.service';
import cn from '@core/utils/class-names';

interface SubProductItem {
  _id: string;
  sku?: string;
  status: string;
  tenant?: { _id: string; name: string };
  baseSellingPrice?: number;
  currency?: string;
  availableStock?: number;
  totalStock?: number;
  sizes?: Array<{ size: string; stock?: number; basePrice?: number }>;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'secondary' | 'primary' }> = {
  active:        { label: 'Active',        color: 'success' },
  pending:       { label: 'Pending',       color: 'warning' },
  draft:         { label: 'Draft',         color: 'secondary' },
  archived:      { label: 'Declined',      color: 'danger' },
  discontinued:  { label: 'Discontinued',  color: 'danger' },
  hidden:        { label: 'Hidden',        color: 'secondary' },
  low_stock:     { label: 'Low Stock',     color: 'warning' },
  out_of_stock:  { label: 'Out of Stock',  color: 'danger' },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, color: 'secondary' };
  return (
    <Badge color={info.color} variant="flat" className="text-xs font-semibold capitalize">
      {info.label}
    </Badge>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-gray-200 rounded-lg" />
        <div className="h-8 w-20 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

export default function ProductSubProductsPanel({ productId }: { productId: string }) {
  const { data: session } = useSession();
  const [subProducts, setSubProducts] = useState<SubProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // tracks per-row action: { [subProductId]: 'approving' | 'declining' }
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

  const fetchSubProducts = useCallback(async () => {
    if (!session?.user?.token || !productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await subproductService.getSubProductsByProduct(productId, session.user.token);
      const raw = res?.data?.subProducts ?? res?.subProducts ?? res?.data ?? res ?? [];
      setSubProducts(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sub-products');
    } finally {
      setIsLoading(false);
    }
  }, [productId, session?.user?.token]);

  useEffect(() => { fetchSubProducts(); }, [fetchSubProducts]);

  const handleApprove = async (id: string) => {
    if (!session?.user?.token) return;
    setActionLoading(prev => ({ ...prev, [id]: 'approving' }));
    try {
      await subproductService.adminSetSubProductStatus(id, 'active', session.user.token);
      setSubProducts(prev => prev.map(sp => sp._id === id ? { ...sp, status: 'active' } : sp));
      toast.success('Sub-product approved — now live on the store');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve sub-product');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const handleDecline = async (id: string) => {
    if (!session?.user?.token) return;
    setActionLoading(prev => ({ ...prev, [id]: 'declining' }));
    try {
      await subproductService.adminSetSubProductStatus(id, 'archived', session.user.token);
      setSubProducts(prev => prev.map(sp => sp._id === id ? { ...sp, status: 'archived' } : sp));
      toast.success('Sub-product declined');
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline sub-product');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const pendingCount = subProducts.filter(sp => sp.status === 'pending' || sp.status === 'draft').length;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <PiStorefront className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Sub-Products</h3>
            <p className="text-xs text-gray-500">Tenant listings linked to this product</p>
          </div>
          {subProducts.length > 0 && (
            <Badge color="primary" variant="flat" className="text-xs ml-1">
              {subProducts.length} total
            </Badge>
          )}
          {pendingCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <Badge color="warning" variant="flat" className="text-xs animate-pulse">
                {pendingCount} pending review
              </Badge>
            </motion.div>
          )}
        </div>
        <button
          type="button"
          onClick={fetchSubProducts}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <motion.span animate={isLoading ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: isLoading ? Infinity : 0 }}>
            <PiArrowsClockwiseBold className="w-4 h-4" />
          </motion.span>
          Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex items-center gap-3 p-5 m-4 bg-red-50 rounded-xl border border-red-100">
          <PiWarningBold className="w-5 h-5 text-red-500 flex-shrink-0" />
          <Text className="text-sm text-red-700 flex-1">{error}</Text>
          <button
            type="button"
            onClick={fetchSubProducts}
            className="text-xs text-red-600 font-semibold hover:underline whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && subProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <PiPackageBold className="w-7 h-7 text-gray-300" />
          </div>
          <Text className="font-medium text-gray-500">No sub-products yet</Text>
          <Text className="text-sm text-gray-400 mt-1 max-w-xs">
            No tenant has linked this product to their store yet.
          </Text>
        </div>
      )}

      {/* List */}
      {!isLoading && !error && subProducts.length > 0 && (
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
                    'flex items-start sm:items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors',
                    needsReview && 'bg-amber-50/50 hover:bg-amber-50'
                  )}
                >
                  {/* Tenant icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border',
                    needsReview
                      ? 'bg-amber-100 border-amber-200'
                      : 'bg-blue-50 border-blue-100'
                  )}>
                    <PiStorefront className={cn('w-5 h-5', needsReview ? 'text-amber-600' : 'text-blue-500')} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Text className="font-semibold text-gray-900 text-sm truncate">
                        {sp.tenant?.name || 'Unknown Tenant'}
                      </Text>
                      <StatusBadge status={sp.status} />
                      {needsReview && (
                        <Badge color="warning" variant="outline" className="text-xs">
                          Needs Review
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {sp.sku && (
                        <span className="text-xs text-gray-400 font-mono">SKU: {sp.sku}</span>
                      )}
                      {sp.baseSellingPrice != null && (
                        <span className="text-xs text-gray-600 font-medium flex items-center gap-0.5">
                          <PiCurrencyNgnBold className="w-3 h-3" />
                          {sp.baseSellingPrice.toLocaleString()}
                          {sp.currency && sp.currency !== 'NGN' && (
                            <span className="ml-0.5 text-gray-400">{sp.currency}</span>
                          )}
                        </span>
                      )}
                      {sp.availableStock != null && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <PiStackBold className="w-3 h-3" />
                          {sp.availableStock} in stock
                        </span>
                      )}
                      {sp.sizes && sp.sizes.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {sp.sizes.length} size{sp.sizes.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {sp.createdAt && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <PiClockBold className="w-3 h-3" />
                          {new Date(sp.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    {needsReview ? (
                      <>
                        {/* Approve */}
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleApprove(sp._id)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          {isActioning && actionType === 'approving' ? (
                            <PiSpinnerBold className="w-4 h-4 animate-spin" />
                          ) : (
                            <PiCheckCircleBold className="w-4 h-4" />
                          )}
                          Approve
                        </motion.button>
                        {/* Decline */}
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleDecline(sp._id)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isActioning && actionType === 'declining' ? (
                            <PiSpinnerBold className="w-4 h-4 animate-spin" />
                          ) : (
                            <PiXCircleBold className="w-4 h-4" />
                          )}
                          Decline
                        </motion.button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {sp.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleDecline(sp._id)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {isActioning ? <PiSpinnerBold className="w-3 h-3 animate-spin" /> : <PiXCircleBold className="w-3 h-3" />}
                            Deactivate
                          </button>
                        )}
                        {sp.status === 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(sp._id)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:text-green-600 hover:border-green-200 hover:bg-green-50 disabled:opacity-50 transition-colors"
                          >
                            {isActioning ? <PiSpinnerBold className="w-3 h-3 animate-spin" /> : <PiCheckCircleBold className="w-3 h-3" />}
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
      )}
    </div>
  );
}
