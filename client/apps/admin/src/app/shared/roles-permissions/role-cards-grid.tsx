'use client';

/**
 * Role cards — the system roles (fixed by policy) and the custom roles
 * (editable). Clicking any card filters the People table below; the active
 * filter is echoed back as a dismissible chip above that table.
 *
 * System cards show their pinned permission count (ROLE_PERMISSIONS); custom
 * cards carry edit/delete. Neither kind exposes an editor for system policy.
 */

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ActionIcon, Button, Text, Title, Tooltip } from 'rizzui';
import { PiPencilSimpleBold, PiPlusBold } from 'react-icons/pi';

import DeletePopover from '@core/components/delete-popover';
import {
  type CustomRole,
  type UserRole,
  ROLE_PERMISSIONS,
} from '@/types/authorization';
import { CustomRoleCard, SystemRoleCard } from '@/app/shared/roles-permissions/role-card';
import { rolesService } from '@/services/roles.service';
import { useAuthorization } from '@/hooks/use-authorization';

type Audience = 'platform' | 'tenant';

interface Props {
  roles: CustomRole[];
  audience: Audience;
  /** Live head-count per base role, for the system cards. */
  systemCounts: Record<string, number>;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onCreate: () => void;
  onEdit: (role: CustomRole) => void;
  /** Called after a custom role is deleted so parents can refetch. */
  onDeleted: () => void;
}

const SYSTEM_ROLES_BY_AUDIENCE: Record<Audience, UserRole[]> = {
  platform: ['super_admin', 'admin', 'customer'],
  tenant: ['tenant_owner', 'tenant_admin', 'tenant_staff'],
};

export default function RoleCardsGrid({
  roles,
  audience,
  systemCounts,
  selectedKey,
  onSelect,
  onCreate,
  onEdit,
  onDeleted,
}: Props) {
  const { user } = useAuthorization();
  const token = user?.token;
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visibleCustomRoles = useMemo(
    () => roles.filter((r) => r.scope === audience && r.isActive !== false),
    [roles, audience]
  );

  async function handleDelete(role: CustomRole) {
    if (!token) return;
    setDeletingId(role._id);
    try {
      await rolesService.deleteRole(role._id, token);
      toast.success(`Role "${role.name}" deleted`);
      if (selectedKey === role._id) onSelect(null);
      onDeleted();
    } catch (err) {
      // A 409 ("N users still hold this role") is guidance, not noise.
      toast.error((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="roles-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Title as="h4" className="text-base font-semibold text-gray-900 dark:text-white">
            Roles
            <Text as="span" className="ms-2 text-xs font-normal text-gray-400">
              {SYSTEM_ROLES_BY_AUDIENCE[audience].length + visibleCustomRoles.length}{' '}
              total
            </Text>
          </Title>
          <Text className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            System roles are fixed by policy — custom roles refine what people can reach.
          </Text>
        </div>
        <Button size="sm" onClick={onCreate}>
          <PiPlusBold className="me-1.5 h-4 w-4" />
          Create Role
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SYSTEM_ROLES_BY_AUDIENCE[audience].map((baseRole) => {
          const key = `system:${baseRole}`;
          return (
            <SystemRoleCard
              key={key}
              baseRole={baseRole}
              permissionCount={ROLE_PERMISSIONS[baseRole]?.length ?? 0}
              peopleCount={systemCounts[baseRole] ?? 0}
              selected={selectedKey === key}
              onSelect={() => onSelect(selectedKey === key ? null : key)}
            />
          );
        })}

        {visibleCustomRoles.map((role) => (
          <CustomRoleCard
            key={role._id}
            name={role.name}
            description={role.description}
            color={role.color}
            permissionCount={role.permissions.length}
            assignedCount={role.assignedCount ?? 0}
            selected={selectedKey === role._id}
            onSelect={() => onSelect(selectedKey === role._id ? null : role._id)}
            actions={
              <>
                <Tooltip size="sm" content="Edit" placement="top" color="invert">
                  <ActionIcon
                    size="sm"
                    variant="outline"
                    aria-label={`Edit ${role.name}`}
                    disabled={deletingId === role._id}
                    onClick={() => onEdit(role)}
                  >
                    <PiPencilSimpleBold className="h-4 w-4" />
                  </ActionIcon>
                </Tooltip>
                <DeletePopover
                  title={`Delete ${role.name}`}
                  description={
                    role.assignedCount
                      ? `${role.assignedCount} ${
                          role.assignedCount === 1 ? 'person holds' : 'people hold'
                        } this role — unassign them first.`
                      : `Delete the "${role.name}" role? This cannot be undone.`
                  }
                  onDelete={() => handleDelete(role)}
                />
              </>
            }
          />
        ))}

        {/* Create affordance when there are no custom roles yet */}
        {visibleCustomRoles.length === 0 && (
          <button
            type="button"
            onClick={onCreate}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 p-4 text-gray-400 transition-colors hover:border-primary hover:text-primary dark:border-gray-600 dark:hover:border-primary"
          >
            <PiPlusBold className="h-5 w-5" />
            <Text className="text-xs font-medium">Create a custom role</Text>
          </button>
        )}
      </div>
    </section>
  );
}
