'use client';

import React from 'react';
import {
  PiArrowUp,
  PiArrowDown,
  PiPencilSimple,
  PiTrash,
  PiSpinner,
} from 'react-icons/pi';
import { RULE_TYPE_META } from '@/app/shared/point-of-sale/pricelist-constants';
import { refName, type PricelistRule } from './types';
import { fmt, fmtDate, ruleStatus, ruleDescription } from './rule-format';

const META = RULE_TYPE_META as unknown as Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    hint?: string;
    modalHint?: string;
  }
>;

interface Props {
  rule: PricelistRule;
  deleting: boolean;
  sequenceIndex: number;
  totalRules: number;
  onDelete(): void;
  onEdit(): void;
  onMoveUp(): void;
  onMoveDown(): void;
}

export default function RuleCard({
  rule,
  deleting,
  sequenceIndex,
  totalRules,
  onDelete,
  onEdit,
  onMoveUp,
  onMoveDown,
}: Props) {
  const meta = META[rule.priceType] || META.discount;
  const sp = typeof rule.subProduct === 'object' ? rule.subProduct : undefined;
  const status = ruleStatus(rule);
  const isExpired = status.label === 'Expired';

  // "All products" when subProduct is absent AND appliedOn is blank or literally
  // 'All products'. Cart-level rules are not product-scoped.
  const isCartLevel = rule.priceType === 'cart_threshold';
  const isAllProducts =
    !sp &&
    !isCartLevel &&
    (!rule.appliedOn || rule.appliedOn === 'All products');
  const productName = isAllProducts
    ? null
    : rule.appliedOn || refName(sp?.product) || sp?.sku;

  const desc = ruleDescription(rule);

  // Constraints line
  const constraints: string[] = [];
  if ((rule.minQuantity ?? 0) > 0) constraints.push(`min qty ${rule.minQuantity}`);
  if (rule.startDate || rule.endDate) {
    constraints.push(
      `${rule.startDate ? fmtDate(rule.startDate) : '∞'} → ${
        rule.endDate ? fmtDate(rule.endDate) : '∞'
      }`
    );
  }

  // Current product promotion state (only for specific-product rules)
  const hasProductState =
    sp &&
    (sp.flashSale?.isActive ||
      (sp.isOnSale && (sp.saleDiscountValue ?? 0) > 0) ||
      (sp.bundleDeals?.length ?? 0) > 0 ||
      (sp.baseSellingPrice ?? 0) > 0);

  return (
    <div
      className={`group relative flex gap-3 border-b border-gray-100 px-4 py-3.5 transition-colors hover:bg-gray-50/60 ${
        isExpired ? 'opacity-40 hover:opacity-100' : ''
      }`}
    >
      {/* Coloured left bar */}
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-r"
        style={{ backgroundColor: meta.color }}
      />

      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: meta.bg }}
        aria-hidden
      >
        <span className="text-sm" style={{ color: meta.color }}>
          {rule.priceType === 'discount'
            ? '%'
            : rule.priceType === 'flash_sale'
              ? '⚡'
              : rule.priceType === 'fixed'
                ? '₦'
                : rule.priceType === 'formula'
                  ? 'ƒ'
                  : rule.priceType === 'bundle'
                    ? '📦'
                    : '🛒'}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {/* Row 1: type badge + product + status */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">
            #{sequenceIndex + 1}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          {isCartLevel ? (
            <span className="rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
              Cart-level
            </span>
          ) : isAllProducts ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              All products
            </span>
          ) : productName ? (
            <span className="truncate text-xs font-semibold text-gray-800">
              {productName}
            </span>
          ) : null}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${status.cls}`}
          >
            {status.label}
          </span>
        </div>

        {/* Row 2: full rule description */}
        <p className="text-[11px] font-medium text-gray-700">{desc}</p>

        {/* Row 3: constraints */}
        {constraints.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {constraints.map((c, i) => (
              <span
                key={i}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Row 4: current product promotion state */}
        {hasProductState && sp && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300">
              Now:
            </span>
            <span className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-500">
              Base {fmt(sp.baseSellingPrice || 0)}
            </span>
            {sp.flashSale?.isActive && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                ⚡ {sp.flashSale.discountPercentage}% flash active
              </span>
            )}
            {!sp.flashSale?.isActive && sp.isOnSale && (sp.saleDiscountValue ?? 0) > 0 && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                {sp.saleType === 'fixed'
                  ? `-₦${sp.saleDiscountValue}`
                  : `${sp.saleDiscountValue}% off`}{' '}
                active
              </span>
            )}
            {(sp.bundleDeals?.length ?? 0) > 0 && (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                📦 {sp.bundleDeals!.length} bundle deal
                {sp.bundleDeals!.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* fixed/formula revert note */}
        {(rule.priceType === 'fixed' || rule.priceType === 'formula') && (
          <p className="text-[10px] italic text-gray-400">
            Deleting this rule won't revert the base price — apply a new rule or
            update manually.
          </p>
        )}
      </div>

      {/* Hover actions */}
      <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          aria-label="Move up (higher priority)"
          title="Move up (higher priority)"
          onClick={onMoveUp}
          disabled={sequenceIndex === 0}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20"
        >
          <PiArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Move down (lower priority)"
          title="Move down (lower priority)"
          onClick={onMoveDown}
          disabled={sequenceIndex === totalRules - 1}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-20"
        >
          <PiArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Edit rule"
          title="Edit"
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
        >
          <PiPencilSimple className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete rule"
          title="Delete"
          onClick={onDelete}
          disabled={deleting}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
        >
          {deleting ? (
            <PiSpinner className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PiTrash className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
