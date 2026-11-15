// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BuilderCatalogModal from './builder-catalog-modal';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('uses Woodford checkout stock and price in both the catalogue and tenant picker', async () => {
  const product = { _id: 'product', name: 'Woodford Reserve' };
  const offers = [
    {
      productId: product._id,
      subProductId: 'listing',
      tenantId: 'tenant',
      tenantName: 'Wyn City',
      sizes: [
        {
          sizeId: 'size',
          displayName: '70cl',
          availableStock: 103,
          marketplacePrice: 28500,
        },
      ],
    },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const data = url.includes('/catalogue/offers')
        ? { offers }
        : {
            subProducts: [{ _id: 'listing', product, sizes: [{ stock: 200 }] }],
            pagination: { total: 1 },
          };
      return new Response(JSON.stringify({ success: true, data }));
    })
  );
  const onAdd = vi.fn();
  render(
    <BuilderCatalogModal
      open
      token="test"
      lines={[]}
      onClose={vi.fn()}
      onAdd={onAdd}
    />
  );
  const card = await screen.findByRole('article', { name: product.name });
  expect(within(card).getByText('103 available')).toBeTruthy();
  expect(card.textContent).toContain('28,500');
  fireEvent.click(within(card).getByRole('button', { name: 'Add to order' }));
  const picker = await screen.findByRole('dialog', {
    name: 'Offered by 1 tenant',
  });
  expect(within(picker).getByText('103 in stock')).toBeTruthy();
  fireEvent.click(within(picker).getByRole('button', { name: 'Add' }));
  expect(onAdd).toHaveBeenCalledWith([
    expect.objectContaining({
      subProductId: 'listing',
      sizeId: 'size',
      tenantId: 'tenant',
      unitPrice: 28500,
    }),
  ]);
  expect(
    await screen.findByRole('dialog', { name: 'Product catalogue' })
  ).toBeTruthy();
});
