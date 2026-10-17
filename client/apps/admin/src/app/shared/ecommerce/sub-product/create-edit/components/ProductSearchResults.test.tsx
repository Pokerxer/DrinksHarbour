// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProductSearchResults from './ProductSearchResults';

afterEach(cleanup);
it('keeps explicit catalog selection and creation actions with readable matching identities', () => {
  const product = {
    _id: 'blue',
    name: 'Johnnie Walker Blue Label Ghost and Rare',
    status: 'pending',
    matchKind: 'close' as const,
    abv: 0,
  };
  const select = vi.fn();
  const create = vi.fn();
  render(
    <ProductSearchResults
      products={[product]}
      selectedIndex={0}
      highlightedText="blue"
      isLoading={false}
      searchQuery="blue"
      onSelect={select}
      onCreateNew={create}
    />
  );
  expect(screen.getByText('Closest match')).toBeDefined();
  expect(screen.getByText('Pending approval')).toBeDefined();
  expect(screen.getByText('0% ABV')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: `Use ${product.name}` }));
  expect(select).toHaveBeenCalledWith(product);
  fireEvent.click(screen.getByRole('button', { name: 'Create new product' }));
  expect(create).toHaveBeenCalledWith('blue');
});

it('does not offer product creation while a search is still loading', () => {
  render(
    <ProductSearchResults
      products={[]}
      selectedIndex={-1}
      highlightedText="monte"
      isLoading
      searchQuery="monte"
      onSelect={vi.fn()}
      onCreateNew={vi.fn()}
    />
  );
  expect(screen.getByRole('status').textContent).toContain(
    'Finding matching products'
  );
  expect(
    screen.queryByRole('button', { name: 'Create new product' })
  ).toBeNull();
});
