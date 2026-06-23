// @ts-nocheck
'use client';

import DeletePopover from '@core/components/delete-popover';
import { routes } from '@/config/routes';
import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { ActionIcon, Badge, Checkbox, Flex, Text, Tooltip } from 'rizzui';
import { PiPencilLineBold, PiBuildingsBold } from 'react-icons/pi';
import { TenantDataType } from './table';

const columnHelper = createColumnHelper<TenantDataType>();

function SubStatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge color="success" variant="flat" className="capitalize font-medium text-xs">Active</Badge>;
  if (status === 'trialing') return <Badge color="primary" variant="flat" className="capitalize font-medium text-xs">Trialing</Badge>;
  if (status === 'past_due') return <Badge color="warning" variant="flat" className="capitalize font-medium text-xs">Past Due</Badge>;
  if (status === 'canceled') return <Badge color="danger" variant="flat" className="capitalize font-medium text-xs">Canceled</Badge>;
  if (status === 'incomplete') return <Badge color="warning" variant="flat" className="capitalize font-medium text-xs">Incomplete</Badge>;
  if (status === 'incomplete_expired') return <Badge color="danger" variant="flat" className="capitalize font-medium text-xs">Expired</Badge>;
  return <Badge color="secondary" variant="flat" className="capitalize font-medium text-xs">{status || '—'}</Badge>;
}

function TenantStatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge color="success" variant="flat" className="capitalize font-medium text-xs">Approved</Badge>;
  if (status === 'pending') return <Badge color="warning" variant="flat" className="capitalize font-medium text-xs">Pending</Badge>;
  if (status === 'rejected') return <Badge color="danger" variant="flat" className="capitalize font-medium text-xs">Rejected</Badge>;
  if (status === 'suspended') return <Badge color="danger" variant="flat" className="capitalize font-medium text-xs">Suspended</Badge>;
  if (status === 'archived') return <Badge color="secondary" variant="flat" className="capitalize font-medium text-xs">Archived</Badge>;
  return <Badge color="secondary" variant="flat" className="capitalize font-medium text-xs">{status || '—'}</Badge>;
}

function TenantLogoCell({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200">
        <PiBuildingsBold className="h-5 w-5 text-gray-400" />
      </div>
    );
  }
  return (
    <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
      <img
        src={src}
        alt={name}
        className="h-full w-full object-contain p-1"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
  );
}

export const tenantsColumns = [
  columnHelper.display({
    id: 'checked',
    size: 50,
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        className="ps-3.5"
        checked={table.getIsAllPageRowsSelected()}
        onChange={() => table.toggleAllPageRowsSelected()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        className="ps-3.5"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  }),

  columnHelper.accessor('name', {
    id: 'name',
    size: 260,
    header: 'Tenant',
    cell: ({ row }) => {
      const { name, slug, logo, _id } = row.original;
      return (
        <Flex align="center" gap="3">
          <TenantLogoCell src={logo?.url} name={name} />
          <div className="min-w-0">
            <Link href={routes.eCommerce.tenantDetails(_id)}>
              <Text className="max-w-[160px] truncate font-semibold text-gray-900 transition-colors hover:text-primary">
                {name}
              </Text>
            </Link>
            <Text className="truncate text-xs text-gray-400">{slug}.drinksharbour.com</Text>
          </div>
        </Flex>
      );
    },
  }),

  columnHelper.accessor('plan', {
    id: 'plan',
    size: 130,
    header: 'Plan',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return <Text className="text-gray-400">—</Text>;
      return (
        <Badge color="primary" variant="flat" className="text-xs font-medium capitalize">
          {val.replace(/_/g, ' ')}
        </Badge>
      );
    },
  }),

  columnHelper.display({
    id: 'subscriptionStatus',
    size: 130,
    header: 'Sub. Status',
    cell: ({ row }) => <SubStatusBadge status={row.original.subscriptionStatus} />,
  }),

  columnHelper.display({
    id: 'status',
    size: 120,
    header: 'Status',
    cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
  }),

  columnHelper.accessor('revenueModel', {
    id: 'revenueModel',
    size: 130,
    header: 'Revenue',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return <Text className="text-gray-400">—</Text>;
      return (
        <Badge
          color={val === 'markup' ? 'secondary' : 'primary'}
          variant="flat"
          className="text-xs font-medium capitalize"
        >
          {val}
        </Badge>
      );
    },
  }),

  columnHelper.accessor('contactEmail', {
    id: 'contactEmail',
    size: 200,
    header: 'Contact',
    cell: ({ getValue }) => {
      const val = getValue();
      return val
        ? <Text className="truncate text-sm text-gray-600">{val}</Text>
        : <Text className="text-gray-400">—</Text>;
    },
  }),

  columnHelper.display({
    id: 'createdAt',
    size: 120,
    header: 'Created',
    cell: ({ row }) => {
      const date = row.original.createdAt ? new Date(row.original.createdAt) : null;
      if (!date) return <Text className="text-xs text-gray-400">—</Text>;
      return (
        <Text className="text-sm text-gray-600">
          {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
      );
    },
  }),

  columnHelper.display({
    id: 'action',
    size: 90,
    cell: ({ row, table: { options: { meta } } }) => (
      <Flex align="center" justify="end" gap="2" className="pe-3">
        <Tooltip size="sm" content="Edit" placement="top" color="invert">
          <Link href={routes.eCommerce.editTenant(row.original._id)}>
            <ActionIcon as="span" size="sm" variant="outline" aria-label="Edit">
              <PiPencilLineBold className="h-4 w-4" />
            </ActionIcon>
          </Link>
        </Tooltip>
        <DeletePopover
          title="Delete tenant"
          description={`Are you sure you want to delete "${row.original.name}"?${row.original.isSystemTenant ? ' This is a system tenant.' : ''}`}
          onDelete={() => meta?.handleDeleteRow?.(row.original)}
        />
      </Flex>
    ),
  }),
];
