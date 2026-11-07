// @vitest-environment jsdom
// DRI-13 — sales line-entry picker keeps industry-aware variant identity.
// Mirrors shared/purchasing/retail-variant-line-search.test.tsx for
// shared/sales/product-line-search.tsx: the exact-search path and pickSize
// must carry `name – <sizeVariantLabel>` identity (colour/option included),
// the raw sizeId must survive the pick, and legacy beverage rows (no
// colour/option data) render exactly the same strings as before.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import ProductLineSearch from './product-line-search';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('exact search picks a retail variant row with the industry-aware label', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          subProducts: [
            {
              _id: 'shirt-listing',
              product: { name: 'Shirt' },
              costPrice: 4000,
              sizes: [
                {
                  _id: 'navy-row',
                  displayName: 'M',
                  colorName: 'Navy',
                  optionName: 'Slim',
                  sku: 'SHIRT-NAVY-M',
                  costPrice: 4500,
                  sellingPrice: 6000,
                },
                {
                  _id: 'black-row',
                  displayName: 'M',
                  colorName: 'Black',
                  optionName: 'Regular',
                  sku: 'SHIRT-BLACK-M',
                  costPrice: 5000,
                  sellingPrice: 7000,
                  unitsPerPack: 3,
                },
              ],
            },
            {
              _id: 'tv-listing',
              product: { name: 'Smart TV' },
              costPrice: 300000,
              sizes: [
                {
                  _id: 'tv-wifi-row',
                  optionName: 'Wi-Fi',
                  sku: 'TV-WIFI',
                  costPrice: 300000,
                  sellingPrice: 380000,
                },
              ],
            },
          ],
        },
      }),
    })
  );

  const onSelect = vi.fn();
  const { container } = render(
    <ProductLineSearch token="token" query="Shirt" onSelect={onSelect} />
  );
  const input = container.querySelector('input')!;
  // Exact-search fetch (300ms debounce) returns the matched rows; size
  // identities compose via the shared sizeVariantLabel source and are visible
  // once the product row expands.
  fireEvent.change(input, { target: { value: 'Shirt' } });
  fireEvent.focus(input);
  fireEvent.mouseDown(await screen.findByText('Shirt'));
  expect(screen.getByText('M · Navy · Slim')).toBeTruthy();
  expect(screen.getByText('M · Black · Regular')).toBeTruthy();
  // Electronics: optionName composes into the identity even without a
  // displayName (no size dimension for the product).
  fireEvent.mouseDown(screen.getByText('Smart TV'));
  expect(screen.getByText('Wi-Fi')).toBeTruthy();

  fireEvent.mouseDown(screen.getByText('Shirt'));
  fireEvent.mouseDown(screen.getByText('M · Black · Regular'));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Shirt – M · Black · Regular',
      sku: 'SHIRT-BLACK-M',
      subProductId: 'shirt-listing',
      sellingPrice: 7000,
      unitsPerPack: 3,
      sizeId: 'black-row',
      sizeName: 'M · Black · Regular',
    })
  );
});

test('a legacy beverage row renders exactly the same strings as before', async () => {
  const beverage = {
    _id: 'water-listing',
    product: { name: 'Water' },
    costPrice: 200,
    sizes: [
      {
        _id: 'water-row',
        displayName: '500 ml',
        sku: 'WATER-500',
        costPrice: 200,
        sellingPrice: 300,
      },
    ],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { subProducts: [beverage] },
      }),
    })
  );

  const onSelect = vi.fn();
  const { container } = render(
    <ProductLineSearch token="token" query="" onSelect={onSelect} />
  );
  fireEvent.focus(container.querySelector('input')!);
  fireEvent.mouseDown(await screen.findByText('Water'));
  // No colour/option data → the label is byte-identical to the old raw
  // `displayName ?? size` composition.
  expect(screen.getByText('500 ml')).toBeTruthy();
  fireEvent.mouseDown(screen.getByText('500 ml'));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Water – 500 ml',
      sku: 'WATER-500',
      subProductId: 'water-listing',
      sellingPrice: 300,
      sizeId: 'water-row',
      sizeName: '500 ml',
    })
  );
});
