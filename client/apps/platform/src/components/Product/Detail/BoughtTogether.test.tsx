// client/apps/platform/src/components/Product/Detail/BoughtTogether.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BoughtTogether, { sumBundlePrice } from './BoughtTogether';
import { useMerchandising } from '@/components/Merchandising/useMerchandising';
import { useCart } from '@/context/CartContext';
import type { ProductType } from '@/types/product.types';

vi.mock('@/components/Merchandising/useMerchandising', () => ({
  cardPrice: (p: { price?: number; priceRange?: { min: number } }) =>
    p.price ?? p.priceRange?.min ?? null,
  fireSponsoredClick: vi.fn(),
  useMerchandising: vi.fn(),
}));
vi.mock('@/context/CartContext', () => ({ useCart: vi.fn() }));

const product = { _id: 'p1', name: 'Base Bottle', slug: 'base-bottle', images: [] } as unknown as ProductType;

// The shop config runs without `globals: true`, so RTL auto-cleanup never
// fires — clean up explicitly (same pattern as DrinkKit.test.tsx).
afterEach(cleanup);

describe('sumBundlePrice', () => {
  it('sums base price with selected complements', () => {
    const selected = [
      { _id: 'a', name: 'A', slug: 'a', price: 500 },
      { _id: 'b', name: 'B', slug: 'b', priceRange: { min: 1000, max: 1200 } },
    ];
    expect(sumBundlePrice(2000, selected)).toBe(3500);
  });
  it('returns null when any price is unknown', () => {
    expect(sumBundlePrice(2000, [{ _id: 'x', name: 'X', slug: 'x', price: undefined }])).toBeNull();
  });
});

describe('BoughtTogether', () => {
  it('renders the bundle with the base product always included', () => {
    (useMerchandising as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        productId: 'p1',
        context: 'pdp',
        boughtTogether: [
          { _id: 'c1', name: 'Tonic', slug: 'tonic', price: 500 },
          { _id: 'c2', name: 'Glass', slug: 'glass', price: 1500 },
        ],
        crossSells: [],
        upSells: [],
      },
      loading: false,
    });
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({ addToCart: vi.fn() });

    render(<BoughtTogether product={product} />);
    expect(screen.getByText('Base Bottle')).toBeTruthy();
    expect(screen.getByText('Tonic')).toBeTruthy();
    expect(screen.getByText('Glass')).toBeTruthy();
  });

  it('adds selected items through the cart', () => {
    (useMerchandising as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        productId: 'p1',
        context: 'pdp',
        boughtTogether: [{ _id: 'c1', name: 'Tonic', slug: 'tonic', price: 500 }],
        crossSells: [],
        upSells: [],
      },
      loading: false,
    });
    const addToCart = vi.fn();
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({ addToCart });

    render(<BoughtTogether product={product} />);
    fireEvent.click(screen.getByRole('button', { name: /add selected/i }));

    const names = addToCart.mock.calls.map((c) => c[0].name);
    expect(names).toContain('Base Bottle');
    expect(names).toContain('Tonic');
  });

  it('renders null when fewer than 2 bundle items exist', () => {
    (useMerchandising as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { productId: 'p1', context: 'pdp', boughtTogether: [], crossSells: [], upSells: [] },
      loading: false,
    });
    const { container } = render(<BoughtTogether product={product} />);
    expect(container.innerHTML).toBe('');
  });
});
