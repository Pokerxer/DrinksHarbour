// @ts-nocheck
'use client';

/**
 * Column definitions for the banners list table.
 * Badges come from banner-shared so list, details and form always match.
 */

import { useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { ActionIcon, Checkbox, Text, Tooltip } from 'rizzui';
import {
  PiPencilLineBold,
  PiEyeBold,
  PiCopyBold,
  PiTrashBold,
  PiPlayBold,
  PiPauseBold,
  PiSpinnerBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  StatusBadge,
  PriorityBadge,
  TypeBadge,
  PlacementLabel,
} from '../banner-shared';

export interface BannerListItem {
  _id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  slug?: string;
  image?: { url?: string; alt?: string };
  mobileImage?: { url?: string };
  type?: string;
  placement?: string;
  displayOrder?: number;
  priority?: string;
  status?: string;
  isActive?: boolean;
  isGlobal?: boolean;
  impressions?: number;
  clicks?: number;
  clickThroughRate?: number;
  conversionCount?: number;
  conversionRate?: number;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  notes?: string;
}

const columnHelper = createColumnHelper<BannerListItem>();

function BannerThumb({ src, alt }: { src?: string; alt?: string }) {
  if (!src) {
    return (
      <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200">
        <Text className="text-xs text-gray-400">No img</Text>
      </div>
    );
  }
  return (
    <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt || 'Banner'} className="h-full w-full object-cover" />
    </div>
  );
}

interface TableActionMeta {
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onClone?: (id: string) => void;
}

/**
 * Row action buttons. Extracted as a real component: the previous inline
 * version called useState inside a cell renderer with an eslint-disable —
 * illegal hook usage that breaks when rows reorder or unmount.
 */
function RowActions({
  banner,
  meta,
}: {
  banner: BannerListItem;
  meta?: TableActionMeta;
}) {
  const id = banner._id;
  const status = banner.status;
  const [cloning, setCloning] = useState(false);

  if (!id) return null;

  const isActive = status === 'active';
  const isPaused = status === 'paused';

  return (
    <div className="flex items-center justify-end gap-1.5">
      {(isActive || isPaused) && (
        <Tooltip
          content={isActive ? 'Pause' : 'Activate'}
          placement="top"
          color="invert"
        >
          <ActionIcon
            variant="outline"
            size="sm"
            aria-label={isActive ? 'Pause banner' : 'Activate banner'}
            className={
              isActive
                ? 'hover:border-amber-400 hover:text-amber-600'
                : 'hover:border-green-400 hover:text-green-600'
            }
            onClick={() => meta?.onStatusChange?.(id, isActive ? 'paused' : 'active')}
          >
            {isActive ? (
              <PiPauseBold className="h-4 w-4" />
            ) : (
              <PiPlayBold className="h-4 w-4" />
            )}
          </ActionIcon>
        </Tooltip>
      )}

      <Tooltip content="View" placement="top" color="invert">
        <Link href={routes.eCommerce.bannerDetails(id)}>
          <ActionIcon variant="outline" size="sm" aria-label="View banner">
            <PiEyeBold className="h-4 w-4" />
          </ActionIcon>
        </Link>
      </Tooltip>

      <Tooltip content="Edit" placement="top" color="invert">
        <Link href={routes.eCommerce.editBanner(id)}>
          <ActionIcon variant="outline" size="sm" aria-label="Edit banner">
            <PiPencilLineBold className="h-4 w-4" />
          </ActionIcon>
        </Link>
      </Tooltip>

      <Tooltip content="Clone" placement="top" color="invert">
        <ActionIcon
          variant="outline"
          size="sm"
          aria-label="Clone banner"
          className="hover:border-blue-400 hover:text-blue-600"
          onClick={async () => {
            setCloning(true);
            await meta?.onClone?.(id);
            setCloning(false);
          }}
          disabled={cloning}
        >
          {cloning ? (
            <PiSpinnerBold className="h-4 w-4 animate-spin" />
          ) : (
            <PiCopyBold className="h-4 w-4" />
          )}
        </ActionIcon>
      </Tooltip>

      <Tooltip content="Delete" placement="top" color="invert">
        <ActionIcon
          variant="outline"
          size="sm"
          aria-label="Delete banner"
          className="hover:border-red-400 hover:text-red-600"
          onClick={() => meta?.onDelete?.(id)}
        >
          <PiTrashBold className="h-4 w-4" />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}

export const bannersListColumns = [
  columnHelper.display({
    id: 'select',
    size: 50,
    header: ({ table }) => (
      <Checkbox
        className="ps-3.5"
        aria-label="Select all rows"
        checked={table.getIsAllPageRowsSelected()}
        onChange={() => table.toggleAllPageRowsSelected()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        className="ps-3.5"
        aria-label="Select row"
        checked={row.getIsSelected()}
        onChange={() => row.toggleSelected()}
      />
    ),
  }),

  columnHelper.display({
    id: 'image',
    header: 'Image',
    size: 100,
    cell: ({ row }) => (
      <BannerThumb src={row.original?.image?.url} alt={row.original?.title} />
    ),
  }),

  columnHelper.accessor('title', {
    header: 'Title',
    size: 240,
    cell: ({ row }) => {
      const title = row.original?.title;
      const subtitle = row.original?.subtitle;
      return (
        <div className="flex flex-col">
          <Text className="line-clamp-1 font-semibold text-gray-900">
            {title || '-'}
          </Text>
          {subtitle && (
            <Text className="mt-0.5 line-clamp-1 text-xs text-gray-500">
              {subtitle}
            </Text>
          )}
        </div>
      );
    },
  }),

  columnHelper.accessor('type', {
    header: 'Type',
    size: 120,
    cell: ({ row }) => <TypeBadge type={row.original?.type} />,
  }),

  columnHelper.display({
    id: 'placement',
    header: 'Placement',
    size: 140,
    cell: ({ row }) => <PlacementLabel placement={row.original?.placement} />,
  }),

  columnHelper.accessor('priority', {
    header: 'Priority',
    size: 100,
    cell: ({ row }) => <PriorityBadge priority={row.original?.priority} />,
  }),

  columnHelper.accessor('status', {
    header: 'Status',
    size: 110,
    cell: ({ row }) => <StatusBadge status={row.original?.status} size="sm" />,
  }),

  columnHelper.display({
    id: 'displayOrder',
    header: 'Order',
    size: 70,
    cell: ({ row }) => (
      <Text className="text-center font-medium">
        {row.original?.displayOrder ?? '-'}
      </Text>
    ),
  }),

  columnHelper.accessor('clickThroughRate', {
    header: 'CTR',
    size: 80,
    cell: ({ row }) => (
      <Text className="tabular-nums text-gray-600">
        {(row.original?.clickThroughRate ?? 0).toFixed(1)}%
      </Text>
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
    size: 150,
    cell: ({ row, table }) => (
      <RowActions
        banner={row.original}
        meta={table.options.meta as TableActionMeta}
      />
    ),
  }),
];
