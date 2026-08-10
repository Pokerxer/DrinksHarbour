// app/shared/warehouses/warehouse-ref-helpers.ts
//
// Null-safe accessors for the Mongoose ref fields on a WarehouseStock line.
//
// A stock line's `warehouse` / `subProduct` / `size` is one of THREE things:
//   1. an id string          — the ref was not populated
//   2. the populated document
//   3. `null`                — the referenced doc was deleted and populate
//                              resolved the dangling ref to null
//
// Case 3 is the one that bites. `typeof null === 'object'`, so the once-common
// `typeof r.subProduct === 'object' ? r.subProduct._id : r.subProduct` narrows
// null into the "populated" branch and the very next property read throws
// `TypeError: Cannot read properties of null (reading '_id')`. These accessors
// run during render, so ONE orphaned line used to tear down the entire subtree
// — every other row disappeared with it.
//
// Orphaned lines are still real stock (they carry a real `currentQuantity`), so
// every accessor degrades to a blank/unknown label and the row keeps rendering.
// Filtering them out would silently understate on-hand quantities.
import type { WarehouseStockRow } from '@/services/warehouseStock.service';

/**
 * Narrows a Mongoose ref to its populated-document form. Unlike a bare
 * `typeof v === 'object'`, this excludes `null` — see the file header.
 */
export const isPopulated = <T>(v: T | string | null | undefined): v is T =>
  typeof v === 'object' && v !== null;

/** Id of a ref, whether populated, unpopulated, or dangling (`''`). */
export const refIdOf = (
  v:
    | WarehouseStockRow['warehouse']
    | WarehouseStockRow['size']
    | null
    | undefined
): string => (isPopulated(v) ? (v._id ?? '') : (v ?? ''));

// ── subProduct ────────────────────────────────────────────────────────────────

export const skuOf = (r: WarehouseStockRow): string =>
  isPopulated(r.subProduct)
    ? (r.subProduct.sku ?? r.subProduct._id)
    : (r.subProduct ?? '');

export const productNameOf = (r: WarehouseStockRow): string =>
  isPopulated(r.subProduct) ? (r.subProduct.product?.name ?? '') : '';

export const imageOf = (r: WarehouseStockRow): string | null => {
  if (!isPopulated(r.subProduct)) return null;
  return (
    r.subProduct.imagesOverride?.[0]?.url ??
    r.subProduct.product?.images?.[0]?.url ??
    null
  );
};

export const subProductIdOf = (r: WarehouseStockRow): string | null =>
  isPopulated(r.subProduct) ? r.subProduct._id : (r.subProduct ?? null);

// ── size ──────────────────────────────────────────────────────────────────────

export const sizeLabelOf = (r: WarehouseStockRow): string =>
  isPopulated(r.size) ? (r.size.size ?? r.size._id) : (r.size ?? '');

export const sizeIdOf = (r: WarehouseStockRow): string | null =>
  isPopulated(r.size) ? r.size._id : (r.size ?? null);

// ── warehouse ─────────────────────────────────────────────────────────────────

export const warehouseNameOf = (r: WarehouseStockRow): string =>
  isPopulated(r.warehouse)
    ? (r.warehouse.name ?? r.warehouse._id)
    : (r.warehouse ?? '');

export const warehouseCodeOf = (r: WarehouseStockRow): string =>
  isPopulated(r.warehouse) ? (r.warehouse.code ?? '') : '';
