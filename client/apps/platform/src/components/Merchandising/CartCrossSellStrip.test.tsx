// client/apps/platform/src/components/Merchandising/CartCrossSellStrip.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CartCrossSellStrip, { pickPrimaryLine, excludable } from './CartCrossSellStrip';
import { useMerchandising } from './useMerchandising';
import { useCart, getEffectiveUnitPrice } from '@/context/CartContext';

vi.mock('./useMerchandising', () => ({
  cardPrice: (p: { price?: number }) => p.price ?? null,
  fireSponsoredClick: vi.fn(),
  useMerchandising: vi.fn(),
}));
vi.mock('@/context/CartContext', () => ({
  getEffectiveUnitPrice: (i: { price?: number }) => i.price ?? 0,
  useCart: vi.fn(),
}));

const line = (id: string, price: number, quantity = 1) => ({
  _id: id, name: `Item ${id}`, slug: id, cartItemId: `c-${id}`,
  price, quantity, images: [],
});

describe('pickPrimaryLine', () => {
  it('picks the line with the highest line value', () => {
    const items = [line('a', 1000, 2), line('b', 9000, 1), line('c', 500, 10)];
    expect(pickPrimaryLine(items as never[])).toBe(items[1]);
  });
  it('falls back to the first line on ties', () => {
    const items = [line('a', 1000), line('b', 1000)];
    expect(pickPrimaryLine(items as never[])).toBe(items[0]);
  });
  it('handles an empty cart', () => {
    expect(pickPrimaryLine([])).toBeUndefined();
  });
});

describe('excludable', () => {
  it('drops products already in the cart', () => {
    expect(excludable(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });
});

describe('CartCrossSellStrip', () => {
  it('renders complements not already in the cart with quick-add', () => {
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({
      cartArray: [line('p1', 2000)],
      addToCart: vi.fn(),
    });
    (useMerchandising as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        productId: 'p1', context: 'cart',
        boughtTogether: [],
        crossSells: [
          { _id: 'p1', name: 'Already In Cart', slug: 'p1', price: 100 },
          { _id: 'p2', name: 'Tonic', slug: 'p2', price: 500 },
        ],
        upSells: [],
      },
      loading: false,
    });

    render(<CartCrossSellStrip />);
    expect(screen.getByText('Tonic')).toBeTruthy();
    expect(screen.queryByText('Already In Cart')).toBeNull();
  });

  it('renders null for an empty cart or empty cross-sells', () => {
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({ cartArray: [], addToCart: vi.fn() });
    (useMerchandising as ReturnType<typeof vi.fn>).mockReturnValue({ data: null, loading: false });
    const { container } = render(<CartCrossSellStrip />);
    expect(container.innerHTML).toBe('');
  });
});
