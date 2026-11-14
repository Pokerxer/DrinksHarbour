'use client';

/**
 * Pairings list — data container. Mirrors the Banners list container:
 * session-token fetch, loading skeleton, error state with retry, empty state
 * with a create CTA, TanStack table (columns in pairings-columns.tsx), and a
 * ConfirmDialog for deletes.
 *
 * The list endpoint returns all rows (newest first, populated); the dataset
 * is small by construction (one row per source product), so there is no
 * server pagination — client pagination only.
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
  PiPathDuotone,
  PiPlusBold,
  PiSpinnerBold,
  PiWarningBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  merchandisingPairingService,
  type PairingListItem,
} from '@/services/merchandisingPairing.service';
import ConfirmDialog from '@/app/shared/confirm-dialog';
import { pairingsListColumns, type PairingRow } from './pairings-columns';

interface PairingsTableProps {
  pageSize?: number;
  className?: string;
}

export default function PairingsTable({
  pageSize = 20,
  className,
}: PairingsTableProps) {
  const { data: session, status: sessionStatus } = useSession() as unknown as {
    data: { token?: string; user?: { token?: string } } | null;
    status: string;
  };
  const token = session?.token || session?.user?.token || '';

  const [rows, setRows] = useState<PairingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PairingRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPairings = useCallback(async () => {
    if (sessionStatus !== 'authenticated' || !token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await merchandisingPairingService.list(token);
      if (response?.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
      } else {
        setRows([]);
      }
    } catch (err: any) {
      console.error('Error fetching pairings:', err);
      setError(err.message || 'Failed to fetch pairings');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchPairings();
  }, [sessionStatus, fetchPairings]);

  const handleToggleActive = useCallback(
    async (row: PairingRow) => {
      const sourceId = row.sourceProduct?._id;
      const suggestionIds = (row.suggestedProducts || []).map((p) => p._id);
      if (!sourceId || suggestionIds.length === 0) return;
      setBusyRowId(row._id ?? null);
      try {
        await merchandisingPairingService.upsert(token, {
          sourceProduct: sourceId,
          suggestedProducts: suggestionIds,
          active: !(row.active !== false),
        });
        toast.success(row.active !== false ? 'Pairing paused' : 'Pairing activated');
        fetchPairings();
      } catch (err: any) {
        toast.error(err.message || 'Failed to update pairing');
      } finally {
        setBusyRowId(null);
      }
    },
    [token, fetchPairings]
  );

  const handleDelete = useCallback(async () => {
    if (!pendingDelete?._id) return;
    setDeleting(true);
    try {
      await merchandisingPairingService.remove(pendingDelete._id, token);
      toast.success('Pairing deleted');
      setPendingDelete(null);
      fetchPairings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete pairing');
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, token, fetchPairings]);

  const meta = useMemo(
    () => ({
      onToggleActive: handleToggleActive,
      onDelete: (row: PairingRow) => setPendingDelete(row),
    }),
    [handleToggleActive]
  );

  const { table, setData } = useTanStackTable<PairingRow>({
    tableData: rows,
    columnConfig: pairingsListColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize },
      },
      enableColumnResizing: false,
      // TanStack's TableMeta is an empty extensible record in this version;
      // the cast is the same pattern the Banners columns use to read it back.
      meta: meta as TableMeta<PairingRow>,
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
        <Text className="text-gray-500">Please sign in to view pairings</Text>
      </div>
    );
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* Toolbar — same rounded-2xl white card language as the Banners list */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b20202]/10">
              <PiPathDuotone className="h-5 w-5 text-[#b20202]" />
            </span>
            <div>
              <Text className="font-semibold text-gray-900">
                Manual pairings
              </Text>
              <Text className="block text-xs text-gray-500">
                “Buy X with Y” — these outrank automatic recommendations on
                your storefront.
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Text className="whitespace-nowrap text-sm text-gray-500">
              {rows.length} pairing{rows.length !== 1 ? 's' : ''}
            </Text>
            <Button variant="outline" onClick={fetchPairings} className="h-10">
              <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Link href={routes.eCommerce.createPairing}>
              <Button className="h-10 border-0 bg-[#b20202] text-white hover:bg-[#9f0101]">
                <PiPlusBold className="mr-2 h-4 w-4" />
                New Pairing
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
            onClick={fetchPairings}
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
            No pairings yet
          </Text>
          <Text className="mb-6 text-gray-500">
            Tell shoppers what goes well with a product — pairings outrank all
            automatic recommendations.
          </Text>
          <Link href={routes.eCommerce.createPairing}>
            <Button className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]">
              <PiPlusBold className="mr-2 h-4 w-4" />
              Create Pairing
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
        title="Delete pairing"
        message={`Shoppers will stop seeing ${
          pendingDelete?.sourceProduct?.name || 'these'
        } suggestions. This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
