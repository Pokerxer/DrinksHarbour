// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { subCategoriesColumns } from './columns';
import TableFooter from '@core/components/table/footer';
import TablePagination from '@core/components/table/pagination';
import Filters from './filters';
import { getAdminSubCategories, deleteAdminSubCategory, AdminSubCategory } from '@/services/subcategory.service';
import { Button, Empty, Loader, Text } from 'rizzui';
import { PiArrowClockwiseBold, PiTagBold } from 'react-icons/pi';
import Link from 'next/link';
import { routes } from '@/config/routes';

export type SubCategoryDataType = AdminSubCategory;

export default function SubCategoryTable() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;

  const [allSubCategories, setAllSubCategories] = useState<AdminSubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [parentFilter, setParentFilter] = useState('');

  // Apply client-side filters then sort: group by parent name, then by displayOrder within each group
  const filtered = useMemo(() => {
    const result = allSubCategories.filter((sc) => {
      if (statusFilter && sc.status !== statusFilter) return false;
      if (parentFilter) {
        const parentId = typeof sc.parent === 'object' && sc.parent !== null
          ? sc.parent._id
          : sc.parent;
        if (parentId !== parentFilter) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      const aParent = typeof a.parent === 'object' && a.parent !== null ? a.parent.name : '';
      const bParent = typeof b.parent === 'object' && b.parent !== null ? b.parent.name : '';
      const parentCmp = aParent.localeCompare(bParent);
      if (parentCmp !== 0) return parentCmp;
      return (a.displayOrder ?? 999) - (b.displayOrder ?? 999);
    });
  }, [allSubCategories, statusFilter, parentFilter]);

  const { table, setData } = useTanStackTable<SubCategoryDataType>({
    tableData: filtered,
    columnConfig: subCategoriesColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize: 10 },
      },
      meta: {
        handleDeleteRow: async (row: SubCategoryDataType) => {
          if (!token) return;
          try {
            await deleteAdminSubCategory(token, row._id);
            setAllSubCategories((prev) => prev.filter((r) => r._id !== row._id));
          } catch (err: any) {
            alert(err.message || 'Failed to delete subcategory');
          }
        },
        handleMultipleDelete: (rows: SubCategoryDataType[]) => {
          setAllSubCategories((prev) => prev.filter((r) => !rows.includes(r)));
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
    getAdminSubCategories(token)
      .then(({ subcategories }) => setAllSubCategories(subcategories))
      .catch((err) => setError(err.message || 'Failed to load subcategories'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  // Reload when a subcategory is created from the modal (dispatched by header)
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('subcategory-created', handler);
    return () => window.removeEventListener('subcategory-created', handler);
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-3">
        <Loader variant="spinner" className="text-primary" />
        <Text className="text-sm text-gray-500">Loading subcategories...</Text>
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
        parentFilter={parentFilter}
        onStatusChange={setStatusFilter}
        onParentChange={setParentFilter}
      />

      {filtered.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200">
          <PiTagBold className="h-10 w-10 text-gray-300" />
          <Text className="font-medium text-gray-500">
            {allSubCategories.length === 0 ? 'No subcategories yet' : 'No subcategories match your filters'}
          </Text>
          {allSubCategories.length === 0 && (
            <Link href={routes.eCommerce.createSubCategory}>
              <Button size="sm">Add your first subcategory</Button>
            </Link>
          )}
          {allSubCategories.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setStatusFilter(''); setParentFilter(''); }}
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
