'use client';
import SelectedProductCell from './selected-sales-product';
import type { CSSProperties, ReactNode } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import { PiTrash, PiChartBar } from 'react-icons/pi';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { packsLabel, packNounOf } from '../purchases/types';
import PackSizeInput from '../purchases/pack-size-input';
import ProductLineSearch, {
  type ProductLineSelection,
} from './product-line-search';
import type { DraftLine, PricedLine } from './sales-line-types';
import NumberInput from '@/components/ui/number-input';
import SalesLineInputs from './sales-line-inputs';
const INLINE_CELL_CLS =
  'w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-right text-sm focus:border-brand focus:outline-none';
interface SalesLineProductRowProps {
  token: string;
  line: PricedLine;
  hasProduct: boolean;
  onUpdate: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: DraggableAttributes;
  dragHandle: ReactNode;
  warehouseId?: string;
  warehouseName?: string;
}

/** A product line rendered as a single sortable <tr>: the product cell holds
 *  the name/link + the inline description beneath it, keeping it one row so the
 *  dnd-kit transform applies cleanly. */
export default function SalesLineProductRow({
  token,
  line,
  hasProduct,
  onUpdate,
  onRemove,
  setNodeRef,
  style,
  attributes,
  dragHandle,
  warehouseId,
  warehouseName,
}: SalesLineProductRowProps) {
  return (
    <tr ref={setNodeRef} style={style}>
      <td className="w-6 px-1 py-2 align-top">{dragHandle}</td>
      <td data-label="Product" className="px-2 py-2 align-top">
        {hasProduct ? (
          <SelectedProductCell
            line={line}
            onChange={() =>
              onUpdate(line.key, {
                subProductId: '',
                product: undefined,
                name: '',
                sku: '',
                sizeId: undefined,
                sizeName: undefined,
                quantity: line.quantity,
                packSize: 1,
                uom: undefined,
                baseUnitPrice: 0,
                costPrice: 0,
                taxRate: 0,
                discount: 0,
                discountType: 'fixed',
                promoDiscount: 0,
                promoName: undefined,
                enginePriced: false,
                priceOverridden: false,
                description: '',
              })
            }
          />
        ) : (
          <ProductLineSearch
            token={token}
            query={line.name}
            warehouseId={warehouseId}
            onSelect={(info: ProductLineSelection) =>
              onUpdate(line.key, {
                subProductId: info.subProductId,
                product: info.productId,
                name: info.name,
                sku: info.sku,
                sizeId: info.sizeId,
                sizeName: info.sizeName,
                baseUnitPrice: info.sellingPrice,
                costPrice: info.costPrice,
                taxRate: info.taxRate,
                discount: 0,
                discountType: 'fixed',
                promoDiscount: 0,
                promoName: undefined,
                enginePriced: false,
                packSize: Math.max(1, Math.floor(info.unitsPerPack ?? 1)),
                uom: undefined,
                priceOverridden: false,
                activeBundles: info.bundleDeals,
                originalPrice: info.originalPrice,
                description: '',
              })
            }
          />
        )}
        {hasProduct && warehouseId && line.availableStock === 0 && (
          <p className="mt-1 inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
            Not available in this warehouse
          </p>
        )}
        {hasProduct && (
          <textarea
            aria-label={`Description for ${line.name}`}
            rows={2}
            value={line.description ?? ''}
            onChange={(e) =>
              onUpdate(line.key, { description: e.target.value })
            }
            placeholder="Add a product description…"
            className="mt-1 w-full resize-y rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-brand focus:outline-none"
          />
        )}
      </td>
      <td data-label="Quantity" className="px-2 py-2 align-top">
        <div className="flex items-center gap-1.5">
          <NumberInput
            title={`Quantity for ${line.name}`}
            value={line.quantity}
            min={1}
            fallback={1}
            onCommit={(v) => onUpdate(line.key, { quantity: Math.round(v) })}
            className={`${INLINE_CELL_CLS} min-w-0 flex-1`}
          />
          {line.availableStock != null &&
            (() => {
              const ok = line.availableStock >= line.quantity;
              return (
                <span className="group relative flex items-center">
                  <PiChartBar
                    className={`h-3.5 w-3.5 shrink-0 ${ok ? 'text-emerald-500' : 'text-red-500'}`}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 rounded-lg border border-gray-100 bg-white p-2.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-700">
                      Stock
                    </span>
                    {line.sizeName && (
                      <span className="mb-1.5 block text-[10px] text-gray-400">
                        {line.sizeName}
                      </span>
                    )}
                    <span className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">
                        Available{warehouseName ? ` · ${warehouseName}` : ''}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {line.availableStock}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">Ordering</span>
                      <span
                        className={`font-semibold ${ok ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {line.quantity}
                      </span>
                    </span>
                    {!ok && (
                      <span className="mt-1.5 block rounded bg-red-50 px-1.5 py-1 text-[10px] font-medium text-red-600">
                        {line.quantity - line.availableStock} unit
                        {line.quantity - line.availableStock !== 1
                          ? 's'
                          : ''}{' '}
                        short
                      </span>
                    )}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white" />
                  </span>
                </span>
              );
            })()}
        </div>
      </td>
      <td data-label="Pack size" className="px-2 py-2 align-top">
        <PackSizeInput
          value={line.packSize}
          onApply={(patch) =>
            onUpdate(line.key, {
              packSize: Math.max(1, Math.floor(patch.packSize) || 1),
              uom: patch.uom ?? line.uom,
            })
          }
        />
      </td>
      <td data-label="Packs" className="px-2 py-2 align-top">
        <div className="flex h-[38px] items-center justify-end rounded-lg border border-gray-100 bg-gray-50 px-2">
          <span
            title="Pack breakdown of the ordered quantity"
            className="text-right text-xs font-semibold text-gray-700"
          >
            {packsLabel(line.quantity, line.packSize, packNounOf(line.uom))}
          </span>
        </div>
      </td>
      <td data-label="Unit price" className="px-2 py-2 align-top">
        <div className="flex items-center justify-end gap-1.5">
          {line.priceOverridden && (
            <span
              title="Manually set"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            />
          )}
          <NumberInput
            title={`Unit price for ${line.name}`}
            value={line.unitPrice}
            min={0}
            onCommit={(v) =>
              onUpdate(line.key, { baseUnitPrice: v, priceOverridden: true })
            }
            className={`${INLINE_CELL_CLS} min-w-0 flex-1`}
          />
        </div>
      </td>
      <SalesLineInputs line={line} onUpdate={onUpdate} />
      <td
        data-label="Untaxed total"
        className="px-2 py-2 text-right align-top text-sm font-semibold text-gray-900"
      >
        {fmtCur(Math.max(0, line.lineTotal - (line.promoDiscount || 0)), 'NGN')}
        {Boolean(line.promoDiscount) && (
          <p className="mt-1 text-[10px] font-normal text-emerald-700">
            {line.promoName || 'Promotion'}: −
            {fmtCur(line.promoDiscount || 0, 'NGN')}
          </p>
        )}
        {line.taxRate > 0 && (
          <p className="mt-0.5 text-[10px] font-normal text-gray-400">
            + {fmtCur(line.taxAmount, 'NGN')} tax
          </p>
        )}
      </td>
      <td className="px-2 py-2 text-right align-top">
        <button
          type="button"
          aria-label={`Remove product ${line.name}`}
          onClick={() => onRemove(line.key)}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <PiTrash className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
