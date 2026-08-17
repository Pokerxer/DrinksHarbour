// What a quotation becomes when a cashier loads it into the cart.
//
// `handleLoadOrder(so: any)` read three field names the SalesOrder schema does
// not use — `line.sizeId`, `line.sizeName`, `line.costPrice` — and because the
// parameter was `any`, TypeScript never looked. Every sized line therefore
// loaded with NO size and ZERO cost: stock came off the wrong unit, the whole
// line read as margin in POS profit reporting, and reconcile's own matcher
// (`if (sold.sizeId && ...)`) then skipped its size check and could consume the
// wrong SO line on an order listing two sizes of one product.
//
// None of that raised an error. It produced a plausible cart. So these tests
// assert on the cart line that comes out, field by field.

import { describe, expect, test } from 'vitest';
import {
  salesOrderToCartItems,
  salesOrderWarehouseId,
} from './pos-sales-order-lines';
import type { LoadedSalesOrder, SalesOrderLine } from './pos-sales-order-lines';
import type { POSProduct } from '../types';

const SP = '651111111111111111111111';
const SIZE = '652222222222222222222222';
const PROD = '653333333333333333333333';
const WH = '654444444444444444444444';

const catalogue: POSProduct[] = [
  {
    _id: SP,
    sku: 'SKU-PARENT',
    product: {
      _id: PROD,
      name: 'Hennessy VS',
      images: [{ url: 'https://cdn/x.jpg' }],
    },
    baseSellingPrice: 6250,
    costPrice: 3000,
    availableStock: 40,
    totalStock: 40,
    stockStatus: 'in_stock',
    status: 'active',
    sellWithoutSizeVariants: false,
    visibleInPOS: true,
    isOnSale: false,
    sizes: [
      {
        _id: SIZE,
        displayName: '70cl',
        sellingPrice: 6500,
        costPrice: 3200,
        availableStock: 12,
        sku: 'SKU-70CL',
      },
    ],
  } as unknown as POSProduct,
];

function line(over: Partial<SalesOrderLine> = {}): SalesOrderLine {
  return {
    _id: 'L1',
    lineType: 'product',
    subproduct: SP,
    product: PROD,
    size: SIZE,
    sku: 'SKU-70CL',
    name: 'Hennessy VS',
    quantity: 10,
    unitPrice: 4000,
    discount: 0,
    discountType: 'fixed',
    promoDiscount: 0,
    taxRate: 0,
    fulfilledQty: 0,
    ...over,
  };
}

const so = (over: Partial<LoadedSalesOrder> = {}): LoadedSalesOrder => ({
  _id: 'so1',
  soNumber: 'Q-0001',
  items: [line()],
  ...over,
});

describe('salesOrderToCartItems', () => {
  test("carries the line's size — the schema field is `size`, not `sizeId`", () => {
    const [item] = salesOrderToCartItems(so(), catalogue);

    expect(item.sizeId).toBe(SIZE);
    expect(item.variant).toBe('70cl');
  });

  test('carries the quoted price, not the catalogue price', () => {
    const [item] = salesOrderToCartItems(so(), catalogue);

    expect(item.price).toBe(4000);
  });

  test('folds the quoted discount and promotion into the unit price', () => {
    // (10 × 4,000 − 2,000 − 500) / 10.  The till's per-line discount is a
    // percentage from the dialpad and cannot carry a flat ₦ off a line, so the
    // agreed money is carried as the price — matching what the server charges.
    const [item] = salesOrderToCartItems(
      so({
        items: [
          line({ discount: 2000, discountType: 'fixed', promoDiscount: 500 }),
        ],
      }),
      catalogue
    );

    expect(item.price).toBe(3750);
    expect(item.discount).toBe(0);
  });

  test('folds a percentage discount the same way', () => {
    const [item] = salesOrderToCartItems(
      so({ items: [line({ discount: 10, discountType: 'percentage' })] }),
      catalogue
    );

    expect(item.price).toBe(3600);
  });

  test('takes cost from the catalogue, because a Sales Order line has none', () => {
    // `line.costPrice` does not exist, so every loaded line recorded a zero
    // cost — and the entire sale read as margin in POS profit reporting.
    const [item] = salesOrderToCartItems(so(), catalogue);

    expect(item.costPrice).toBe(3200);
  });

  test('falls back to the parent cost when the line is unsized', () => {
    const [item] = salesOrderToCartItems(
      so({ items: [line({ size: null, sku: 'SKU-PARENT' })] }),
      catalogue
    );

    expect(item.sizeId).toBeUndefined();
    expect(item.costPrice).toBe(3000);
  });

  test('carries stock and image from the catalogue so the line behaves like a tapped one', () => {
    const [item] = salesOrderToCartItems(so(), catalogue);

    expect(item.stock).toBe(12);
    expect(item.image).toBe('https://cdn/x.jpg');
    expect(item.productId).toBe(PROD);
  });

  test('carries no bundle deals — the quoted price is already the negotiated one', () => {
    const [item] = salesOrderToCartItems(so(), catalogue);

    expect(item.activeBundles).toEqual([]);
  });

  test('loads only what is still outstanding on a part-fulfilled order', () => {
    const [item] = salesOrderToCartItems(
      so({ items: [line({ quantity: 10, fulfilledQty: 4 })] }),
      catalogue
    );

    expect(item.quantity).toBe(6);
  });

  test('skips a line that is already fully fulfilled', () => {
    expect(
      salesOrderToCartItems(
        so({ items: [line({ quantity: 10, fulfilledQty: 10 })] }),
        catalogue
      )
    ).toEqual([]);
  });

  test('skips section and note lines', () => {
    const items = salesOrderToCartItems(
      so({
        items: [
          { _id: 'S', lineType: 'section', name: 'Spirits' },
          line(),
          { _id: 'N', lineType: 'note', name: 'deliver Friday' },
        ],
      }),
      catalogue
    );

    expect(items).toHaveLength(1);
  });

  test('still loads a line whose sub-product is not in the catalogue', () => {
    // Refusing to load it would be worse than loading it without a cost: the
    // cashier can see the quote and sell it. The price is still the agreed one.
    const [item] = salesOrderToCartItems(so(), []);

    expect(item.price).toBe(4000);
    expect(item.name).toBe('Hennessy VS');
    expect(item.costPrice).toBe(0);
    expect(item.sizeId).toBe(SIZE);
  });

  test('a zero-quantity line cannot divide the agreed price by zero', () => {
    expect(
      salesOrderToCartItems(so({ items: [line({ quantity: 0 })] }), catalogue)
    ).toEqual([]);
  });
});

describe('salesOrderWarehouseId', () => {
  test('unwraps a populated warehouse ref', () => {
    // The POS list endpoint does `.populate('warehouseId', 'name code')`, so
    // this is an object; passing it straight to setWarehouseId stringified it
    // to "[object Object]" and the quote's warehouse was silently ignored —
    // the cashier sold another warehouse's stock without being told.
    expect(
      salesOrderWarehouseId({
        warehouseId: { _id: WH, name: 'Main', code: 'MN' },
      })
    ).toBe(WH);
  });

  test('passes a bare id through', () => {
    expect(salesOrderWarehouseId({ warehouseId: WH })).toBe(WH);
  });

  test('is undefined when the order names no warehouse', () => {
    expect(salesOrderWarehouseId({})).toBeUndefined();
    expect(salesOrderWarehouseId({ warehouseId: null })).toBeUndefined();
  });
});
