'use client';

/**
 * Column config for the pending-products approval queue. Mirrors the
 * product-list columns (thumbnail + name + type, badges) and adds queue-only
 * context: when the product was submitted, from whom, and its publication
 * scope — reusing the shared `PublicationScopeTag` primitive.
 */

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { Badge, Flex, Text } from 'rizzui';
import { PiPackageBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import PublicationScopeTag from '../product-list/components/PublicationScopeTag';
import PendingQueueActions from './pending-queue-actions';
import type { PendingQueueTableMeta } from './pending-queue-table';
import type { PendingProductDTO } from '@/services/product.service';

const columnHelper = createColumnHelper<PendingProductDTO>();

function ProductImage({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <div className="flex h-12 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <PiPackageBold className="h-5 w-5 text-gray-400" />
      </div>
    );
  }
  return (
    // Same plain-<img> thumbnail as the product-list columns: images are
    // arbitrary tenant/CDN URLs that next/image's remote loader can't whitelist.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="h-12 w-9 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 object-contain p-0.5"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

/** Chip label for how the product entered the queue. */
function SubmissionSourceChip({ product }: { product: PendingProductDTO }) {
  const fallbackSource = product.submittingTenantName ? 'tenant' : 'admin';
  const source = product.submissionSource ?? fallbackSource;
  const labels: Record<string, string> = {
    tenant: 'Submitted by tenant',
    admin: 'Created by platform',
    importer: 'Imported',
    api: 'API import',
    bulk_upload: 'Bulk upload',
  };
  // Unknown machine values must never leak into the UI — degrade to the
  // computed fallback wording instead of the raw source string.
  const label = labels[source] ?? labels[fallbackSource];
  const isTenantSubmission = source === 'tenant';
  return (
    <Badge variant="flat" className="whitespace-nowrap font-medium">
      {isTenantSubmission ? (
        <span className="font-semibold">{label}</span>
      ) : (
        label
      )}
    </Badge>
  );
}

export const pendingProductColumns = [
  columnHelper.display({
    id: 'product',
    size: 300,
    header: 'Product',
    cell: ({ row }) => {
      const product = row.original;
      return (
        <Flex align="center" gap="3">
          <ProductImage src={product.imageUrl} name={product.name} />
          <div className="min-w-0">
            <Link href={routes.eCommerce.productDetails(product.slug || product._id)}>
              <Text className="max-w-[220px] truncate font-semibold text-gray-900 transition-colors hover:text-[#b20202]">
                {product.name}
              </Text>
            </Link>
            {product.type && (
              <Text className="text-xs capitalize text-gray-500">
                {product.type.replace(/_/g, ' ')}
              </Text>
            )}
          </div>
        </Flex>
      );
    },
  }),

  columnHelper.display({
    id: 'submitted',
    size: 150,
    header: 'Submitted',
    cell: ({ row }) => {
      if (!row.original.createdAt)
        return <Text className="text-xs text-gray-400">—</Text>;
      return (
        <Text className="text-xs tabular-nums text-gray-700">
          {new Date(row.original.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      );
    },
  }),

  columnHelper.display({
    id: 'source',
    size: 180,
    header: 'Source',
    cell: ({ row }) => <SubmissionSourceChip product={row.original} />,
  }),

  columnHelper.display({
    id: 'scope',
    size: 190,
    header: 'Publication',
    cell: ({ row }) => (
      <PublicationScopeTag
        publicationScope={row.original.publicationScope}
        owningTenantName={row.original.owningTenantName}
      />
    ),
  }),

  columnHelper.display({
    id: 'action',
    size: 260,
    header: '',
    cell: ({ row, table }) => {
      // TanStack meta is an open interface; narrow it once to the queue's
      // contract (see PendingQueueTableMeta in pending-queue-table.tsx).
      const meta = table.options.meta as PendingQueueTableMeta | undefined;
      return (
        <PendingQueueActions
          product={row.original}
          approveBusy={meta?.approvingId === row.original._id}
          rejectBusy={meta?.rejectingId === row.original._id}
          onApprove={(p) => meta?.onApprove?.(p)}
          onReject={(p) => meta?.onRejectClick?.(p)}
        />
      );
    },
  }),
];
