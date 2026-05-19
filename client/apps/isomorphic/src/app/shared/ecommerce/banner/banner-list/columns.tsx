// @ts-nocheck
'use client';

import { routes } from '@/config/routes';
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
import { useState } from 'react';
import { BANNER_TYPE_OPTIONS, BANNER_PLACEMENT_OPTIONS } from '@/types/banner.types';

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

function getStatusBadge(status: string | undefined) {
  if (!status) return { label: '-', bg: 'bg-gray-100', text: 'text-gray-600' };
  
  const badges: Record<string, { label: string; bg: string; text: string }> = {
    draft:     { label: 'Draft',     bg: 'bg-gray-100', text: 'text-gray-600' },
    scheduled: { label: 'Scheduled',  bg: 'bg-amber-100', text: 'text-amber-700' },
    active:    { label: 'Active',    bg: 'bg-green-100', text: 'text-green-700' },
    paused:    { label: 'Paused',    bg: 'bg-orange-100', text: 'text-orange-700' },
    expired:   { label: 'Expired',   bg: 'bg-red-100', text: 'text-red-700' },
    archived:  { label: 'Archived',  bg: 'bg-gray-100', text: 'text-gray-600' },
  };
  
  return badges[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
}

function getTypeBadge(type: string | undefined) {
  if (!type) return { label: '-', bg: 'bg-gray-100', text: 'text-gray-600' };
  
  const badges: Record<string, { label: string; bg: string; text: string }> = {
    hero:         { label: 'Hero',         bg: 'bg-blue-100', text: 'text-blue-700' },
    promotional:  { label: 'Promotional',  bg: 'bg-purple-100', text: 'text-purple-700' },
    category:    { label: 'Category',     bg: 'bg-green-100', text: 'text-green-700' },
    product:     { label: 'Product',      bg: 'bg-orange-100', text: 'text-orange-700' },
    seasonal:    { label: 'Seasonal',     bg: 'bg-amber-100', text: 'text-amber-700' },
    announcement:{ label: 'Announcement', bg: 'bg-pink-100', text: 'text-pink-700' },
    custom:      { label: 'Custom',       bg: 'bg-gray-100', text: 'text-gray-600' },
  };
  
  return badges[type] || { label: type, bg: 'bg-gray-100', text: 'text-gray-600' };
}

function getPriorityBadge(priority: string | undefined) {
  if (!priority) return { label: '-', bg: 'bg-gray-100', text: 'text-gray-600' };
  
  const badges: Record<string, { label: string; bg: string; text: string }> = {
    low:    { label: 'Low',    bg: 'bg-gray-100', text: 'text-gray-600' },
    medium: { label: 'Medium', bg: 'bg-amber-100', text: 'text-amber-700' },
    high:   { label: 'High',   bg: 'bg-red-100', text: 'text-red-700' },
    urgent: { label: 'Urgent', bg: 'bg-red-100', text: 'text-red-700' },
  };
  
  return badges[priority] || { label: priority, bg: 'bg-gray-100', text: 'text-gray-600' };
}

function BannerImage({ src, alt }: { src?: string; alt?: string }) {
  if (!src) {
    return (
      <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 border border-gray-200">
        <Text className="text-gray-400 text-xs">No img</Text>
      </div>
    );
  }
  return (
    <div className="w-16 h-12 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50">
      <img src={src} alt={alt || 'Banner'} className="w-full h-full object-cover" />
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const badge = getStatusBadge(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

function TypeBadge({ type }: { type?: string }) {
  const badge = getTypeBadge(type);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  const badge = getPriorityBadge(priority);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
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
      <BannerImage src={row.original?.image?.url} alt={row.original?.title} />
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
          <Text className="font-semibold text-gray-900 line-clamp-1">{title || '-'}</Text>
          {subtitle && (
            <Text className="text-gray-500 text-xs line-clamp-1 mt-0.5">{subtitle}</Text>
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

  columnHelper.accessor('placement', {
    header: 'Placement',
    size: 140,
    cell: ({ row }) => {
      const placement = row.original?.placement;
      if (!placement) return <Text className="text-gray-400 text-sm">-</Text>;
      const label = BANNER_PLACEMENT_OPTIONS.find(p => p.value === placement)?.label || placement;
      return <Text className="text-gray-700 text-sm">{label}</Text>;
    },
  }),

  columnHelper.accessor('priority', {
    header: 'Priority',
    size: 100,
    cell: ({ row }) => <PriorityBadge priority={row.original?.priority} />,
  }),

  columnHelper.accessor('status', {
    header: 'Status',
    size: 110,
    cell: ({ row }) => <StatusBadge status={row.original?.status} />,
  }),

  columnHelper.display({
    id: 'displayOrder',
    header: 'Order',
    size: 70,
    cell: ({ row }) => (
      <Text className="font-medium text-center">{row.original?.displayOrder ?? '-'}</Text>
    ),
  }),

  columnHelper.accessor('createdAt', {
    header: 'Created',
    size: 110,
    cell: ({ row }) => {
      const date = row.original?.createdAt;
      if (!date) return <Text className="text-gray-400 text-sm">-</Text>;
      return (
        <Text className="text-gray-500 text-sm">
          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      );
    },
  }),

  columnHelper.display({
    id: 'actions',
    header: '',
    size: 150,
    cell: ({ row, table }) => {
      const id = row.original?._id;
      const status = row.original?.status;
      if (!id) return null;

      const meta = table.options.meta as any;
      const isActive = status === 'active';
      const isPaused = status === 'paused';
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [cloning, setCloning] = useState(false);

      const handleClone = async () => {
        setCloning(true);
        await meta?.onClone?.(id);
        setCloning(false);
      };

      return (
        <div className="flex items-center justify-end gap-1.5">
          {(isActive || isPaused) && (
            <Tooltip content={isActive ? 'Pause' : 'Activate'} placement="top" color="invert">
              <ActionIcon
                variant="outline"
                size="sm"
                className={isActive ? 'hover:text-amber-600 hover:border-amber-400' : 'hover:text-green-600 hover:border-green-400'}
                onClick={() => meta?.onStatusChange?.(id, isActive ? 'paused' : 'active')}
              >
                {isActive ? <PiPauseBold className="w-4 h-4" /> : <PiPlayBold className="w-4 h-4" />}
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip content="View" placement="top" color="invert">
            <Link href={routes.eCommerce.bannerDetails(id)}>
              <ActionIcon variant="outline" size="sm" className="hover:text-gray-900">
                <PiEyeBold className="w-4 h-4" />
              </ActionIcon>
            </Link>
          </Tooltip>

          <Tooltip content="Edit" placement="top" color="invert">
            <Link href={routes.eCommerce.editBanner(id)}>
              <ActionIcon variant="outline" size="sm" className="hover:text-gray-900">
                <PiPencilLineBold className="w-4 h-4" />
              </ActionIcon>
            </Link>
          </Tooltip>

          <Tooltip content="Clone" placement="top" color="invert">
            <ActionIcon
              variant="outline"
              size="sm"
              className="hover:text-blue-600 hover:border-blue-400"
              onClick={handleClone}
              disabled={cloning}
            >
              {cloning ? <PiSpinnerBold className="w-4 h-4 animate-spin" /> : <PiCopyBold className="w-4 h-4" />}
            </ActionIcon>
          </Tooltip>

          <Tooltip content="Delete" placement="top" color="invert">
            <ActionIcon
              variant="outline"
              size="sm"
              className="hover:text-red-600 hover:border-red-400"
              onClick={() => meta?.onDelete?.(id)}
            >
              <PiTrashBold className="w-4 h-4" />
            </ActionIcon>
          </Tooltip>
        </div>
      );
    },
  }),
];
