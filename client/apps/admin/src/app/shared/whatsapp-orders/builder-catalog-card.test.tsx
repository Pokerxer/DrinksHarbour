// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BuilderCatalogCard, {
  catalogThumb,
  rowStock,
  type BuilderCatalogRow,
} from './builder-catalog-card';

vi.mock('next/image', () => ({
  default: ({
    fill: _fill,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Lightweight test replacement for next/image.
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

afterEach(cleanup);

describe('catalogThumb', () => {
  it('inserts the sales-catalogue Cloudinary transform', () => {
    expect(
      catalogThumb('https://res.cloudinary.com/demo/image/upload/v42/bottle.jpg'),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fit,w_480,h_480,q_auto,f_auto/v42/bottle.jpg',
    );
  });

  it('passes through non-cloudinary and empty urls', () => {
    expect(catalogThumb('https://cdn.example.com/bottle.jpg')).toBe(
      'https://cdn.example.com/bottle.jpg',
    );
    expect(catalogThumb(undefined)).toBeUndefined();
  });
});

describe('rowStock', () => {
  const row = (sizes: BuilderCatalogRow['sizes']): BuilderCatalogRow =>
    ({ _id: 'sp1', sizes }) as BuilderCatalogRow;

  it('sums availableStock, falling back to stock only when nullish', () => {
    expect(
      rowStock(
        row([
          { _id: 's1', availableStock: 4, stock: 9 },
          { _id: 's2', availableStock: 0, stock: 7 },
          { _id: 's3', stock: 6 },
        ]),
      ),
    ).toBe(10);
  });

  it('is zero for missing or empty sizes', () => {
    expect(rowStock(row(undefined))).toBe(0);
    expect(rowStock(row([]))).toBe(0);
  });
});

describe('BuilderCatalogCard', () => {
  it('renders the product name, tenant and an enabled Add button', () => {
    const row: BuilderCatalogRow = {
      _id: 'sp1',
      sku: 'SKU-1',
      product: {
        _id: 'p1',
        name: 'Hennessy XO',
        isAlcoholic: true,
        abv: 40,
        brand: { name: 'Hennessy' },
        category: { name: 'spirits' },
      },
      tenant: { name: 'Harbour Wines' },
      sizes: [{ _id: 's1', displayName: '70cl', sellingPrice: 1000, availableStock: 5 }],
    };
    let added: BuilderCatalogRow | null = null;
    const { container } = render(
      <BuilderCatalogCard row={row} onAdd={(r) => { added = r; }} />,
    );
    expect(container.textContent).toContain('Hennessy XO');
    expect(container.textContent).toContain('Offered by Harbour Wines');
    expect(container.textContent).toContain('40% ABV · 18+');
    fireEvent.click(screen.getByRole('button', { name: /add to order/i }));
    expect(added).toBe(row);
  });

  it('disables Add when the product is missing', () => {
    const row: BuilderCatalogRow = {
      _id: 'sp2',
      product: null,
      sizes: [{ _id: 's1', availableStock: 5 }],
    };
    const onAdd = vi.fn();
    render(<BuilderCatalogCard row={row} onAdd={onAdd} />);
    const button = screen.getByRole('button', { name: /add to order/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
