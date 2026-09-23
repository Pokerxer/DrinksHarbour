'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { tenantsColumns } from './columns';
import toast from 'react-hot-toast';
import TablePagination from '@core/components/table/pagination';
import TenantFilters from './filters';
import { getAdminTenants, deleteAdminTenants, AdminTenant } from '@/services/tenant.service';
import { Button, Loader, Text } from 'rizzui';
import { PiArrowClockwiseBold, PiBuildingsBold } from 'react-icons/pi';
import Link from 'next/link';
import { routes } from '@/config/routes';

export type TenantDataType = AdminTenant;

export default function TenantTable() {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.user?.token ?? '';
  const [deleting, setDeleting] = useState(false);

  const [allTenants, setAllTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('');

  // Apply client-side filters
  const filtered = useMemo(() => {
    return allTenants.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (planFilter && t.plan !== planFilter) return false;
      if (subscriptionStatusFilter && t.subscriptionStatus !== subscriptionStatusFilter) return false;
      return true;
    });
  }, [allTenants, statusFilter, planFilter, subscriptionStatusFilter]);

  const { table, setData } = useTanStackTable<TenantDataType>({
    tableData: filtered,
    columnConfig: tenantsColumns,
    options: {
      initialState: {
        pagination: { pageIndex: 0, pageSize: 10 },
      },
      meta: {
        handleDeleteRow: (row: TenantDataType) => removeTenants([row]),
      },
      getRowId: (row) => row._id,
      enableRowSelection: (row) => !row.original.isSystemTenant && !deleting && session?.user?.role === 'super_admin',
      enableColumnResizing: false,
    },
  });

  async function removeTenants(rows: TenantDataType[]) {
    if (!token || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteAdminTenants(token, rows);
      setAllTenants((prev) => prev.filter((row) => !result.deletedIds.includes(row._id)));
      table.resetRowSelection();
      if (result.deletedIds.length) toast.success(`${result.deletedIds.length} tenant(s) deleted`);
      if (result.failures.length) toast.error(`${result.failures.length} could not be deleted: ${result.failures[0].message}`);
    } finally {
      setDeleting(false);
    }
  }

  // Keep table data in sync with filtered results
  useEffect(() => {
    setData(filtered);
    table.resetPageIndex();
  }, [filtered]);

  function load() {
    if (!token) {
      if (sessionStatus !== 'loading') { setLoading(false); setError('Sign in to manage tenants'); }
      return;
    }
    setLoading(true);
    setError(null);
    getAdminTenants(token)
      .then(({ tenants }) => setAllTenants(tenants))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token, sessionStatus]);

  // Reload when a tenant is created from the modal
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('tenant-created', handler);
    return () => window.removeEventListener('tenant-created', handler);
  }, [token, sessionStatus]);

  if (loading) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-3">
        <Loader variant="spinner" className="text-primary" />
        <Text className="text-sm text-gray-500">Loading tenants...</Text>
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
      <TenantFilters
        table={table}
        statusFilter={statusFilter}
        planFilter={planFilter}
        subscriptionStatusFilter={subscriptionStatusFilter}
        onStatusChange={setStatusFilter}
        onPlanChange={setPlanFilter}
        onSubscriptionStatusChange={setSubscriptionStatusFilter}
      />

      {table.getFilteredRowModel().rows.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200">
          <PiBuildingsBold className="h-10 w-10 text-gray-300" />
          <Text className="font-medium text-gray-500">
            {allTenants.length === 0 ? 'No tenants yet' : 'No tenants match your filters'}
          </Text>
          {allTenants.length === 0 && (
            <Link href={routes.eCommerce.createTenant}>
              <Button size="sm">Add your first tenant</Button>
            </Link>
          )}
          {allTenants.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setStatusFilter(''); setPlanFilter(''); setSubscriptionStatusFilter(''); table.setGlobalFilter(''); }}
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
              container:
                'border border-muted rounded-xl overflow-x-auto min-w-0',
              rowClassName: 'last:border-0',
            }}
          />
          {table.getSelectedRowModel().rows.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <Text>{table.getSelectedRowModel().rows.length} tenants selected</Text>
              <Button color="danger" size="sm" isLoading={deleting} onClick={() => {
                const rows = table.getSelectedRowModel().rows.map((row) => row.original);
                if (window.confirm(`Permanently delete ${rows.length} selected tenants? This cannot be undone.`)) void removeTenants(rows);
              }}>Delete selected</Button>
            </div>
          )}
          <TablePagination table={table} className="py-4" />
        </>
      )}
    </>
  );
}
