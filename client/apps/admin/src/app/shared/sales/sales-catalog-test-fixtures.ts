import { vi } from 'vitest';
import type { SalesCatalogModalProps } from './sales-catalog-modal';
export const product = (name = 'Cabernet', id = 'sp') => ({
  _id: id,
  salesPricing: undefined as
    | { unitPrice: number; quantity: number }
    | undefined,
  sku: `SKU-${id}`,
  product: { _id: 'central', name },
  availableStock: 8,
  baseSellingPrice: 1000,
  costPrice: 400,
  taxRate: 7.5,
  sizes: [
    {
      _id: `size-${id}`,
      salesPricing: undefined as
        | { unitPrice: number; quantity: number }
        | undefined,
      size: '75cl',
      sellingPrice: 1000,
      costPrice: 400,
      availableStock: 8,
      unitsPerPack: 12,
    },
  ],
});
const body = (rows = [product()], page = 1, total = 25) => ({
  success: true,
  data: {
    subProducts: rows.map((row) => ({
      ...row,
      salesPricing: row.salesPricing ?? {
        unitPrice: row.baseSellingPrice,
        quantity: 1,
      },
      sizes: row.sizes.map((size) => ({
        ...size,
        salesPricing: size.salesPricing ?? {
          unitPrice: size.sellingPrice,
          quantity: 1,
        },
      })),
    })),
    pagination: {
      page,
      total,
      pages: Math.ceil(total / 24),
      hasNext: page * 24 < total,
      hasPrev: page > 1,
    },
    facets: {
      categories: [],
      brands: [{ id: 'rare', name: 'Rare brand' }],
      types: [],
    },
  },
});
export const response = (rows = [product()], page = 1, total = 25) => ({
  ok: true,
  json: async () => body(rows, page, total),
});
export const props = (): SalesCatalogModalProps => ({
  open: true,
  token: 'token',
  warehouseId: 'warehouse',
  warehouseName: 'Main shop',
  currency: 'NGN',
  qtyMap: {},
  onClose: vi.fn(),
  onAdd: vi.fn(),
  onSetQty: vi.fn(),
  onRemove: vi.fn(),
});
