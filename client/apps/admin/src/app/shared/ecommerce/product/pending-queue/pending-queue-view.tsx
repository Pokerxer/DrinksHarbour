'use client';

/**
 * Super-admin pending-products approval queue.
 *
 * All rows are `status: 'pending'` central products. Tenant-private rows are
 * store-only until approval (which is the same act as promoting them to
 * canonical); legacy rows keep the plain approve. Reject requires a typed
 * reason. The queue never invents dates, prices or tenants — everything on a
 * row comes from the DTO returned by GET /api/products/admin/pending.
 */

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button, Text, Title } from 'rizzui';
import { PiArrowClockwiseBold, PiHourglassMediumBold } from 'react-icons/pi';
import PendingQueueTable, {
  type PendingQueueTableMeta,
} from './pending-queue-table';
import RejectReasonModal from './reject-reason-modal';
import { usePendingProducts } from './use-pending-products';
import { routes } from '@/config/routes';
import type { PendingProductDTO } from '@/services/product.service';

export default function PendingQueueView({
  pageSize = 20,
}: {
  pageSize?: number;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token;
  const queue = usePendingProducts({ token, pageSize });
  const [rejectTarget, setRejectTarget] = useState<PendingProductDTO | null>(
    null
  );

  const meta: PendingQueueTableMeta = {
    approvingId: queue.approvingId,
    rejectingId: queue.rejectingId,
    onApprove: (product) => void queue.approve(product),
    onRejectClick: (product) => {
      // Stale errors from a previous row must not leak into a fresh modal.
      queue.clearRejectError();
      setRejectTarget(product);
    },
  };

  const emptyAll = !queue.rows.length && !queue.error && !queue.loading;

  return (
    <div className="py-6">
      <PageIntro
        total={queue.pagination?.total ?? queue.rows.length}
        loading={queue.loading}
      />

      <Toolbar
        search={queue.searchInput}
        onSearch={queue.setSearchInput}
        onRefresh={queue.refresh}
        loading={queue.loading}
      />

      {queue.error ? (
        <ErrorState message={queue.error} onRetry={queue.refresh} />
      ) : queue.actionError ? (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {queue.actionError}
        </p>
      ) : null}

      {queue.loading && !queue.rows.length ? (
        <PendingQueueSkeleton rows={6} />
      ) : emptyAll ? (
        <EmptyState />
      ) : (
        queue.rows.length > 0 && (
          <PendingQueueTable
            rows={queue.rows}
            meta={meta}
            pagination={queue.pagination}
            page={queue.page}
            limit={queue.limit}
            onPageChange={queue.setPage}
            onLimitChange={queue.setLimit}
          />
        )
      )}

      <RejectReasonModal
        isOpen={Boolean(rejectTarget)}
        productName={rejectTarget?.name ?? ''}
        inFlight={queue.rejectingId === rejectTarget?._id}
        errorMessage={queue.rejectError}
        onClose={() => setRejectTarget(null)}
        onSubmit={(reason) => {
          if (!rejectTarget) return;
          void queue.reject(rejectTarget, reason).then((ok) => {
            // Keep the modal open when the rejection failed so the typed
            // reason is never lost — the failure renders inside it.
            if (ok) setRejectTarget(null);
          });
        }}
      />
    </div>
  );
}

function PageIntro({
  total,
  loading,
}: {
  total: number;
  loading: boolean;
}) {
  return (
    <div className="mb-4">
      <Title as="h4" className="text-lg font-semibold text-gray-900">
        Pending approvals
      </Title>
      <Text className="mt-0.5 text-sm text-gray-500">
        Tenant submissions and drafts awaiting super-admin review. Approving a
        tenant-private product publishes it to the DrinksHarbour marketplace.
      </Text>
      {!loading ? (
        <Text className="mt-1 text-xs text-gray-400">
          {total} in the queue
        </Text>
      ) : null}
    </div>
  );
}

function Toolbar({
  search,
  onSearch,
  onRefresh,
  loading,
}: {
  search: string;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder="Search by name, slug or barcode…"
        aria-label="Search pending products"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="h-10 w-full max-w-sm rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-800 outline-none transition-all focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20 sm:w-auto sm:flex-1"
      />
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={loading}
        className="ms-auto"
      >
        <PiArrowClockwiseBold className="me-1.5 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-52 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-red-200 bg-red-50/40">
      <Text className="max-w-md text-center text-sm text-red-600">
        {message}
      </Text>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <PiArrowClockwiseBold className="me-1.5 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200">
      <PiHourglassMediumBold className="h-10 w-10 text-gray-300" aria-hidden />
      <Text className="font-medium text-gray-500">
        Nothing is pending approval — the queue is clear.
      </Text>
      <Text className="text-xs text-gray-400">
        Tenant submissions appear here automatically as they arrive.
      </Text>
      <Link
        href={routes.eCommerce.products}
        className="mt-1 rounded-lg text-sm font-semibold text-[#b20202] transition-colors hover:text-[#7f1d1d] focus-visible:ring-2 focus-visible:ring-[#b20202]"
      >
        Open the product catalogue →
      </Link>
    </div>
  );
}

/** Row-shaped skeletons matching the real table rhythm. */
function PendingQueueSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-muted">
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-muted px-4 py-3 last:border-0"
        >
          {/* Thumbnail + name/type stack (Product column) */}
          <div className="h-12 w-9 animate-pulse rounded-lg bg-gray-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-2.5 w-1/6 animate-pulse rounded bg-gray-100" />
          </div>
          {/* Submitted date + source chip + publication tag, same breakpoints
              as the real columns so the table never shifts on load. */}
          <div className="hidden h-3 w-16 animate-pulse rounded bg-gray-100 md:block" />
          <div className="hidden h-6 w-28 animate-pulse rounded-md bg-gray-100 md:block" />
          <div className="hidden h-6 w-24 animate-pulse rounded-md bg-gray-100 lg:block" />
          {/* Row actions */}
          <div className="ms-auto flex shrink-0 gap-2">
            <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-8 w-16 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
