// @ts-nocheck
'use client';

import { routes } from '@/config/routes';
import { SubProductListItem, SizeVariant } from './table';
import { resolveSubProductImage } from './image-utils';
import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { ActionIcon, Checkbox, Flex, Text, Badge, Tooltip } from 'rizzui';
import {
  PiCaretRightBold,
  PiPencilLineBold,
  PiPackageBold,
  PiPlusBold,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import React from 'react';
import cn from '@core/utils/class-names';

const columnHelper = createColumnHelper<SubProductListItem>();

const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  KES: 'KSh',
  GHS: '₵',
};

const getSizeAvailabilityColor = (availability?: string, stock?: number) => {
  if (stock === 0) return 'danger';
  if (stock && stock <= 10) return 'warning';
  switch (availability) {
    case 'in_stock':
      return 'success';
    case 'low_stock':
      return 'warning';
    case 'out_of_stock':
      return 'danger';
    case 'pre_order':
      return 'info';
    default:
      return 'secondary';
  }
};

const getStockBadge = (stock: number, status: string) => {
  if (stock === 0) {
    return (
      <Badge color="danger" variant="flat" className="font-semibold">
        Out of Stock
      </Badge>
    );
  }
  if (stock <= 10) {
    return (
      <Badge color="warning" variant="flat" className="font-semibold">
        Low Stock ({stock})
      </Badge>
    );
  }
  return (
    <Badge color="success" variant="flat" className="font-semibold">
      In Stock ({stock})
    </Badge>
  );
};

const getStatusBadge = (isPublished: boolean, status: string) => {
  if (status === 'discontinued') {
    return (
      <Badge color="secondary" variant="flat" className="font-semibold">
        Discontinued
      </Badge>
    );
  }
  if (status === 'draft') {
    return (
      <Badge color="secondary" variant="flat" className="font-semibold">
        Draft
      </Badge>
    );
  }
  if (isPublished) {
    return (
      <Badge color="success" variant="flat" className="font-semibold">
        Published
      </Badge>
    );
  }
  return (
    <Badge color="warning" variant="flat" className="font-semibold">
      Unpublished
    </Badge>
  );
};

// Animated Expand/Collapse Button
function ExpandButton({
  isExpanded,
  onClick,
}: {
  isExpanded: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="group rounded-xl p-2 transition-colors hover:bg-red-50"
    >
      <motion.div
        animate={{ rotate: isExpanded ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <PiCaretRightBold
          className={cn(
            'h-5 w-5 transition-colors',
            isExpanded
              ? 'text-[#b20202]'
              : 'text-gray-400 group-hover:text-[#b20202]'
          )}
        />
      </motion.div>
    </motion.button>
  );
}

// Animated Checkbox
function AnimatedCheckbox({
  checked,
  onChange,
  indeterminate = false,
}: {
  checked: boolean;
  onChange: () => void;
  indeterminate?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="cursor-pointer"
    >
      <Checkbox
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        className={cn(
          'transition-all duration-200',
          checked && 'text-[#b20202]',
          indeterminate && 'text-amber-500'
        )}
      />
    </motion.div>
  );
}

// Animated Action Button
function ActionButton({
  icon: Icon,
  onClick,
  tooltip,
  variant = 'outline',
  color = 'default',
  className = '',
}: {
  icon: React.ElementType;
  onClick?: () => void;
  tooltip: string;
  variant?: 'outline' | 'flat' | 'text';
  color?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'info'
    | 'success'
    | 'warning';
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.1, rotate: 3 }}
      whileTap={{ scale: 0.95 }}
    >
      <Tooltip content={tooltip} size="sm" placement="top" color="invert">
        <ActionIcon
          size="sm"
          variant={variant}
          color={color}
          onClick={onClick}
          className={cn('h-8 w-8', className)}
        >
          <Icon className="h-4 w-4" />
        </ActionIcon>
      </Tooltip>
    </motion.div>
  );
}

