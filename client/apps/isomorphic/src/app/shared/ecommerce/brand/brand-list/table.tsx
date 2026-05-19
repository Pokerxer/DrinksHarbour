// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { brandsColumns } from './columns';
import TableFooter from '@core/components/table/footer';
import TablePagination from '@core/components/table/pagination';
import BrandFilters from './filters';
import { getAdminBrands, deleteAdminBrand, AdminBrand } from '@/services/brand.service';
import { Button, Empty, Loader, Text } from 'rizzui';
import { PiArrowClockwiseBold, PiStorefrontBold } from 'react-icons/pi';
import Link from 'next/link';
import { routes } from '@/config/routes';

export type BrandDataType = AdminBrand;

export default function BrandTable() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;

  const [allBrands, setAllBrands] = useState<AdminBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [brandTypeFilter, setBrandTypeFilter] = useState('');
  const [primaryCategoryFilter, setPrimaryCategoryFilter] = useState('');

  // Apply client-side filters
  const filtered = useMemo(() => {
    return allBrands.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (brandTypeFilter && b.brandType !== brandTypeFilter) return false;
      if (primaryCategoryFilter && b.primaryCategory !== primaryCategoryFilter) return false;
      return true;
    });
  }, [allBrands, statusFilter, brandTypeFilter, primaryCategoryFilter]);

  const { table, setData } = useTanStackTable<BrandDataType>({
    tableData: filtered,
    columnConfig: brandsColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize: 10 },
      },
      meta: {
        handleDeleteRow: async (row: BrandDataType) => {
          if (!token) return;
          try {
            await deleteAdminBrand(token, row._id);
            setAllBrands((prev) => prev.filter((r) => r._id !== row._id));
          } catch (err: any) {
            alert(err.message || 'Failed to delete brand');
          }
        },
        handleMultipleDelete: (rows: BrandDataType[]) => {
          setAllBrands((prev) => prev.filter((r) => !rows.includes(r)));
        },
      },
      enableColumnResizing: false,
    },
  });

  // Keep table data in sync with filtered results
  useEffect(() => {
    setData(filtered);
    table.resetPageIndex();
  }, [filtered]);

  function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    getAdminBrands(token)
      .then(({ brands }) => setAllBrands(brands))
      .catch((err) => setError(err.message || 'Failed to load brands'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  // Reload when a brand is created from the modal
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('brand-created', handler);
    return () => window.removeEventListener('brand-created', handler);
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-3">
        <Loader variant="spinner" className="text-primary" />
        <Text className="text-sm text-gray-500">Loading brands...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-4">
        <Text className="text-sm text-red-500">{error}</Text>
        <Button size="sm" variant="outline" onClick={load}>
          <PiArrowClockwiseBold className="me-1.5 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <BrandFilters
        table={table}
        statusFilter={statusFilter}
        brandTypeFilter={brandTypeFilter}
        primaryCategoryFilter={primaryCategoryFilter}
        onStatusChange={setStatusFilter}
        onBrandTypeChange={setBrandTypeFilter}
        onPrimaryCategoryChange={setPrimaryCategoryFilter}
      />

      {filtered.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200">
          <PiStorefrontBold className="h-10 w-10 text-gray-300" />
          <Text className="font-medium text-gray-500">
            {allBrands.length === 0 ? 'No brands yet' : 'No brands match your filters'}
          </Text>
          {allBrands.length === 0 && (
            <Link href={routes.eCommerce.createBrand}>
              <Button size="sm">Add your first brand</Button>
            </Link>
          )}
          {allBrands.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setStatusFilter(''); setBrandTypeFilter(''); setPrimaryCategoryFilter(''); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <Table
            table={table}
            variant="modern"
            classNames={{
              container: 'border border-muted rounded-xl',
              rowClassName: 'last:border-0',
            }}
          />
          <TableFooter table={table} />
          <TablePagination table={table} className="py-4" />
        </>
      )}
    </>
  );
}
