'use client';

import React, { useState } from 'react';
import { PiSpinner, PiLightning, PiPlus, PiTag, PiCaretLeft, PiCaretRight } from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';
import type { PricelistRule } from './types';

const PAGE = 40;

interface Props {
  rules: PricelistRule[];
  productsLoading: boolean;
  productsError: string;
  applying: boolean;
  reordering: boolean;
  deletingId: string | null;
  onRetryProducts(): void;
  onAddRule(): void;
  onApply(): void;
  onDeleteRequest(ruleId: string): void;
  onEdit(rule: PricelistRule): void;
  onMove(ruleId: string, direction: 'up' | 'down'): void;
  children: (pageRules: PricelistRule[], page: number) => React.ReactNode;
}

export default function PanelRulesTab({
  rules,
  productsLoading,
  productsError,
  applying,
  reordering,
  deletingId,
  onRetryProducts,
  onAddRule,
  onApply,
  onDeleteRequest,
  onEdit,
  onMove,
  children,
}: Props) {
  const [page, setPage] = useState(1);
  const pageRules = rules.slice((page - 1) * PAGE, page * PAGE);
  const totalPages = Math.max(1, Math.ceil(rules.length / PAGE));
  const now = new Date();
  const expiredCount = rules.filter(
    (r) => r.endDate && new Date(r.endDate) < now
  ).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2">
        <button
          type="button"
          onClick={onApply}
          disabled={applying || rules.length === 0}
          title="Fixed & formula rules update the product base price permanently. Discount, flash sale, and bundle rules are dynamic — they activate when this pricelist is selected in a POS session."
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: BRAND }}
        >
          {applying ? (
            <PiSpinner className="h-3 w-3 animate-spin" />
          ) : (
            <PiLightning className="h-3 w-3" />
          )}
          Apply prices
        </button>
        <span className="text-[10px] text-gray-400">
          fixed &amp; formula only · discount/bundle rules are session-dynamic
        </span>
        <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
          <span>↑↓ reorder priority</span>
        </div>
        <button
          type="button"
          onClick={onAddRule}
          className="flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
        >
          <PiPlus className="h-3.5 w-3.5" />
          Add rule
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {productsLoading && rules.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
            <PiSpinner className="h-4 w-4 animate-spin" /> Loading products…
          </div>
        ) : productsError && rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-red-500">
            Could not load products
            <button
              type="button"
              onClick={onRetryProducts}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        ) : rules.length === 0 ? (
          <EmptyRules onCreate={onAddRule} />
        ) : (
          <>
            {rules.length > PAGE && (
              <Pager
                page={page}
                totalPages={totalPages}
                total={rules.length}
                onPage={setPage}
              />
            )}
            <div>
              {children(pageRules, page)}
              {reordering && (
                <p className="px-4 py-1.5 text-center text-[10px] text-gray-400">
                  Saving order…
                </p>
              )}
            </div>
            {expiredCount > 0 && (
              <p className="px-4 py-2 text-center text-[10px] text-gray-400">
                {expiredCount} expired rule{expiredCount !== 1 ? 's' : ''} above — they
                are skipped when applying
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyRules({ onCreate }: { onCreate(): void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
        <PiTag className="h-6 w-6 text-gray-300" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-500">No price rules yet</p>
        <p className="mt-0.5 text-[11px] text-gray-400">
          Click &quot;Add rule&quot; to create your first rule
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white"
        style={{ backgroundColor: BRAND }}
      >
        <PiPlus className="h-3.5 w-3.5" /> Add first rule
      </button>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage(p: number): void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-1.5 text-[10px] text-gray-400">
      <span>
        {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}
      </span>
      <div className="flex gap-0.5">
        <button
          type="button"
          aria-label="Previous rules page"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <PiCaretLeft className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Next rules page"
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <PiCaretRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
