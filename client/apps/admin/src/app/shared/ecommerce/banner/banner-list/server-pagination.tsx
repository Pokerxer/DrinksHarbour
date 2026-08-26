// @ts-nocheck
'use client';

/**
 * Server-driven pagination for the banners list.
 * The @core TablePagination is client-only (it paginates whatever rows are
 * already loaded), so banners — which come pre-paginated from
 * GET /api/banners — get this component instead: real totals, per-page size
 * and first/prev/next/last controls that trigger fresh fetches.
 */

import { ActionIcon, Select, Text } from 'rizzui';
import {
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCaretDoubleLeftBold,
  PiCaretDoubleRightBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
];

export default function ServerPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const btnCls =
    'text-gray-900 shadow-sm disabled:text-gray-400 disabled:shadow-none';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4',
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <Text className="hidden font-normal text-gray-600 sm:block">
          Rows per page
        </Text>
        <Select
          size="sm"
          variant="flat"
          options={PAGE_SIZE_OPTIONS}
          className="w-16"
          value={pageSize}
          onChange={(v: any) => onPageSizeChange(Number(v?.value ?? v))}
          suffixClassName="[&>svg]:size-3"
          selectClassName="font-semibold text-xs ring-0 shadow-sm h-7"
          optionClassName="font-medium text-xs px-2 justify-center"
        />
      </div>

      <div className="flex items-center gap-3">
        <Text className="hidden font-normal text-gray-600 md:block">
          {start.toLocaleString()}–{end.toLocaleString()} of{' '}
          {total.toLocaleString()}
        </Text>
        <Text className="hidden font-normal text-gray-600 lg:block">
          Page {page} of {totalPages}
        </Text>
        <div className="grid grid-cols-4 gap-2">
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label="Go to first page"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className={btnCls}
          >
            <PiCaretDoubleLeftBold className="size-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label="Go to previous page"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={btnCls}
          >
            <PiCaretLeftBold className="size-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label="Go to next page"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={btnCls}
          >
            <PiCaretRightBold className="size-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label="Go to last page"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className={btnCls}
          >
            <PiCaretDoubleRightBold className="size-3.5" />
          </ActionIcon>
        </div>
      </div>
    </div>
  );
}
