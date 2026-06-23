// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { categoriesColumns } from './columns';
import TableFooter from '@core/components/table/footer';
import TablePagination from '@core/components/table/pagination';
import Filters from './filters';
import { getAdminCategories, deleteAdminCategory, AdminCategory } from '@/services/category.service';
import { Button, Empty, Loader, Text } from 'rizzui';
import { PiArrowClockwiseBold, PiTagBold } from 'react-icons/pi';
import Link from 'next/link';
import { routes } from '@/config/routes';

export type CategoryDataType = AdminCategory;

export default function CategoryTable() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;

  const [allCategories, setAllCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Apply client-side filters
  const filtered = useMemo(() => {
    return allCategories.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (typeFilter && c.type !== typeFilter) return false;
      return true;
    });
  }, [allCategories, statusFilter, typeFilter]);

  const { table, setData } = useTanStackTable<CategoryDataType>({
    tableData: filtered,
    columnConfig: categoriesColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize: 10 },
      },
      meta: {
        handleDeleteRow: async (row: CategoryDataType) => {
          if (!token) return;
          try {
            await deleteAdminCategory(token, row._id);
            setAllCategories((prev) => prev.filter((r) => r._id !== row._id));
          } catch (err: any) {
            alert(err.message || 'Failed to delete category');
          }
        },
        handleMultipleDelete: (rows: CategoryDataType[]) => {
          setAllCategories((prev) => prev.filter((r) => !rows.includes(r)));
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
    getAdminCategories(token)
      .then(({ categories }) => setAllCategories(categories))
      .catch((err) => setError(err.message || 'Failed to load categories'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  // Reload when a category is created from the modal (dispatched by header)
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('category-created', handler);
    return () => window.removeEventListener('category-created', handler);
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-3">
        <Loader variant="spinner" className="text-primary" />
        <Text className="text-sm text-gray-500">Loading categories...</Text>
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
      <Filters
        table={table}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
      />

      {filtered.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200">
          <PiTagBold className="h-10 w-10 text-gray-300" />
          <Text className="font-medium text-gray-500">
            {allCategories.length === 0 ? 'No categories yet' : 'No categories match your filters'}
          </Text>
          {allCategories.length === 0 && (
            <Link href={routes.eCommerce.createCategory}>
              <Button size="sm">Add your first category</Button>
            </Link>
          )}
          {allCategories.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setStatusFilter(''); setTypeFilter(''); }}
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
