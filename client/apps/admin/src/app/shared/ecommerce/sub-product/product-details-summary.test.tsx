import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import SubProductDetailsSummary from './product-details-summary';
import DuplicateSubProductButton from './duplicate-button';
import { takeDuplicateSource } from './create-edit/duplicate-intent';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  push.mockReset();
  takeDuplicateSource();
});

it('renders duplication without starting it or exposing a replayable URL', () => {
  const html = renderToStaticMarkup(
    <SubProductDetailsSummary
      product={{ id: 'source-id', name: 'Original product' }}
    />
  );
  expect(html).not.toContain('duplicateFrom');
  expect(html).toContain('Duplicate');
  expect(html).toContain('/sub-products/source-id/edit');
  expect(takeDuplicateSource()).toBeNull();
  expect(push).not.toHaveBeenCalled();
});

it('names the tenant-private central identity without changing operational badges', () => {
  const html = renderToStaticMarkup(
    <SubProductDetailsSummary
      product={{
        id: 'private-id',
        name: 'Private product',
        status: 'active',
        isPublished: false,
        publicationScope: 'tenant_private',
      }}
    />
  );
  expect(html).toContain('Private identity');
  expect(html).toContain('Sellable in your store now');
  expect(html).toContain('>Active<');
});

it('keeps the summary exactly as before when the central product has no scope field', () => {
  const html = renderToStaticMarkup(
    <SubProductDetailsSummary
      product={{
        id: 'legacy-id',
        name: 'Legacy product',
        status: 'active',
        isPublished: false,
      }}
    />
  );
  expect(html).not.toContain('Private identity');
});

it('starts duplication only on the button click', () => {
  const button = DuplicateSubProductButton({ sourceId: 'source-id' });
  expect(button.props.type).toBe('button');
  expect(takeDuplicateSource()).toBeNull();
  button.props.onClick();
  expect(push).toHaveBeenCalledWith('/sub-products/create');
  expect(takeDuplicateSource()).toBe('source-id');
  expect(takeDuplicateSource()).toBeNull();
});

it('shows cosmetic shade and net volume with its own price and availability', () => {
  const html = renderToStaticMarkup(
    <SubProductDetailsSummary
      showActions={false}
      product={{
        id: 'cosmetic-id',
        name: 'Foundation',
        type: 'beauty_makeup',
        sizes: [
          {
            id: 'shade-1',
            displayName: 'Bottle',
            colorName: 'Warm sand',
            volumeMl: 30,
            sellingPrice: 4000,
            salePrice: 3200,
            isOnSale: true,
            stock: 12,
            availability: 'pre_order',
          },
        ],
      }}
    />
  );
  expect(html).toContain('Shades &amp; pack sizes');
  expect(html).toContain('Warm sand');
  expect(html).toContain('30 ml');
  expect(html).toContain('3,200');
  expect(html).toContain('Pre-order');
  expect(html).not.toContain('In stock');
});

it('keeps a non-sale listing at the regular price and labels unknown inventory', () => {
  const html = renderToStaticMarkup(
    <SubProductDetailsSummary
      product={{
        id: 'listing-id',
        name: 'Listing',
        baseSellingPrice: 5000,
        salePrice: 3200,
        isOnSale: false,
      }}
    />
  );
  expect(html).toContain('5,000');
  expect(html).not.toContain('3,200');
  expect(html).toContain('Stock not recorded');
});
