'use client';

/**
 * Column definitions for the campaigns table.
 * Mirrors the pairings columns: thumbnail-first product cell, surface chips,
 * a status chip with a fixed color map, spend progress against the daily
 * budget, click/impression counters and row actions.
 * Row actions reach the data container through the table's `meta` — the
 * same pattern the Banners/Pairings modules use (onDelete / onToggleStatus).
 */

import { createColumnHelper } from '@tanstack/react-table';
import { ActionIcon, Text, Tooltip } from 'rizzui';
import { PiPauseBold, PiPackage, PiPlayBold, PiTrashBold } from 'react-icons/pi';
import type { AdCampaignRow, AdSurface } from '@/services/ads.service';

export type CampaignRow = AdCampaignRow;

/** Deletable statuses — an active campaign must be paused first (server rule). */
const DELETABLE_STATUSES = new Set(['draft', 'paused', 'expired']);

/** Fixed status chip color map (plain string → one styling branch each). */
const STATUS_CHIP_CLASSES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  budget_exhausted: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-300',
  suspended: 'bg-red-50 text-red-700 border-red-200',
};

export function StatusChip({ status }: { status?: string }) {
  const classes =
    STATUS_CHIP_CLASSES[status ?? ''] ??
    'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      {status || '—'}
    </span>
  );
}

const SURFACE_LABELS: Record<AdSurface, string> = {
  pdp: 'PDP',
  cart: 'Cart',
};

function SurfaceChips({ surfaces }: { surfaces?: AdSurface[] }) {
  if (!surfaces?.length) return <Text className="text-xs text-gray-400">—</Text>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {surfaces.map((surface) => (
        <span
          key={surface}
          className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700"
        >
          {SURFACE_LABELS[surface] || surface}
        </span>
      ))}
    </div>
  );
}

function ProductCell({
  productId,
  meta,
}: {
  productId?: string;
  meta?: CampaignTableMeta;
}) {
  const product = productId ? meta?.productLabels?.get(productId) : null;
  if (!product) return <Text className="text-xs text-gray-400">—</Text>;
  return (
    <div className="flex items-center gap-2.5">
      {product.image ? (
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
          <PiPackage className="h-4 w-4 text-gray-400" />
        </div>
      )}
      <Text className="line-clamp-2 text-sm font-medium text-gray-900">
        {product.name}
      </Text>
    </div>
  );
}

function SpendCell({ row }: { row: CampaignRow }) {
  const spent = row.spentToday ?? 0;
  const budget = row.dailyBudget ?? 0;
  const percent =
    budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  return (
    <div className="min-w-[140px]">
      <Text className="text-sm text-gray-700">
        ₦{spent.toLocaleString('en-NG')} of ₦{budget.toLocaleString('en-NG')} today
      </Text>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${
            percent >= 100 ? 'bg-red-500' : 'bg-[#b20202]'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export interface CampaignTableMeta {
  /** Client-side product name/thumb map keyed by central Product id. */
  productLabels?: Map<string, { name: string; image?: string }>;
  onToggleStatus?: (row: CampaignRow) => void;
  onDelete?: (row: CampaignRow) => void;
}

function RowActions({
  row,
  meta,
}: {
  row: CampaignRow;
  meta?: CampaignTableMeta;
}) {
  if (!row._id) return null;
  const isActive = row.status === 'active';
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip
        content={isActive ? 'Pause' : 'Activate'}
        placement="top"
        color="invert"
      >
        <ActionIcon
          variant="outline"
          size="sm"
          aria-label={`${isActive ? 'Pause' : 'Activate'} ${row.name || 'campaign'}`}
          className={
            isActive
              ? 'hover:border-amber-400 hover:text-amber-600'
              : 'hover:border-emerald-400 hover:text-emerald-600'
          }
          onClick={() => meta?.onToggleStatus?.(row)}
        >
          {isActive ? (
            <PiPauseBold className="h-4 w-4" />
          ) : (
            <PiPlayBold className="h-4 w-4" />
          )}
        </ActionIcon>
      </Tooltip>
      {DELETABLE_STATUSES.has(row.status || '') && (
        <Tooltip content="Delete" placement="top" color="invert">
          <ActionIcon
            variant="outline"
            size="sm"
            aria-label={`Delete ${row.name || 'campaign'}`}
            className="hover:border-red-400 hover:text-red-600"
            onClick={() => meta?.onDelete?.(row)}
          >
            <PiTrashBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
      )}
    </div>
  );
}

const columnHelper = createColumnHelper<CampaignRow>();

/**
 * Static column config — `useTanStackTable` captures columns once at mount, so
 * any per-render data (the product label map) must reach cells through the
 * table's `meta`, which is re-read on every render.
 */
export const campaignsListColumns = [
    columnHelper.accessor('name', {
      header: 'Campaign',
      size: 200,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Text className="line-clamp-1 font-semibold text-gray-900">
            {row.original?.name || '—'}
          </Text>
          {(row.original?.startsAt || row.original?.endsAt) && (
            <Text className="text-xs text-gray-500">
              {row.original?.startsAt
                ? new Date(row.original.startsAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : '…'}
              {' – '}
              {row.original?.endsAt
                ? new Date(row.original.endsAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : '…'}
            </Text>
          )}
        </div>
      ),
    }),

    columnHelper.display({
      id: 'product',
      header: 'Product',
      size: 220,
      cell: ({ row, table }) => (
        <ProductCell
          productId={row.original?.product}
          meta={table.options.meta as CampaignTableMeta}
        />
      ),
    }),

    columnHelper.display({
      id: 'surfaces',
      header: 'Surfaces',
      size: 130,
      cell: ({ row }) => <SurfaceChips surfaces={row.original?.surfaces} />,
    }),

    columnHelper.display({
      id: 'status',
      header: 'Status',
      size: 130,
      cell: ({ row }) => <StatusChip status={row.original?.status} />,
    }),

    columnHelper.display({
      id: 'spend',
      header: "Today's spend",
      size: 170,
      cell: ({ row }) => <SpendCell row={row.original} />,
    }),

    columnHelper.display({
      id: 'performance',
      header: 'Clicks / Impressions',
      size: 150,
      cell: ({ row }) => (
        <Text className="text-sm text-gray-700">
          {(row.original?.clicksTotal ?? 0).toLocaleString('en-NG')} /{' '}
          {(row.original?.impressionsTotal ?? 0).toLocaleString('en-NG')}
        </Text>
      ),
    }),

    columnHelper.display({
      id: 'actions',
      header: '',
      size: 100,
      cell: ({ row, table }) => (
        <RowActions
          row={row.original}
          meta={table.options.meta as CampaignTableMeta}
        />
      ),
    }),
];
