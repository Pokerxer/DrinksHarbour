// @ts-nocheck
'use client';

import { routes } from '@/config/routes';
import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { ActionIcon, Badge, Checkbox, Flex, Text, Tooltip } from 'rizzui';
import {
  PiPencilLineBold,
  PiEyeBold,
  PiPackageBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import DeletePopover from '@core/components/delete-popover';

export interface ProductListItem {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  description?: string;
  images?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  isAlcoholic?: boolean;
  abv?: number;
  volumeMl?: number;
  originCountry?: string;
  brand?: { _id: string; name: string };
  category?: { _id: string; name: string };
  basePrice?: number;
  status: string;
  isPublished: boolean;
  totalStock?: number;
  subProductCount?: number;
  variantCount?: number;
  createdAt: string;
  updatedAt: string;
}

const columnHelper = createColumnHelper<ProductListItem>();

function StatusBadge({ status, isPublished }: { status: string; isPublished: boolean }) {
  if (status === 'discontinued') return <Badge color="secondary" variant="flat" className="font-semibold capitalize">Discontinued</Badge>;
  if (!isPublished || status === 'draft') return <Badge color="secondary" variant="flat" className="font-semibold">Draft</Badge>;
  if (isPublished) return <Badge color="success" variant="flat" className="font-semibold">Published</Badge>;
  return <Badge color="warning" variant="flat" className="font-semibold capitalize">{status}</Badge>;
}

function ProductImage({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
        <PiPackageBold className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50">
      <img src={src} alt={name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </div>
  );
}

export const productsListColumns = [
  columnHelper.display({
    id: 'select',
    size: 50,
    header: ({ table }) => (
      <Checkbox
        className="ps-3.5"
        aria-label="Select all rows"
        checked={table.getIsAllPageRowsSelected()}
        onChange={() => table.toggleAllPageRowsSelected()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        className="ps-3.5"
        aria-label="Select row"
        checked={row.getIsSelected()}
        onChange={() => row.toggleSelected()}
      />
    ),
  }),

  columnHelper.accessor('name', {
    id: 'name',
    size: 280,
    header: 'Product',
    enableSorting: false,
    cell: ({ row }) => {
      const product = row.original;
      const imageUrl = product.images?.find(i => i.isPrimary)?.url || product.images?.[0]?.url;
      return (
        <Flex align="center" gap="3">
          <ProductImage src={imageUrl} name={product.name} />
          <div className="min-w-0">
            <Link href={routes.eCommerce.productDetails(product._id)}>
              <Text className="font-semibold text-gray-900 truncate max-w-[180px] hover:text-blue-600 transition-colors">
                {product.name}
              </Text>
            </Link>
            {product.type && (
              <Text className="text-xs text-gray-500 capitalize">{product.type}</Text>
            )}
          </div>
        </Flex>
      );
    },
  }),

  columnHelper.display({
    id: 'category',
    size: 160,
    header: 'Category / Brand',
    cell: ({ row }) => {
      const { category, brand } = row.original;
      return (
        <div className="space-y-1">
          {category?.name && (
            <Badge color="primary" variant="flat" className="text-xs">{category.name}</Badge>
          )}
          {brand?.name && (
            <Text className="text-xs text-gray-500">{brand.name}</Text>
          )}
          {!category?.name && !brand?.name && (
            <Text className="text-xs text-gray-400">—</Text>
          )}
        </div>
      );
    },
  }),

  columnHelper.display({
    id: 'details',
    size: 150,
    header: 'Details',
    cell: ({ row }) => {
      const { isAlcoholic, abv, volumeMl, originCountry } = row.original;
      return (
        <div className="space-y-0.5">
          {isAlcoholic !== undefined && (
            <Badge
              color={isAlcoholic ? 'warning' : 'success'}
              variant="flat"
              className="text-xs"
            >
              {isAlcoholic ? `Alcoholic${abv ? ` · ${abv}% ABV` : ''}` : 'Non-Alcoholic'}
            </Badge>
          )}
          {volumeMl && <Text className="text-xs text-gray-500">{volumeMl}ml</Text>}
          {originCountry && <Text className="text-xs text-gray-400">{originCountry}</Text>}
          {!isAlcoholic && isAlcoholic === undefined && !volumeMl && !originCountry && (
            <Text className="text-xs text-gray-400">—</Text>
          )}
        </div>
      );
    },
  }),

  columnHelper.display({
    id: 'subProducts',
    size: 130,
    header: 'Variants',
    cell: ({ row }) => {
      const variantCount = row.original.variantCount ?? row.original.subProductCount ?? 0;
      const subProductCount = row.original.subProductCount ?? 0;
      const hasSizes = variantCount > subProductCount;
      return (
        <Flex align="center" gap="2">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold',
            variantCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
          )}>
            {variantCount}
          </div>
          <Text className="text-xs text-gray-500">
            {hasSizes ? 'sizes' : 'variants'}
          </Text>
        </Flex>
      );
    },
  }),

  columnHelper.accessor('status', {
    id: 'status',
    size: 120,
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} isPublished={row.original.isPublished} />
    ),
  }),

  columnHelper.display({
    id: 'created',
    size: 110,
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
    size: 100,
    cell: ({ row, table: { options: { meta } } }) => (
      <Flex align="center" justify="end" gap="2" className="pe-3">
        <Tooltip size="sm" content="Edit" placement="top" color="invert">
          <Link href={routes.eCommerce.ediProduct(row.original._id)}>
            <ActionIcon as="span" size="sm" variant="outline" aria-label="Edit Product">
              <PiPencilLineBold className="h-4 w-4" />
            </ActionIcon>
          </Link>
        </Tooltip>
        <Tooltip size="sm" content="View" placement="top" color="invert">
          <Link href={routes.eCommerce.productDetails(row.original._id)}>
            <ActionIcon as="span" size="sm" variant="outline" aria-label="View Product">
              <PiEyeBold className="h-4 w-4" />
            </ActionIcon>
          </Link>
        </Tooltip>
        <DeletePopover
          title="Delete product"
          description={`Are you sure you want to delete "${row.original.name}"?`}
          onDelete={() => meta?.handleDeleteRow && meta.handleDeleteRow(row.original)}
        />
      </Flex>
    ),
  }),
];
