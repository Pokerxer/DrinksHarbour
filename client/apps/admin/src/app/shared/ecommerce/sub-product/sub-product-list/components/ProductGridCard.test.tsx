// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ProductGridCard, { ProductGridCardCompact } from './ProductGridCard';
import type { SubProductListItem } from '../filtering';
afterEach(cleanup);
const product = {
  _id: 'one',
  product: { name: 'Beverage', type: 'wine' },
  currency: 'NGN',
  totalStock: 12,
  lowStockThreshold: 15,
} as SubProductListItem;
for (const Card of [ProductGridCard, ProductGridCardCompact]) {
  it(`keeps card selection and edit actions separate in ${Card.name}`, () => {
    const select = vi.fn();
    const { container } = render(
      <Card product={product} isSelected={false} onSelect={select} />
    );
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(select).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('link', { name: 'Edit Beverage' }));
    expect(select).toHaveBeenCalledTimes(1);
  });
}
