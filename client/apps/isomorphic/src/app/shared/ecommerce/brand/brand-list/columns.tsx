// @ts-nocheck
'use client';

import DeletePopover from '@core/components/delete-popover';
import { routes } from '@/config/routes';
import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { ActionIcon, Badge, Checkbox, Flex, Text, Tooltip } from 'rizzui';
import { PiPencilLineBold, PiStorefrontBold, PiSealCheckFill } from 'react-icons/pi';
import { BrandDataType } from './table';

const columnHelper = createColumnHelper<BrandDataType>();

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge color="success" variant="flat" className="capitalize font-medium">Active</Badge>;
  if (status === 'pending') return <Badge color="warning" variant="flat" className="capitalize font-medium">Pending</Badge>;
  if (status === 'archived') return <Badge color="danger" variant="flat" className="capitalize font-medium">Archived</Badge>;
  if (status === 'suspended') return <Badge color="danger" variant="flat" className="capitalize font-medium">Suspended</Badge>;
  return <Badge color="secondary" variant="flat" className="capitalize font-medium">{status || 'Inactive'}</Badge>;
}

function BrandLogoCell({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200">
        <PiStorefrontBold className="h-5 w-5 text-gray-400" />
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

export const brandsColumns = [
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
    header: 'Brand',
    cell: ({ row }) => {
      const { name, slug, logo, _id, verified } = row.original;
      return (
        <Flex align="center" gap="3">
          <BrandLogoCell src={logo?.url} name={name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link href={routes.eCommerce.brandProducts(_id)}>
                <Text className="max-w-[160px] truncate font-semibold text-gray-900 transition-colors hover:text-primary">
                  {name}
                </Text>
              </Link>
              {verified && (
                <Tooltip size="sm" content="Verified brand" placement="top" color="invert">
                  <PiSealCheckFill className="h-4 w-4 flex-shrink-0 text-blue-500" />
                </Tooltip>
              )}
            </div>
            <Text className="truncate text-xs text-gray-400">/{slug}</Text>
          </div>
        </Flex>
      );
    },
  }),

  columnHelper.accessor('brandType', {
    id: 'brandType',
    size: 160,
    header: 'Type',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return <Text className="text-gray-400">—</Text>;
      return (
        <Badge color="primary" variant="flat" className="capitalize text-xs font-medium">
          {val.replace(/_/g, ' ')}
        </Badge>
      );
    },
  }),

  columnHelper.accessor('primaryCategory', {
    id: 'primaryCategory',
    size: 140,
    header: 'Category',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return <Text className="text-gray-400">—</Text>;
      return (
        <Badge color="secondary" variant="flat" className="capitalize text-xs font-medium">
          {val.replace(/_/g, ' ')}
        </Badge>
      );
    },
  }),

  columnHelper.display({
    id: 'status',
    size: 120,
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  }),

  columnHelper.display({
    id: 'products',
    size: 110,
    header: 'Products',
    cell: ({ row }) => {
      const count = row.original.productCount ?? 0;
      const pill = (
        <Flex align="center" gap="2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
            count > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {count}
          </div>
          <Text className="text-xs text-gray-500">{count === 1 ? 'product' : 'products'}</Text>
        </Flex>
      );
      return count > 0 ? (
        <Link href={routes.eCommerce.brandProducts(row.original._id)} className="hover:opacity-80 transition-opacity">
          {pill}
        </Link>
      ) : pill;
    },
  }),

  columnHelper.accessor('countryOfOrigin', {
    id: 'countryOfOrigin',
    size: 130,
    header: 'Country',
    cell: ({ getValue }) => {
      const val = getValue();
      return val
        ? <Text className="text-sm text-gray-600">{val}</Text>
        : <Text className="text-gray-400">—</Text>;
    },
  }),

  columnHelper.display({
    id: 'createdAt',
    size: 120,
    header: 'Added',
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
          <Link href={routes.eCommerce.editBrand(row.original._id)}>
            <ActionIcon as="span" size="sm" variant="outline" aria-label="Edit">
              <PiPencilLineBold className="h-4 w-4" />
            </ActionIcon>
          </Link>
        </Tooltip>
        <DeletePopover
          title="Delete brand"
          description={`Are you sure you want to delete "${row.original.name}"?${row.original.productCount ? ` It has ${row.original.productCount} product(s).` : ''}`}
          onDelete={() => meta?.handleDeleteRow?.(row.original)}
        />
      </Flex>
    ),
  }),
];
