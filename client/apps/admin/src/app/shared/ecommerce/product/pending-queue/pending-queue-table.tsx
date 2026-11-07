'use client';

/**
 * TanStack table for the pending queue. Page data comes from the server one
 * page at a time (`GET /api/products/admin/pending`), so pagination is
 * rendered from the server's pagination DTO — never sliced off the local rows
 * — and every page or size change re-queries the endpoint.
 */

import { useEffect } from 'react';
import type { TableMeta } from '@tanstack/react-table';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { ActionIcon, Flex, Select, SelectOption, Text } from 'rizzui';
import {
  PiCaretDoubleLeftBold,
  PiCaretDoubleRightBold,
  PiCaretLeftBold,
  PiCaretRightBold,
} from 'react-icons/pi';
import { pendingProductColumns } from './columns';
import type { PendingProductDTO, PendingProductPagination } from '@/services/product.service';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Row-action handlers + in-flight ids passed to cells through
 * `table.options.meta`. TanStack's global TableMeta cannot be safely
 * augmented here (two table-core copies exist in the dependency tree), so
 * columns.tsx narrows its untyped meta to this interface once, at the top of
 * the action column.
 */
export interface PendingQueueTableMeta {
  approvingId?: string | null;
  rejectingId?: string | null;
  onApprove?: (product: PendingProductDTO) => void;
  onRejectClick?: (product: PendingProductDTO) => void;
}

export default function PendingQueueTable({
  rows,
  meta,
  pagination,
  page,
  limit,
  onPageChange,
  onLimitChange,
}: {
  rows: PendingProductDTO[];
  meta: PendingQueueTableMeta;
  pagination: PendingProductPagination | null;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const { table, setData } = useTanStackTable<PendingProductDTO>({
    tableData: rows,
    columnConfig: pendingProductColumns,
    options: {
      initialState: {
        // Local rows are always one server page (≤ 100 — the server caps
        // limit). Keep the TanStack row model never slicing: the footer below
        // drives real, server-truth pagination.
        pagination: { pageIndex: 0, pageSize: 100 },
      },
      // TanStack meta is an open interface; the queue's narrower contract
      // lives in PendingQueueTableMeta (mirrored in columns.tsx).
      meta: meta as TableMeta<PendingProductDTO> | undefined,
      enableColumnResizing: false,
    },
  });

  // Server pages replace the whole row set; keep the table's data in sync.
  useEffect(() => setData(rows), [rows, setData]);

  return (
    <>
      <Table
        table={table}
        variant="modern"
        classNames={{
          container: 'border border-muted rounded-xl',
          rowClassName: 'last:border-0',
        }}
      />
      <PendingQueuePagination
        pagination={pagination}
        page={page}
        limit={limit}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </>
  );
}

/**
 * Server-truth pagination footer. Shows no per-page selector until pages
 * exceed one row-set; mirrors TableFooter/TablePagination chrome.
 */
export function PendingQueuePagination({
  pagination,
  page,
  limit,
  onPageChange,
  onLimitChange,
}: {
  pagination: PendingProductPagination | null;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  if (!pagination) return null;
  const { total, pages } = pagination;
  const prev = () => onPageChange(Math.max(1, page - 1));
  const next = () => onPageChange(Math.min(pages, page + 1));
  const first = () => onPageChange(1);
  const last = () => onPageChange(pages);

  return (
    <Flex
      gap="6"
      align="center"
      justify="between"
      className="@container py-4"
    >
      <Text className="tabular-nums font-normal text-gray-600">
        Page <span className="font-semibold">{page}</span> of{' '}
        <span className="font-semibold">{Math.max(pages, 1)}</span> ·{' '}
        {total} pending {total === 1 ? 'product' : 'products'}
      </Text>
      <Flex align="center" className="shrink-0">
        <Select
          size="sm"
          variant="flat"
          aria-label="Rows per page"
          className="w-16"
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          value={limit}
          onChange={(v: SelectOption) => onLimitChange(Number(v.value))}
          suffixClassName="[&>svg]:size-3"
          selectClassName="font-semibold text-xs ring-0 shadow-sm h-7"
        />
        <Flex align="center" gap="1" className="ms-3">
          <ActionIcon
            size="sm"
            variant="outline"
            aria-label="First page"
            onClick={first}
            disabled={page <= 1}
          >
            <PiCaretDoubleLeftBold className="h-3.5 w-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="outline"
            aria-label="Previous page"
            onClick={prev}
            disabled={page <= 1}
          >
            <PiCaretLeftBold className="h-3.5 w-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="outline"
            aria-label="Next page"
            onClick={next}
            disabled={page >= pages}
          >
            <PiCaretRightBold className="h-3.5 w-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="outline"
            aria-label="Last page"
            onClick={last}
            disabled={page >= pages}
          >
            <PiCaretDoubleRightBold className="h-3.5 w-3.5" />
          </ActionIcon>
        </Flex>
      </Flex>
    </Flex>
  );
}
