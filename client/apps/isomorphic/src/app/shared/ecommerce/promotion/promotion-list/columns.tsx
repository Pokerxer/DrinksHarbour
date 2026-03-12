'use client';

import Link from 'next/link';
import { HeaderCell } from '@/components/ui/table';
import { Badge, Text, Tooltip, ActionIcon, Checkbox } from 'rizzui';
import { routes } from '@/config/routes';
import PencilIcon from '@/components/icons/pencil';
import TrashIcon from '@/components/icons/trash';
import { PromotionType, PromotionStatus } from '@/services/promotion.service';

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  percentage_discount: 'Percentage Discount',
  fixed_discount: 'Fixed Discount',
  buy_x_get_y: 'Buy X Get Y',
  bundle: 'Bundle Deal',
  flash_sale: 'Flash Sale',
  loyalty: 'Loyalty Reward',
  seasonal: 'Seasonal',
  clearance: 'Clearance',
  first_purchase: 'First Purchase',
  free_shipping: 'Free Shipping',
  gift_with_purchase: 'Gift with Purchase',
};

export const PROMOTION_STATUS_COLORS: Record<PromotionStatus, string> = {
  active: 'success',
  scheduled: 'info',
  paused: 'warning',
  expired: 'danger',
  draft: 'secondary',
  cancelled: 'secondary',
};

type Columns = {
  data: any[];
  sortConfig?: any;
  handleSelectAll: any;
  checkedItems: string[];
  onDeleteItem: (id: string) => void;
  onHeaderCellClick: (value: string) => void;
  onChecked?: (id: string) => void;
};

export const getColumns = ({
  data,
  sortConfig,
  checkedItems,
  onDeleteItem,
  onHeaderCellClick,
  handleSelectAll,
  onChecked,
}: Columns) => [
  {
    title: (
      <div className="ps-2">
        <Checkbox
          title={'Select All'}
          onChange={handleSelectAll}
          checked={checkedItems.length === data.length && data.length > 0}
          className="cursor-pointer"
        />
      </div>
    ),
    dataIndex: 'checked',
    key: 'checked',
    width: 30,
    render: (_: any, row: any) => (
      <div className="inline-flex ps-2">
        <Checkbox
          className="cursor-pointer"
          checked={checkedItems.includes(row._id)}
          {...(onChecked && { onChange: () => onChecked(row._id) })}
        />
      </div>
    ),
  },
  {
    title: <HeaderCell title="Promotion" />,
    dataIndex: 'name',
    key: 'name',
    width: 280,
    render: (name: string, row: any) => (
      <div className="flex flex-col">
        <Text className="font-semibold text-gray-900 dark:text-gray-100">
          {name}
        </Text>
        {row.code && (
          <Text className="text-xs text-gray-500 mt-0.5">
            Code: <span className="font-mono font-medium text-primary">{row.code}</span>
          </Text>
        )}
      </div>
    ),
  },
  {
    title: <HeaderCell title="Type" />,
    dataIndex: 'type',
    key: 'type',
    width: 160,
    render: (type: PromotionType) => (
      <Badge variant="outline" className="w-fit">
        {PROMOTION_TYPE_LABELS[type] || type}
      </Badge>
    ),
  },
  {
    title: <HeaderCell title="Discount Value" />,
    dataIndex: 'discountValue',
    key: 'discountValue',
    width: 140,
    render: (value: number, row: any) => {
      if (row.type === 'buy_x_get_y') {
        return (
          <Text className="font-medium text-gray-900 dark:text-gray-100">
            Buy {row.buyQuantity} → Get {row.getQuantity}
          </Text>
        );
      }
      if (row.type === 'bundle') {
        return (
          <Text className="font-medium text-gray-900 dark:text-gray-100">
            Bundle @ ₦{row.bundlePrice || 0}
          </Text>
        );
      }
      return (
        <Text className="font-semibold text-green-600 dark:text-green-400">
          {row.discountType === 'percentage' ? `${value}%` : `₦${value}`}
        </Text>
      );
    },
  },
  {
    title: <HeaderCell title="Target" />,
    dataIndex: 'applyTo',
    key: 'applyTo',
    width: 140,
    render: (applyTo: string, row: any) => {
      const productCount = row.subProducts?.length || 0;
      const sizeCount = row.sizes?.length || 0;
      return (
        <div className="flex flex-col">
          <Text className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
            {applyTo === 'all' ? 'All Products' : applyTo.replace(/_/g, ' ')}
          </Text>
          {applyTo !== 'all' && productCount > 0 && (
            <Text className="text-[11px] text-gray-500">
              {productCount} product{productCount !== 1 ? 's' : ''}
              {sizeCount > 0 && `, ${sizeCount} size${sizeCount !== 1 ? 's' : ''}`}
            </Text>
          )}
        </div>
      );
    },
  },
  {
    title: <HeaderCell title="Schedule" />,
    dataIndex: 'schedule',
    key: 'schedule',
    width: 180,
    render: (_: any, row: any) => {
      const startDate = row.startDate ? new Date(row.startDate).toLocaleDateString() : '-';
      const endDate = row.endDate ? new Date(row.endDate).toLocaleDateString() : 'No end';
      return (
        <div className="flex flex-col">
          <Text className="text-xs text-gray-500">Start: {startDate}</Text>
          <Text className="text-xs text-gray-500">End: {endDate}</Text>
        </div>
      );
    },
  },
  {
    title: <HeaderCell title="Usage" />,
    dataIndex: 'usage',
    key: 'usage',
    width: 100,
    render: (_: any, row: any) => {
      const used = row.currentUsageCount || 0;
      const limit = row.usageLimit;
      return (
        <div className="flex flex-col">
          <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {used} used
          </Text>
          {limit && (
            <Text className="text-[11px] text-gray-500">
              of {limit} max
            </Text>
          )}
        </div>
      );
    },
  },
  {
    title: <HeaderCell title="Status" />,
    dataIndex: 'status',
    key: 'status',
    width: 110,
    render: (status: PromotionStatus) => (
      <Badge color={PROMOTION_STATUS_COLORS[status]} className="capitalize">
        {status}
      </Badge>
    ),
  },
  {
    title: <HeaderCell title="Actions" />,
    dataIndex: 'action',
    key: 'action',
    width: 100,
    render: (_: string, row: any) => (
      <div className="flex items-center justify-end gap-2 pe-2">
        <Tooltip content={'Edit Promotion'} placement="top" color="invert">
          <Link href={routes.eCommerce.editPromotion(row._id)}>
            <ActionIcon size="sm" variant="outline" aria-label={'Edit Promotion'}>
              <PencilIcon className="h-3.5 w-3.5" />
            </ActionIcon>
          </Link>
        </Tooltip>
        <Tooltip content={'Delete Promotion'} placement="top" color="invert">
          <ActionIcon
            size="sm"
            variant="outline"
            color="danger"
            aria-label={'Delete Promotion'}
            onClick={(e: any) => {
              e.stopPropagation();
              onDeleteItem(row._id);
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </ActionIcon>
        </Tooltip>
      </div>
    ),
  },
];
