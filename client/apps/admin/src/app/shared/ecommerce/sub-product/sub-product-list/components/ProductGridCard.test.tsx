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
  it.each([
    ['active', 'Active'],
    ['archived', 'Archived'],
    ['discontinued', 'Discontinued'],
  ])(`shows the %s status in ${Card.name}`, (status, label) => {
    render(<Card product={{ ...product, status }} isSelected={false} onSelect={vi.fn()} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

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

  it(`prices ${Card.name} from the size rows, not the base price`, () => {
    const sized = render(
      <Card
        product={{
          ...product,
          baseSellingPrice: 10000000,
          sizes: [
            {
              _id: 'a',
              size: '35cl',
              sellingPrice: 3500,
              salePrice: 2500,
              isOnSale: true,
            },
            { _id: 'b', size: '75cl', sellingPrice: 5000 },
          ],
        }}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );
    const text = sized.container.textContent || '';
    expect(text).toContain('₦2,500 – ₦5,000');
    expect(text).not.toContain('10,000,000');

    const uniform = render(
      <Card
        product={{
          ...product,
          sizes: [
            { _id: 'a', size: '35cl', sellingPrice: 3000 },
            { _id: 'b', size: '75cl', sellingPrice: 3000 },
          ],
        }}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );
    expect(uniform.container.textContent).toContain('3,000');

    const unsized = render(
      <Card
        product={{ ...product, baseSellingPrice: 750, sizes: [] }}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );
    expect(unsized.container.textContent).toContain('750');
  });
}
