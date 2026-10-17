// @ts-nocheck
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Text, Badge } from 'rizzui';
import { motion } from 'framer-motion';
import {
  PiStorefront,
  PiArrowsClockwiseBold,
  PiWarningBold,
  PiPackageBold,
} from 'react-icons/pi';
import { subproductService } from '@/services/subproduct.service';
import { RowSkeleton, type SubProductItem } from './review/listing-primitives';
import type { ReviewOverrides } from './review/types';
import ReviewSubProductModal from './review/ReviewSubProductModal';
import SubProductRows from './review/SubProductRows';

export default function ProductSubProductsPanel({
  productId,
}: {
  productId: string;
}) {
  const { data: session } = useSession();
  const [subProducts, setSubProducts] = useState<SubProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // tracks per-row action: { [subProductId]: 'approving' | 'declining' }
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [reviewId, setReviewId] = useState<string | null>(null);

  const fetchSubProducts = useCallback(async () => {
    if (!session?.user?.token || !productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await subproductService.getSubProductsByProduct(
        productId,
        session.user.token
      );
      const raw =
        res?.data?.subProducts ?? res?.subProducts ?? res?.data ?? res ?? [];
      setSubProducts(Array.isArray(raw) ? raw : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sub-products');
    } finally {
      setIsLoading(false);
    }
  }, [productId, session?.user?.token]);

  useEffect(() => {
    fetchSubProducts();
  }, [fetchSubProducts]);

  const handleApprove = async (id: string, overrides?: ReviewOverrides) => {
    if (!session?.user?.token) return;
    setActionLoading((prev) => ({ ...prev, [id]: 'approving' }));
    try {
      await subproductService.adminSetSubProductStatus(
        id,
        'active',
        session.user.token,
        overrides
      );
      setSubProducts((prev) =>
        prev.map((sp) => (sp._id === id ? { ...sp, status: 'active' } : sp))
      );
      toast.success('Listing approval saved.');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to approve sub-product'
      );
      throw err;
    } finally {
      setActionLoading((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  };

  const handleDecline = async (id: string, reason?: string) => {
    if (!session?.user?.token) return;
    setActionLoading((prev) => ({ ...prev, [id]: 'declining' }));
    try {
      await subproductService.adminSetSubProductStatus(
        id,
        'archived',
        session.user.token,
        undefined,
        reason
      );
      setSubProducts((prev) =>
        prev.map((sp) => (sp._id === id ? { ...sp, status: 'archived' } : sp))
      );
      toast.success('Sub-product declined');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to decline sub-product'
      );
      throw err;
    } finally {
      setActionLoading((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  };

  const pendingCount = subProducts.filter(
    (sp) => sp.status === 'pending' || sp.status === 'draft'
  ).length;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <PiStorefront className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Sub-Products</h3>
            <p className="text-xs text-gray-500">
              Tenant listings linked to this product
            </p>
          </div>
          {subProducts.length > 0 && (
            <Badge color="primary" variant="flat" className="ml-1 text-xs">
              {subProducts.length} total
            </Badge>
          )}
          {pendingCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <Badge
                color="warning"
                variant="flat"
                className="animate-pulse text-xs"
              >
                {pendingCount} pending review
              </Badge>
            </motion.div>
          )}
        </div>
        <button
          type="button"
          onClick={fetchSubProducts}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-blue-600"
        >
          <motion.span
            animate={isLoading ? { rotate: 360 } : {}}
            transition={{ duration: 0.8, repeat: isLoading ? Infinity : 0 }}
          >
            <PiArrowsClockwiseBold className="h-4 w-4" />
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
        <div className="m-4 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-5">
          <PiWarningBold className="h-5 w-5 flex-shrink-0 text-red-500" />
          <Text className="flex-1 text-sm text-red-700">{error}</Text>
          <button
            type="button"
            onClick={fetchSubProducts}
            className="whitespace-nowrap text-xs font-semibold text-red-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && subProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <PiPackageBold className="h-7 w-7 text-gray-300" />
          </div>
          <Text className="font-medium text-gray-500">No sub-products yet</Text>
          <Text className="mt-1 max-w-xs text-sm text-gray-400">
            No tenant has linked this product to their store yet.
          </Text>
        </div>
      )}

      {/* Review Drawer */}
      {reviewId && (
        <ReviewSubProductModal
          key={reviewId}
          subProductId={reviewId}
          token={session?.user?.token ?? ''}
          onClose={() => setReviewId(null)}
          onApprove={handleApprove}
          onDecline={handleDecline}
        />
      )}

      {/* List */}
      {!isLoading && !error && subProducts.length > 0 && (
        <SubProductRows
          subProducts={subProducts}
          actionLoading={actionLoading}
          onReview={setReviewId}
          onApprove={(id) => {
            void handleApprove(id).catch(() => {});
          }}
          onDecline={(id) => {
            void handleDecline(id).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
