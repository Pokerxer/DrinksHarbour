'use client';

/**
 * Campaigns list — data container. Mirrors the Pairings list container:
 * session-token fetch, loading skeleton, error state with retry, empty state
 * with a create CTA, TanStack table (columns in campaigns-columns.tsx), and a
 * ConfirmDialog for deletes.
 *
 * Campaign rows carry the central Product id only (the list endpoint does not
 * populate it), so product names/thumbnails are resolved client-side from the
 * same admin product search the banner/pairing pickers use.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { TableMeta } from '@tanstack/react-table';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import toast from 'react-hot-toast';
import { Button, Text } from 'rizzui';
import Link from 'next/link';
import {
  PiArrowsClockwiseBold,
  PiMegaphoneDuotone,
  PiPlusBold,
  PiSpinnerBold,
  PiWarningBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  adsService,
  type AdCampaignRow,
} from '@/services/ads.service';
import { productService } from '@/services/product.service';
import ConfirmDialog from '@/app/shared/confirm-dialog';
import {
  campaignsListColumns,
  type CampaignRow,
  type CampaignTableMeta,
} from './campaigns-columns';

interface CampaignsTableProps {
  pageSize?: number;
  className?: string;
}

interface ProductLabel {
  name: string;
  image?: string;
}

export default function CampaignsTable({
  pageSize = 20,
  className,
}: CampaignsTableProps) {
  const { data: session, status: sessionStatus } = useSession() as unknown as {
    data: { token?: string; user?: { token?: string } } | null;
    status: string;
  };
  const token = session?.token || session?.user?.token || '';

  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [productLabels, setProductLabels] = useState<Map<string, ProductLabel>>(
    () => new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CampaignRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (sessionStatus !== 'authenticated' || !token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [campaignRes, productRes] = await Promise.all([
        adsService.list(token),
        productService
          .getProducts(token, { limit: 100, page: 1 })
          .catch(() => null),
      ]);
      const list = (campaignRes as { data?: AdCampaignRow[] })?.data;
      setRows(Array.isArray(list) ? list : []);

      const products =
        (
          productRes as {
            data?: { products?: { _id: string; name?: string; images?: { url?: string }[] }[] };
          } | null
        )?.data?.products || [];
      const labels = new Map<string, ProductLabel>();
      for (const product of products) {
        labels.set(product._id, {
          name: product.name || product._id,
          image: product.images?.[0]?.url,
        });
      }
      setProductLabels(labels);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      setError(err.message || 'Failed to fetch campaigns');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchCampaigns();
  }, [sessionStatus, fetchCampaigns]);

  const handleToggleStatus = useCallback(
    async (row: CampaignRow) => {
      if (!row._id) return;
      const next = row.status === 'active' ? 'paused' : 'active';
      setBusyRowId(row._id);
      try {
        await adsService.setStatus(token, row._id, next);
        toast.success(next === 'paused' ? 'Campaign paused' : 'Campaign activated');
        fetchCampaigns();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update campaign');
      } finally {
        setBusyRowId(null);
      }
    },
    [token, fetchCampaigns]
  );

  const handleDelete = useCallback(async () => {
    if (!pendingDelete?._id) return;
    setDeleting(true);
    try {
      await adsService.remove(token, pendingDelete._id);
      toast.success('Campaign deleted');
      setPendingDelete(null);
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete campaign');
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, token, fetchCampaigns]);

  const meta = useMemo<CampaignTableMeta>(
    () => ({
      productLabels,
      onToggleStatus: handleToggleStatus,
      onDelete: (row: CampaignRow) => setPendingDelete(row),
    }),
    [handleToggleStatus, productLabels]
  );

  const { table, setData } = useTanStackTable<CampaignRow>({
    tableData: rows,
    columnConfig: campaignsListColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize },
      },
      enableColumnResizing: false,
      // TanStack's TableMeta is an empty extensible record in this version;
      // the cast is the same pattern the Banners columns use to read it back.
      meta: meta as TableMeta<CampaignRow>,
    },
  });

  useEffect(() => {
    setData(rows);
  }, [rows, setData]);

  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <PiSpinnerBold className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (sessionStatus !== 'authenticated') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Text className="text-gray-500">Please sign in to view campaigns</Text>
      </div>
    );
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* Toolbar — same rounded-2xl white card language as the Pairings list */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b20202]/10">
              <PiMegaphoneDuotone className="h-5 w-5 text-[#b20202]" />
            </span>
            <div>
              <Text className="font-semibold text-gray-900">
                Sponsored campaigns
              </Text>
              <Text className="block text-xs text-gray-500">
                Pay per verified click out of your prepaid ad wallet — placements
                are always labelled “Sponsored”.
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Text className="whitespace-nowrap text-sm text-gray-500">
              {rows.length} campaign{rows.length !== 1 ? 's' : ''}
            </Text>
            <Button variant="outline" onClick={fetchCampaigns} className="h-10">
              <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Link href={routes.eCommerce.createCampaign}>
              <Button className="h-10 border-0 bg-[#b20202] text-white hover:bg-[#9f0101]">
                <PiPlusBold className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Data */}
      {isLoading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <PiSpinnerBold className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <PiWarningBold className="h-8 w-8 text-red-500" />
          </div>
          <Text className="mb-2 text-lg font-bold text-red-600">
            Something went wrong
          </Text>
          <Text className="mb-6 text-gray-500">{error}</Text>
          <Button
            onClick={fetchCampaigns}
            className="inline-flex items-center gap-2 border-0 bg-red-500 text-white hover:bg-red-600"
          >
            <PiArrowsClockwiseBold className="mr-1 h-4 w-4" />
            Try Again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <PiPlusBold className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="mb-2 text-lg font-semibold text-gray-900">
            No campaigns yet
          </Text>
          <Text className="mb-6 text-gray-500">
            Promote a product on product pages and in the cart — you only pay for
            verified clicks from your prepaid wallet.
          </Text>
          <Link href={routes.eCommerce.createCampaign}>
            <Button className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]">
              <PiPlusBold className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <Table table={table} variant="modern" />
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete campaign"
        message={`“${pendingDelete?.name || 'This campaign'}” will stop running and its stats will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
