// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import ProductLineSearch from '../sales/product-line-search';
import PurchasesProductLineSearch from './purchases-product-line-search';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test.each([
  ['purchase', PurchasesProductLineSearch],
  ['sales', ProductLineSearch],
] as const)(
  '%s picks an exact retail row and preserves legacy beverage labels',
  async (flow, Picker) => {
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
                sizes: [
                  {
                    _id: 'navy-row',
                    displayName: 'M',
                    colorName: 'Navy',
                    optionName: 'Slim',
                    costPrice: 4500,
                    sellingPrice: 6000,
                  },
                  {
                    _id: 'black-row',
                    displayName: 'M',
                    colorName: 'Black',
                    optionName: 'Regular',
                    costPrice: 5000,
                    sellingPrice: 7000,
                    unitsPerPack: 3,
                  },
                ],
              },
              {
                _id: 'water-listing',
                product: { name: 'Water' },
                sizes: [{ _id: 'water-row', displayName: '500 ml' }],
              },
            ],
          },
        }),
      })
    );

    const onSelect = vi.fn();
    const { container } = render(
      <Picker token="token" query="" onSelect={onSelect} />
    );
    fireEvent.focus(container.querySelector('input')!);
    fireEvent.mouseDown(await screen.findByText('Water'));
    expect(screen.getByText('500 ml')).toBeTruthy();
    fireEvent.mouseDown(screen.getByText('Shirt'));
    expect(screen.getByText('M · Navy · Slim')).toBeTruthy();
    fireEvent.mouseDown(screen.getByText('M · Black · Regular'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        subProductId: 'shirt-listing',
        sizeId: 'black-row',
        sizeName: 'M · Black · Regular',
        ...(flow === 'purchase'
          ? { unitPrice: 5000, packSize: 3 }
          : { sellingPrice: 7000, unitsPerPack: 3 }),
      })
    );
  }
);
