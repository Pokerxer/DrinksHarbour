'use client';

/**
 * Column definitions for the pairings list table.
 * Mirrors the banner list columns: thumbnail-first source cell, populated
 * suggestion chips, an active toggle, created date and row actions.
 * Row actions reach the data container through the table's `meta` — the
 * same pattern the Banners module uses (onDelete / onToggleActive).
 */

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { ActionIcon, Switch, Text, Tooltip } from 'rizzui';
import { PiPathDuotone, PiPencilLineBold, PiTrashBold } from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { PairingListItem, PairingProductRef } from '@/services/merchandisingPairing.service';

export type PairingRow = PairingListItem;

export const MAX_SUGGESTIONS = 4;

function ProductThumb({ product }: { product?: PairingProductRef | null }) {
  const src = product?.images?.[0]?.url;
  if (!src) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200">
        <PiPathDuotone className="h-5 w-5 text-gray-400" />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={product?.name || 'Product'} className="h-full w-full object-cover" />
    </div>
  );
}

interface TableActionMeta {
  onToggleActive?: (row: PairingRow) => void;
  onDelete?: (row: PairingRow) => void;
}

function RowActions({
  row,
  meta,
}: {
  row: PairingRow;
  meta?: TableActionMeta;
}) {
  if (!row._id) return null;
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip content="Edit" placement="top" color="invert">
        <Link
          href={`${routes.eCommerce.createPairing}?source=${row.sourceProduct?._id ?? ''}`}
        >
          <ActionIcon
            variant="outline"
            size="sm"
            aria-label="Edit pairing"
            className="hover:border-blue-400 hover:text-blue-600"
          >
            <PiPencilLineBold className="h-4 w-4" />
          </ActionIcon>
        </Link>
      </Tooltip>
      <Tooltip content="Delete" placement="top" color="invert">
        <ActionIcon
          variant="outline"
          size="sm"
          aria-label="Delete pairing"
          className="hover:border-red-400 hover:text-red-600"
          onClick={() => meta?.onDelete?.(row)}
        >
          <PiTrashBold className="h-4 w-4" />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}

const columnHelper = createColumnHelper<PairingRow>();

export const pairingsListColumns = [
  columnHelper.display({
    id: 'source',
    header: 'When shoppers view',
    size: 240,
    cell: ({ row }) => {
      const source = row.original?.sourceProduct;
      return (
        <div className="flex items-center gap-3">
          <ProductThumb product={source} />
          <div className="min-w-0">
            <Text className="line-clamp-1 font-semibold text-gray-900">
              {source?.name || '-'}
            </Text>
            {source?.type && (
              <Text className="text-xs capitalize text-gray-500">
                {source.type}
              </Text>
            )}
          </div>
        </div>
      );
    },
  }),

  columnHelper.display({
    id: 'suggestions',
    header: 'Suggests',
    size: 320,
    cell: ({ row }) => {
      const suggestions = row.original?.suggestedProducts || [];
      if (suggestions.length === 0) {
        return <Text className="text-xs text-gray-400">—</Text>;
      }
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {suggestions.map((product) => (
            <span
              key={product._id}
              className="flex max-w-[200px] items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-0.5 pl-0.5 pr-2"
            >
              <ProductThumb product={product} />
              <Text className="truncate text-xs font-medium text-gray-700">
                {product.name}
              </Text>
            </span>
          ))}
        </div>
      );
    },
  }),

  columnHelper.display({
    id: 'active',
    header: 'Active',
    size: 90,
    cell: ({ row, table }) => (
      <Switch
        checked={row.original?.active !== false}
        aria-label="Toggle pairing active"
        onChange={() =>
          (
            table.options.meta as TableActionMeta | undefined
          )?.onToggleActive?.(row.original)
        }
      />
    ),
  }),

  columnHelper.accessor('createdAt', {
    header: 'Created',
    size: 110,
    cell: ({ row }) => {
      const date = row.original?.createdAt;
      if (!date) return <Text className="text-sm text-gray-400">-</Text>;
      return (
        <Text className="text-sm text-gray-500">
          {new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      );
    },
  }),

  columnHelper.display({
    id: 'actions',
    header: '',
    size: 100,
    cell: ({ row, table }) => (
      <RowActions row={row.original} meta={table.options.meta as TableActionMeta} />
    ),
  }),
];