export const subProductListColumns = [
  // Expand/Collapse Column
  columnHelper.display({
    id: 'expand',
    size: 40,
    header: '',
    cell: ({ row }) => {
      return (
        <ExpandButton
          isExpanded={row.getIsExpanded()}
          onClick={row.getToggleExpandedHandler()}
        />
      );
    },
  }),

  // Selection Column
  columnHelper.display({
    id: 'select',
    size: 40,
    header: ({ table }) => (
      <AnimatedCheckbox
        checked={table.getIsAllPageRowsSelected()}
        onChange={() => table.toggleAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
      />
    ),
    cell: ({ row }) => (
      <AnimatedCheckbox
        checked={row.getIsSelected()}
        onChange={() => row.toggleSelected()}
      />
    ),
  }),

  // Product Column
  columnHelper.accessor('product', {
    id: 'product',
    size: 280,
    header: 'Product',
    enableSorting: false,
    cell: ({ row }) => {
      const product = row.original.product;
      const displayImage = resolveSubProductImage(row.original);

      return (
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="group flex cursor-pointer items-center gap-2 rounded-xl p-2 transition-colors hover:bg-gray-50"
        >
          <div className="relative flex-shrink-0">
            {displayImage ? (
              <img
                src={displayImage}
                alt={product?.name || 'Product'}
                className="h-12 w-9 rounded-lg border border-gray-200 bg-gray-50 object-contain p-0.5"
              />
            ) : (
              <div className="flex h-12 w-9 items-center justify-center rounded-lg bg-gray-100">
                <PiPackageBold className="h-5 w-5 text-gray-400" />
              </div>
            )}
            {/* Stock indicator */}
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white',
                row.original.totalStock === 0 && 'bg-red-500',
                row.original.totalStock > 0 &&
                  row.original.totalStock <= 10 &&
                  'bg-amber-500',
                row.original.totalStock > 10 && 'bg-green-500'
              )}
            />
          </div>

          <div className="min-w-0 flex-1">
            <Text className="whitespace-normal text-sm font-semibold leading-snug text-gray-800">
              {product?.name || 'Unknown'}
            </Text>
            {product?.brand?.name && (
              <Text className="truncate text-[11px] text-gray-400">
                {product.brand.name}
              </Text>
            )}
            <Flex align="center" gap="1" className="mt-0.5">
              <Badge size="sm" variant="flat" className="text-[9px] capitalize">
                {product?.type?.replace(/_/g, ' ')?.slice(0, 10) || 'N/A'}
              </Badge>
              {product?.isAlcoholic && (
                <Badge
                  size="xs"
                  color="warning"
                  variant="solid"
                  className="text-[8px]"
                >
                  18+
                </Badge>
              )}
            </Flex>
          </div>
        </motion.div>
      );
    },
  }),

  // Sizes/Variants Column
  columnHelper.display({
    id: 'sizes',
    size: 280,
    header: 'Variants',
    cell: ({ row }) => {
      const sizes = row.original.sizes || [];
      const currency = row.original.currency || 'NGN';
      const symbol = currencySymbols[currency] || currency;
      const costPrice = row.original.costPrice || 0;
      const basePrice = row.original.baseSellingPrice || 0;
      const isExpanded = row.getIsExpanded();

      if (sizes.length === 0) {
        return (
          <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={row.getToggleExpandedHandler()}
            className="cursor-pointer rounded-lg bg-gray-50 px-3 py-2 text-center transition-colors hover:bg-gray-100"
          >
            <Text className="text-xs font-medium text-gray-400">
              Single variant
            </Text>
          </motion.div>
        );
      }

      // Show all sizes when expanded, otherwise show first 2
      const displaySizes = isExpanded ? sizes : sizes.slice(0, 2);
      const remaining = sizes.length - 2;

      return (
        <Flex direction="col" gap="2" className="py-1">
          {displaySizes.map((size: SizeVariant, idx: number) => {
            const sellingPrice = size.sellingPrice || basePrice || 0;
            const sizeCostPrice =
              basePrice > 0
                ? Math.round(costPrice * (sellingPrice / basePrice))
                : 0;
            // Markup% = ((Price - Cost) / Cost) * 100
            const markup =
              sizeCostPrice > 0
                ? Math.round(
                    ((sellingPrice - sizeCostPrice) / sizeCostPrice) * 100
                  )
                : 0;

            return (
              <motion.div
                key={size._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.01 }}
                onClick={row.getToggleExpandedHandler()}
                className="cursor-pointer rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white px-3 py-2 shadow-sm transition-all hover:border-[#b20202]/40 hover:shadow-md"
              >
                <Flex align="center" justify="between" gap="2">
                  {/* Size Badge */}
                  <Badge
                    size="sm"
                    color={getSizeAvailabilityColor(
                      size.availability,
                      size.stock
                    )}
                    variant="flat"
                    className="min-w-[50px] justify-center text-[10px] font-bold"
                  >
                    {size.displayName
                      ?.replace(/\s*\(.*?\)\s*/g, '')
                      .trim()
                      ?.slice(0, 6) || size.size?.slice(0, 6)}
                  </Badge>

                  {/* Price */}
                  <div className="text-right">
                    <Text className="text-sm font-bold text-gray-800">
                      {symbol}
                      {sellingPrice.toLocaleString()}
                    </Text>
                    <Text className="text-[9px] text-gray-500">
                      {symbol}
                      {sizeCostPrice.toLocaleString()} cost
                    </Text>
                  </div>

                  {/* Markup */}
                  <Badge
                    size="sm"
                    color={
                      markup >= 30
                        ? 'success'
                        : markup >= 15
                          ? 'warning'
                          : 'danger'
                    }
                    variant="flat"
                    className="text-[10px] font-bold"
                  >
                    +{markup}%
                  </Badge>

                  {/* Stock */}
                  <Badge
                    size="sm"
                    color={
                      size.stock === 0
                        ? 'danger'
                        : size.stock && size.stock <= 10
                          ? 'warning'
                          : 'success'
                    }
                    variant="flat"
                    className="text-[10px]"
                  >
                    {size.stock || 0}
                  </Badge>
                </Flex>
              </motion.div>
            );
          })}

          {!isExpanded && remaining > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              onClick={row.getToggleExpandedHandler()}
              className="flex items-center justify-center gap-1 rounded bg-red-50 py-1 text-xs font-semibold text-[#b20202] transition-colors hover:text-[#7f1d1d]"
            >
              +{remaining} more
            </motion.button>
          )}

          {isExpanded && sizes.length > 2 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              onClick={row.getToggleExpandedHandler()}
              className="flex items-center justify-center gap-1 rounded bg-gray-50 py-1 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700"
            >
              Show less
            </motion.button>
          )}
        </Flex>
      );
    },
  }),

  // Pricing Summary Column
  columnHelper.display({
    id: 'pricing',
    size: 100,
    header: 'Price',
    cell: ({ row }) => {
      const price = row.original.baseSellingPrice || 0;
      const cost = row.original.costPrice || 0;
      const currency = row.original.currency || 'NGN';
      const symbol = currencySymbols[currency] || currency;
      // Markup% = ((Price - Cost) / Cost) * 100
      const markup = cost > 0 ? Math.round(((price - cost) / cost) * 100) : 0;

      return (
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="cursor-pointer rounded-lg px-2 py-1 transition-colors hover:bg-gray-50"
        >
          <Text className="text-sm font-bold text-gray-800">
            {symbol}
            {price.toLocaleString()}
          </Text>
          <Flex align="center" gap="1">
            <Text className="text-[10px] text-gray-500">Cost:</Text>
            <Text className="text-[10px] font-medium text-gray-600">
              {symbol}
              {cost.toLocaleString()}
            </Text>
            <Badge
              size="xs"
              color={
                markup >= 30 ? 'success' : markup >= 15 ? 'warning' : 'danger'
              }
              variant="flat"
              className="text-[8px]"
            >
              +{markup}%
            </Badge>
          </Flex>
        </motion.div>
      );
    },
  }),

  // Stock Column
  columnHelper.display({
    id: 'stock',
    size: 100,
    header: 'Stock',
    cell: ({ row }) => {
      const totalStock = row.original.totalStock || 0;
      const availableStock = row.original.availableStock || 0;

      return (
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="cursor-pointer rounded-lg px-2 py-1 transition-colors hover:bg-gray-50"
        >
          {totalStock === 0 ? (
            <Badge
              color="danger"
              variant="flat"
              size="sm"
              className="font-semibold"
            >
              Out
            </Badge>
          ) : totalStock <= 10 ? (
            <Badge
              color="warning"
              variant="flat"
              size="sm"
              className="font-semibold"
            >
              Low ({totalStock})
            </Badge>
          ) : (
            <Badge
              color="success"
              variant="flat"
              size="sm"
              className="font-semibold"
            >
              {totalStock}
            </Badge>
          )}
          <Text className="mt-0.5 text-[10px] text-gray-500">
            Avail: {availableStock}
          </Text>
        </motion.div>
      );
    },
  }),

  // Status Column — mirrors the edit page's Status & Visibility panel
  columnHelper.display({
    id: 'status',
    size: 130,
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => {
      const status = row.original.status || 'draft';
      const statusMap: Record<
        string,
        { label: string; cls: string; dot: string }
      > = {
        active: {
          label: 'Active',
          cls: 'bg-green-50 text-green-700 border-green-200',
          dot: 'bg-green-500',
        },
        draft: {
          label: 'Draft',
          cls: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-400',
        },
        pending: {
          label: 'Pending',
          cls: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-400',
        },
        hidden: {
          label: 'Hidden',
          cls: 'bg-gray-50 text-gray-600 border-gray-200',
          dot: 'bg-gray-400',
        },
        out_of_stock: {
          label: 'Out of Stock',
          cls: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
        },
        discontinued: {
          label: 'Discontinued',
          cls: 'bg-slate-50 text-slate-600 border-slate-200',
          dot: 'bg-slate-500',
        },
        archived: {
          label: 'Archived',
          cls: 'bg-slate-50 text-slate-500 border-slate-200',
          dot: 'bg-slate-400',
        },
      };
      const s = statusMap[status] || statusMap.draft;
      const channels = [
        { key: 'POS', on: row.original.visibleInPOS !== false },
        { key: 'Web', on: row.original.visibleInOnlineStore !== false },
        { key: 'Platform', on: !!row.original.isPublished },
      ];
      return (
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
              s.cls
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
            {s.label}
          </span>
          <div className="flex items-center gap-1">
            {channels.map((c) => (
              <span
                key={c.key}
                title={`${c.key}: ${c.on ? 'visible' : 'hidden'}`}
                className={cn(
                  'rounded px-1 py-px text-[8px] font-semibold',
                  c.on
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-gray-100 text-gray-400 line-through'
                )}
              >
                {c.key}
              </span>
            ))}
          </div>
        </div>
      );
    },
  }),

  // Actions Column (only edit button, no delete)
  columnHelper.display({
    id: 'action',
    size: 60,
    cell: ({ row }) => {
      const subProductId = row.original._id || row.original.id;

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center"
        >
          <Link href={routes.eCommerce.editSubProduct(subProductId)}>
            <ActionButton
              icon={PiPencilLineBold}
              tooltip="Edit"
              className="h-7 w-7 hover:text-[#b20202]"
            />
          </Link>
        </motion.div>
      );
    },
  }),
];
