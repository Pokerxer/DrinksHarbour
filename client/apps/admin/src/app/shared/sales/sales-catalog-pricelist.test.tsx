// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import SalesCatalogModal from './sales-catalog-modal';
import { props, product, response } from './sales-catalog-test-fixtures';
import { effectiveSizePrice, sizeSelection } from './sales-catalog-pricing';
import {
  catalogSelectionToDraftLine,
  liveUnitPrice,
} from './sales-create-pricing-helpers';
import { mapCatalogueProduct } from './sales-catalog-data';
vi.mock('next/image', () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const rules = (fixedPrice: number) => ({
  _id: String(fixedPrice),
  rules: [{ priceType: 'fixed', fixedPrice, minQuantity: 0 }],
});
const mapped = () => mapCatalogueProduct(product());
test('catalogue switches selected pricelist without reopening and adds its displayed price', async () => {
  const quote = (price: number) => {
    const raw = product();
    return response([
      {
        ...raw,
        sizes: [
          { ...raw.sizes[0], salesPricing: { unitPrice: price, quantity: 1 } },
        ],
      },
    ]);
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce(quote(650)).mockResolvedValueOnce(quote(800))
  );
  const callbacks = props();
  const { rerender } = render(
    <SalesCatalogModal {...callbacks} pricelist={rules(650)} />
  );
  const card = await screen.findByRole('article', { name: 'Cabernet' });
  expect(card.textContent).toContain('650');
  rerender(<SalesCatalogModal {...callbacks} pricelist={rules(800)} />);
  const updated = await screen.findByRole('article', { name: 'Cabernet' });
  await waitFor(() => expect(updated.textContent).toContain('800'));
  expect(updated.textContent).not.toContain('650');
  fireEvent.click(within(updated).getByRole('button', { name: /Choose size/ }));
  fireEvent.click(
    within(updated).getByRole('button', { name: 'Add Cabernet 75cl' })
  );
  expect(callbacks.onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ sellingPrice: 800, originalPrice: 1000 })
  );
});
test('catalogue quantity tiers use the selected variant quantity', () => {
  const p = mapped();
  const list = {
    rules: [{ priceType: 'fixed', fixedPrice: 700, minQuantity: 6 }],
  };
  expect(effectiveSizePrice(p, p.sizes[0], list, 6)).toBe(700);
  expect(effectiveSizePrice(p, p.sizes[0], list, 1)).toBe(1000);
});
test('wholesale formula uses size wholesale instead of retail or cost', () => {
  const p = mapped();
  const size = { ...p.sizes[0], wholesalePrice: 600 };
  expect(
    effectiveSizePrice(p, size, {
      rules: [
        { priceType: 'formula', markupBase: 'wholesale', markupPercentage: 20 },
      ],
    })
  ).toBe(720);
});
test('catalogue mapping carries size wholesale pricing', () => {
  const raw = product();
  const p = mapCatalogueProduct({
    ...raw,
    sizes: [{ ...raw.sizes[0], wholesalePrice: 600 }],
  });
  expect(p.sizes[0].wholesalePrice).toBe(600);
});
test('draft lines apply a selected discount once to the original catalogue price', () => {
  const p = mapped();
  const list = {
    rules: [
      {
        priceType: 'discount',
        discountType: 'percentage',
        discountPercentage: 10,
      },
    ],
  };
  const selection = sizeSelection(p, p.sizes[0], list);
  expect(selection.sellingPrice).toBe(900);
  const line = catalogSelectionToDraftLine(selection, 1);
  expect(liveUnitPrice(line, list)).toBe(900);
  expect(line.priceOverridden).toBe(false);
});

test('an open catalogue updates the visible server tier when its selected quantity changes', async () => {
  const raw = product();
  const quote = (unitPrice: number, quantity: number) =>
    response([
      {
        ...raw,
        sizes: [{ ...raw.sizes[0], salesPricing: { unitPrice, quantity } }],
      },
    ]);
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(quote(700, 6))
      .mockResolvedValueOnce(quote(1000, 1))
  );
  const callbacks = props();
  const list = {
    _id: 'tier',
    rules: [{ priceType: 'fixed', fixedPrice: 700, minQuantity: 6 }],
  };
  const { rerender } = render(
    <SalesCatalogModal
      {...callbacks}
      pricelist={list}
      qtyMap={{ 'sp|size-sp': 6 }}
    />
  );
  await screen.findByText(/700/);
  rerender(
    <SalesCatalogModal
      {...callbacks}
      pricelist={list}
      qtyMap={{ 'sp|size-sp': 1 }}
    />
  );
  await screen.findByText(/1,000/);
  expect(screen.queryByText(/₦700/)).toBeNull();
});
test('wholesale metadata reaches the new draft line and no-pricelist uses retail', () => {
  const p = mapped(),
    size = { ...p.sizes[0], wholesalePrice: 600 };
  const list = {
    rules: [
      { priceType: 'formula', markupBase: 'wholesale', markupPercentage: 20 },
    ],
  };
  const selection = sizeSelection(p, size, list);
  expect(liveUnitPrice(catalogSelectionToDraftLine(selection, 1), list)).toBe(
    720
  );
  expect(sizeSelection(p, size, null).sellingPrice).toBe(1000);
});

test('catalogue displays the server sales price and does not apply pricelist rules twice', () => {
  const raw = product();
  const p = mapCatalogueProduct({
    ...raw,
    sizes: [
      { ...raw.sizes[0], salesPricing: { quantity: 6, unitPrice: 25600 } },
    ],
  } as Parameters<typeof mapCatalogueProduct>[0]);
  const list = { rules: [{ priceType: 'discount', discountPercentage: 10 }] };
  expect(effectiveSizePrice(p, p.sizes[0], list, 6)).toBe(25600);
  const selection = sizeSelection(p, p.sizes[0], list, 6);
  expect(liveUnitPrice(catalogSelectionToDraftLine(selection, 6), list)).toBe(
    25600
  );
});
