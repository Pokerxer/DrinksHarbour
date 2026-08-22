'use client';

/**
 * Roles & Permissions — real data for BOTH audiences.
 *
 *   Platform admins  → /api/roles (platform shelf) + /api/users
 *   Tenant owner/admin → /api/roles (their tenant) + /api/employees
 *
 * The server scopes everything by the caller; this component only branches on
 * which surface to read. Staff CREATION stays on /employees (link out); the
 * platform "Add User" modal is create-user.tsx, kept from before.
 *
 * Page anatomy: overview stats → role badge grid → People table. Selecting a
 * card filters the table and echoes a dismissible chip above it.
 *
 * Enforcement caveat shown honestly in the UI: custom-role permissions are
 * declarative/UI-gating until a requirePermission() middleware exists.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button, Loader, Text, Title } from 'rizzui';
import {
  PiFunnelBold,
  PiPlusBold,
  PiUsersThreeBold,
  PiXBold,
} from 'react-icons/pi';


import ModalButton from '@/app/shared/modal-button';
import { useModal } from '@/app/shared/modal-views/use-modal';
import CreateUser from '@/app/shared/roles-permissions/create-user';
import RoleCardsGrid from '@/app/shared/roles-permissions/role-cards-grid';
import CreateEditRoleModal from '@/app/shared/roles-permissions/create-edit-role-modal';
import UsersTable, {
  type PersonRow,
} from '@/app/shared/roles-permissions/users-table';
import RolesStatsStrip, {
  type RolesStats,
} from '@/app/shared/roles-permissions/roles-stats';
import { useAuthorization } from '@/hooks/use-authorization';
import {
  type CustomRole,
  SYSTEM_ROLE_META,
  UserRole,
} from '@/types/authorization';
import {
  rolesService,
  type GroupedCatalog,
} from '@/services/roles.service';
import {
  activateAdminUser,
  deleteAdminUser,
  listAdminUsers,
  suspendAdminUser,
  updateAdminUser,
  type AdminUserRow,
} from '@/services/adminUser.service';
import {
  employeeService,
  type Employee,
} from '@/services/employee.service';

export interface UsersActions {
  assignRole: (personId: string, roleId: string | null) => Promise<void>;
  toggleStatus: (person: PersonRow) => Promise<void>;
  remove?: (person: PersonRow) => Promise<void>;
}

/** Does a person match a card-selection key? Mirrors users-table filtering. */
function personMatchesFilter(person: PersonRow, key: string): boolean {
  if (key.startsWith('system:')) {
    return person.baseRole === key.slice('system:'.length);
  }
  return person.customRoleId === key;
}

