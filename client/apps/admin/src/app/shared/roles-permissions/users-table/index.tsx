'use client';

/**
 * People table for /roles-permissions — REAL data on both audiences.
 *
 *   tenant   → rows come from /api/employees (employee.service)
 *   platform → rows come from /api/users      (adminUser.service)
 *
 * The view maps both into PersonRow and passes mutation callbacks down, so
 * this component stays audience-agnostic. Client-side filtering/pagination,
 * matching the tenant-list pattern. A live result count and a friendly
 * no-match state keep filtering legible; the core Table scrolls horizontally
 * on narrow screens.
 */

import { useEffect, useMemo, useState } from 'react';
import { Text } from 'rizzui';
import { PiMagnifyingGlassBold } from 'react-icons/pi';

import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import TablePagination from '@core/components/table/pagination';

import { makeUsersColumns } from './columns';
import UsersTableFilters from './filters';
import type { CustomRole, UserRole } from '@/types/authorization';
import type { UsersActions } from '../roles-permissions-view';

export interface PersonRow {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  baseRole: UserRole;
  status: 'active' | 'inactive' | 'suspended';
  customRoleId: string | null;
}

interface Props {
  people: PersonRow[];
  /** Custom roles available to assign — already audience-scoped by the server. */
  roles: CustomRole[];
  /** Active card filter: `system:<role>` | custom role id | null. */
  selectedKey: string | null;
  canDelete: boolean;
  actions: UsersActions;
}

/** Roles whose capabilities are fixed by policy — no assignment dropdown. */
const LOCKED_BASE_ROLES: UserRole[] = ['super_admin', 'tenant_owner'];

function matchesSelected(person: PersonRow, key: string | null): boolean {
  if (!key) return true;
  if (key.startsWith('system:')) {
    return person.baseRole === key.slice('system:'.length);
  }
  return person.customRoleId === key;
}

export default function UsersTable({
  people,
  roles,
  selectedKey,
  canDelete,
  actions,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return people.filter((p) => {
      if (!matchesSelected(p, selectedKey)) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (
        term &&
        !`${p.name} ${p.email}`.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [people, selectedKey, statusFilter, search]);

  const isNarrowed =
    Boolean(selectedKey) || Boolean(statusFilter) || search.trim() !== '';

  async function run(person: PersonRow, op: () => Promise<void>) {
    setPendingId(person._id);
    try {
      await op();
    } catch (err) {
      import('react-hot-toast').then(({ default: toast }) =>
        toast.error((err as Error).message)
      );
    } finally {
      setPendingId(null);
    }
  }

  const columns = useMemo(
    () =>
      makeUsersColumns({
        roles,
        lockedBaseRoles: LOCKED_BASE_ROLES,
        pendingId,
        onSelectRole: (person, roleId) =>
          run(person, () => actions.assignRole(person._id, roleId)),
        onToggleStatus: (person) =>
          run(person, () => actions.toggleStatus(person)),
        onDelete: canDelete
          ? (person) =>
              run(person, async () => {
                await actions.remove?.(person);
              })
          : undefined,
      }),
    // run/actions close over fresh loaders; pendingId re-renders spinners.
    [roles, pendingId, canDelete, actions]
  );

  const { table, setData } = useTanStackTable<PersonRow>({
    tableData: filtered,
    columnConfig: columns,
    options: {
      initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
      enableColumnResizing: false,
    },
  });

  useEffect(() => {
    setData(filtered);
    table.resetPageIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  return (
    <>
      <UsersTableFilters
        table={table}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {isNarrowed && (
        <Text className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Showing{' '}
          <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {filtered.length}
          </span>{' '}
          of {people.length} people
        </Text>
      )}

      {filtered.length === 0 && people.length > 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
            <PiMagnifyingGlassBold className="h-5 w-5" aria-hidden />
          </span>
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
            No people match your filters.
          </Text>
          <Text className="max-w-xs text-center text-xs text-gray-400">
            Try clearing the search, status filter, or selected role card.
          </Text>
        </div>
      ) : (
        <>
          <Table
            table={table}
            variant="modern"
            classNames={{
              container: 'border border-muted rounded-xl dark:border-gray-700',
              rowClassName: 'last:border-0',
            }}
          />
          <TablePagination table={table} className="py-4" />
        </>
      )}
    </>
  );
}
