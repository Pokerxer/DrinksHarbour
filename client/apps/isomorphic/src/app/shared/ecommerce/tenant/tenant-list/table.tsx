// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { tenantsColumns } from './columns';
import TableFooter from '@core/components/table/footer';
import TablePagination from '@core/components/table/pagination';
import TenantFilters from './filters';
import { getAdminTenants, deleteAdminTenant, AdminTenant } from '@/services/tenant.service';
import { Button, Empty, Loader, Text } from 'rizzui';
import { PiArrowClockwiseBold, PiBuildingsBold } from 'react-icons/pi';
import Link from 'next/link';
import { routes } from '@/config/routes';

export type TenantDataType = AdminTenant;

export default function TenantTable() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;

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
        handleDeleteRow: async (row: TenantDataType) => {
          if (!token) return;
          try {
            await deleteAdminTenant(token, row._id);
            setAllTenants((prev) => prev.filter((r) => r._id !== row._id));
          } catch (err: any) {
            alert(err.message || 'Failed to delete tenant');
          }
        },
        handleMultipleDelete: (rows: TenantDataType[]) => {
          setAllTenants((prev) => prev.filter((r) => !rows.includes(r)));
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
    getAdminTenants(token)
      .then(({ tenants }) => setAllTenants(tenants))
      .catch((err) => setError(err.message || 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token]);

  // Reload when a tenant is created from the modal
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('tenant-created', handler);
    return () => window.removeEventListener('tenant-created', handler);
  }, [token]);

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

      {filtered.length === 0 ? (
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
              onClick={() => { setStatusFilter(''); setPlanFilter(''); setSubscriptionStatusFilter(''); }}
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