export default function RolesPermissionsView() {
  const { role, isAdmin, user } = useAuthorization();
  const { openModal, closeModal } = useModal();
  const token = user?.token;
  const isTenantAudience = !isAdmin;
  const audience = isTenantAudience ? ('tenant' as const) : ('platform' as const);

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [catalog, setCatalog] = useState<GroupedCatalog[]>([]);
  const [platformOnly, setPlatformOnly] = useState<string[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected filter key: `system:<UserRole>` or a custom role _id.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, catalogRes, peopleRes] = await Promise.all([
        rolesService.listRoles(token),
        rolesService.getCatalog(token),
        isTenantAudience
          ? employeeService.getEmployees(token)
          : listAdminUsers({ limit: 200 }, token),
      ]);
      setRoles(rolesRes.data.roles);
      setCatalog(catalogRes.data.catalog);
      setPlatformOnly(catalogRes.data.platformOnly);
      setPeople(
        isTenantAudience
          ? (peopleRes as { data: { employees: Employee[] } }).data.employees.map(
              mapEmployeeRow
            )
          : (peopleRes as { users: AdminUserRow[] }).users.map(mapAdminUserRow)
        );
    } catch (err) {
      setError((err as Error).message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [token, isTenantAudience]);

  useEffect(() => {
    load();
  }, [load]);

  /** Live per-base-role head counts for the system cards. */
  const systemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of people) {
      counts[p.baseRole] = (counts[p.baseRole] ?? 0) + 1;
    }
    return counts;
  }, [people]);

  const stats = useMemo<RolesStats>(
    () => ({
      totalPeople: people.length,
      activePeople: people.filter((p) => p.status === 'active').length,
      suspendedPeople: people.filter((p) => p.status === 'suspended').length,
      customRoles: roles.filter(
        (r) => r.scope === audience && r.isActive !== false
      ).length,
    }),
    [people, roles, audience]
  );

  /** Label + live match count for the chip that echoes the active card filter. */
  const activeFilter = useMemo(() => {
    if (!selectedKey) return null;
    const label = selectedKey.startsWith('system:')
      ? SYSTEM_ROLE_META[selectedKey.slice(7) as UserRole]?.label ??
        selectedKey.slice(7)
      : roles.find((r) => r._id === selectedKey)?.name ?? 'Selected role';
    return {
      label,
      count: people.filter((p) => personMatchesFilter(p, selectedKey)).length,
    };
  }, [selectedKey, roles, people]);

  const refreshRoles = useCallback(async () => {
    if (!token) return;
    const res = await rolesService.listRoles(token);
    setRoles(res.data.roles);
  }, [token]);

  /**
   * Create / edit present through the app-wide modal layer (use-modal) —
   * rendering the form inline at the page foot was invisible to users.
   */
  const openRoleModal = useCallback(
    (editingRole: CustomRole | null) => {
      openModal({
        view: (
          <CreateEditRoleModal
            open
            editing={editingRole}
            audience={audience}
            catalog={catalog}
            platformOnly={platformOnly}
            onClose={closeModal}
            onSaved={refreshRoles}
          />
        ),
        customSize: 800,
      });
    },
    [openModal, closeModal, audience, catalog, platformOnly, refreshRoles]
  );

  const actions: UsersActions = useMemo(() => {
    if (!token) return { assignRole: async () => {}, toggleStatus: async () => {} };
    if (isTenantAudience) {
      return {
        assignRole: async (personId, roleId) => {
          await employeeService.updateEmployee(personId, { customRole: roleId }, token);
          await load();
        },
        toggleStatus: async (person) => {
          await employeeService.updateEmployee(
            person._id,
            { status: person.status === 'suspended' ? 'active' : 'suspended' },
            token
          );
          toast.success(
            person.status === 'suspended' ? 'Access restored' : 'Access suspended'
          );
          await load();
        },
        remove: async (person) => {
          await employeeService.removeEmployee(person._id, token);
          toast.success(`${person.name} removed`);
          await load();
        },
      };
    }
    return {
      assignRole: async (personId, roleId) => {
        await updateAdminUser(personId, { customRole: roleId }, token);
        await load();
      },
      toggleStatus: async (person) => {
        if (person.status === 'suspended') {
          await activateAdminUser(person._id, token);
          toast.success('Access restored');
        } else {
          await suspendAdminUser(person._id, token);
          toast.success('Access suspended');
        }
        await load();
      },
      remove: async (person) => {
        await deleteAdminUser(person._id, token);
        toast.success(`${person.name} removed`);
        await load();
      },
    };
  }, [token, isTenantAudience, load]);

  // ── States ───────────────────────────────────────────────────────────────

  if (loading && people.length === 0 && roles.length === 0) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading roles">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[74px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
            />
          ))}
        </div>
        <div>
          <div className="mb-4 h-5 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[132px] animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              />
            ))}
          </div>
        </div>
        <Loader variant="spinner" className="mx-auto text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
        <Text className="max-w-sm text-center text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </Text>
        <Button size="sm" variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <RolesStatsStrip stats={stats} audience={audience} />

      <RoleCardsGrid
        roles={roles}
        audience={audience}
        systemCounts={systemCounts}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onCreate={() => openRoleModal(null)}
        onEdit={openRoleModal}
        onDeleted={refreshRoles}
      />

      <section aria-labelledby="people-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <Title
            as="h4"
            id="people-heading"
            className="text-base font-semibold text-gray-900 dark:text-white"
          >
            People
            <Text as="span" className="ms-2 text-xs font-normal text-gray-400">
              {people.length}{' '}
              {isTenantAudience ? 'team members' : 'users'}
            </Text>
          </Title>

          {activeFilter && (
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              aria-label={`Clear ${activeFilter.label} filter`}
              className="flex max-w-full items-center gap-2 rounded-full border border-primary-lighter bg-primary-lighter/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-lighter/60 dark:bg-primary-dark dark:hover:brightness-125"
            >
              <PiFunnelBold className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
              <span className="truncate">
                {activeFilter.label} · {activeFilter.count}
              </span>
              <PiXBold className="h-3 w-3 flex-shrink-0" aria-hidden />
            </button>
          )}
        </div>

        {people.length === 0 ? (
          <EmptyPeople audience={audience} />
        ) : (
          <UsersTable
            key={role}
            people={people}
            roles={roles}
            selectedKey={selectedKey}
            canDelete={isTenantAudience}
            actions={actions}
          />
        )}
      </section>

    </div>
  );
}

function EmptyPeople({
  audience,
}: {
  audience: 'tenant' | 'platform';
}) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 p-6 text-center dark:border-gray-700">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-lighter text-primary dark:bg-primary-dark">
        <PiUsersThreeBold className="h-6 w-6" aria-hidden />
      </span>
      <Text className="max-w-xs font-medium text-gray-600 dark:text-gray-300">
        {NO_PEOPLE_COPY[audience]}
      </Text>
    </div>
  );
}

const NO_PEOPLE_COPY: Record<'tenant' | 'platform', string> = {
  tenant:
    'No staff yet. Add your team on the Employees screen, then refine their access here.',
  platform: 'No users match.',
};

// ─── Row mapping ──────────────────────────────────────────────────────────────

function mapEmployeeRow(e: Employee): PersonRow {
  return {
    _id: e._id,
    name: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email,
    email: e.email,
    avatar: e.avatar || '',
    baseRole: e.role,
    status: e.status,
    customRoleId: e.customRole?._id ?? null,
  };
}

function mapAdminUserRow(u: AdminUserRow): PersonRow {
  return {
    _id: u._id,
    name:
      u.displayName ||
      [u.firstName, u.lastName].filter(Boolean).join(' ') ||
      u.email ||
      u._id,
    email: u.email ?? '',
    avatar: u.avatar?.url ?? '',
    baseRole: u.role,
    status: u.status === 'deleted' ? 'inactive' : u.status,
    customRoleId: typeof u.customRole === 'string' ? u.customRole : null,
  };
}

/**
 * Header CTA — exported because page.tsx renders it inside PageHeader.
 * Tenant → link out to staff creation (decision #7: don't duplicate the HR
 * form). Platform → the existing MFA-stepped create-user modal.
 */
export function RoleHeaderAction() {
  const { isAdmin, user } = useAuthorization();

  if (!user?.token) return null;

  if (!isAdmin) {
    return (
      <Link href="/employees/create" className="inline-block">
        <Button className="mt-5 w-full text-xs @lg:w-auto sm:text-sm lg:mt-0">
          <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
          Add Staff Member
        </Button>
      </Link>
    );
  }

  return (
    <ModalButton label="Add New User" customSize={620} view={<CreateUser />} />
  );
}
