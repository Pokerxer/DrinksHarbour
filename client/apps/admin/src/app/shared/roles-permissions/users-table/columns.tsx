'use client';

/**
 * Columns for the roles-permissions People table. Built by a factory so the
 * assignable-role options and mutation handlers close over fresh data.
 */

import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { ActionIcon, Badge, Select, Text, Tooltip } from 'rizzui';
import {
  PiArrowClockwiseBold,
  PiProhibitBold,
} from 'react-icons/pi';

import DeletePopover from '@core/components/delete-popover';
import {
  type CustomRole,
  type UserRole,
  SYSTEM_ROLE_META,
} from '@/types/authorization';
import type { PersonRow } from './index';

const columnHelper = createColumnHelper<PersonRow>();

interface Options {
  roles: CustomRole[];
  lockedBaseRoles: UserRole[];
  pendingId: string | null;
  onSelectRole: (person: PersonRow, roleId: string | null) => void;
  onToggleStatus: (person: PersonRow) => void;
  onDelete?: (person: PersonRow) => void;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function PersonCell({ person }: { person: PersonRow }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300">
        {person.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.avatar}
            alt={person.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Initials name={person.name} />
        )}
      </div>
      <div className="min-w-0">
        <Text className="truncate font-medium text-gray-900 dark:text-gray-50">
          {person.name}
        </Text>
        <Text className="truncate text-xs text-gray-400">{person.email}</Text>
      </div>
    </div>
  );
}

export function makeUsersColumns({
  roles,
  lockedBaseRoles,
  pendingId,
  onSelectRole,
  onToggleStatus,
  onDelete,
}: Options): ColumnDef<PersonRow, unknown>[] {
  return [
    columnHelper.accessor('name', {
      id: 'person',
      size: 240,
      header: 'Person',
      cell: ({ row }) => <PersonCell person={row.original} />,
    }),

    columnHelper.accessor('baseRole', {
      id: 'baseRole',
      size: 140,
      header: 'System Role',
      cell: ({ getValue }) => {
        const meta = SYSTEM_ROLE_META[getValue()];
        return (
          <Badge
            variant="flat"
            color={getValue() === 'super_admin' || getValue() === 'tenant_owner' ? 'success' : 'secondary'}
            className="text-xs font-medium"
          >
            {meta?.label ?? getValue()}
          </Badge>
        );
      },
    }),

    columnHelper.display({
      id: 'customRole',
      size: 220,
      header: 'Custom Role',
      cell: ({ row }) => {
        const person = row.original;
        const isLocked = lockedBaseRoles.includes(person.baseRole);
        const current = person.customRoleId ?? '';

        if (isLocked) {
          return (
            <Tooltip
              size="sm"
              content="Fixed by policy — owners and super admins cannot hold custom roles."
              placement="top"
              color="invert"
            >
              <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
            </Tooltip>
          );
        }

        return (
          <Select
            size="sm"
            variant="flat"
            placeholder="None"
            disabled={pendingId === person._id}
            value={current}
            onChange={(value: string) => onSelectRole(person, value || null)}
            options={[
              ...roles.map((r) => ({ label: r.name, value: r._id })),
            ]}
            getOptionValue={(option: { value: string }) => option.value}
            displayValue={(selected: string) =>
              roles.find((r) => r._id === selected)?.name ?? 'None'
            }
            dropdownClassName="!z-[1] h-auto"
            inPortal={false}
            selectClassName="text-sm"
          />
        );
      },
    }),

    columnHelper.display({
      id: 'status',
      size: 110,
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const color =
          status === 'active'
            ? 'success'
            : status === 'suspended'
              ? 'danger'
              : 'warning';
        return (
          <Badge variant="flat" color={color} className="text-xs font-medium capitalize">
            {status}
          </Badge>
        );
      },
    }),

    columnHelper.display({
      id: 'action',
      size: 100,
      cell: ({ row }) => {
        const person = row.original;
        const busy = pendingId === person._id;
        const suspended = person.status === 'suspended';
        return (
          <div className="flex items-center justify-end gap-2 pe-3">
            <Tooltip
              size="sm"
              content={suspended ? 'Restore access' : 'Suspend access'}
              placement="top"
              color="invert"
            >
              <ActionIcon
                size="sm"
                variant="outline"
                aria-label={suspended ? 'Activate' : 'Suspend'}
                disabled={busy}
                onClick={() => onToggleStatus(person)}
              >
                {suspended ? (
                  <PiArrowClockwiseBold className="h-4 w-4" />
                ) : (
                  <PiProhibitBold className="h-4 w-4" />
                )}
              </ActionIcon>
            </Tooltip>

            {onDelete && person.baseRole !== 'tenant_owner' && (
              <DeletePopover
                title={`Remove ${person.name}`}
                description={`Remove ${person.name}'s staff account? They will no longer be able to sign in.`}
                onDelete={() => onDelete(person)}
              />
            )}
          </div>
        );
      },
    }),
  ] as ColumnDef<PersonRow, unknown>[];
}
