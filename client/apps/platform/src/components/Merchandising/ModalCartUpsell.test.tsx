// client/apps/platform/src/components/Merchandising/ModalCartUpsell.test.tsx
// Task 12: the site-wide mini-cart (ModalCart) surfaces the phase-1 cart
// cross-sell strip while the cart has items, and quick-adding a suggestion
// keeps the modal open (the strip adds without navigating).
// Context mocks follow CartCrossSellStrip.test.tsx's pattern.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ModalCart from '@/components/Modal/ModalCart';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useCart } from '@/context/CartContext';
import { useMerchandising } from './useMerchandising';

vi.mock('./useMerchandising', () => ({
  cardPrice: (p: { price?: number }) => p.price ?? null,
  fireSponsoredClick: vi.fn(),
  useMerchandising: vi.fn(),
}));
vi.mock('@/context/CartContext', () => ({
  getEffectiveUnitPrice: (i: { price?: number }) => i.price ?? 0,
  getLineOriginPrice: () => null,
  useCart: vi.fn(),
}));
vi.mock('@/context/ModalCartContext', () => ({ useModalCartContext: vi.fn() }));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ isMainSite: true }),
}));
vi.mock('@/context/WishlistContext', () => ({
  useWishlist: () => ({ addToWishlist: vi.fn() }),
}));
vi.mock('@/context/ModalWishlistContext', () => ({
  useModalWishlistContext: () => ({ openModalWishlist: vi.fn() }),
}));
vi.mock('@/utils/product.utils', () => ({
  calculateDiscountPercentage: () => 0,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

// jsdom has no matchMedia; ModalCart keys its drawer animation off it.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const line = (id: string, price: number) => ({
  _id: id,
  name: `Item ${id}`,
  slug: id,
  cartItemId: `c-${id}`,
  price,
  quantity: 1,
  images: [],
});

// One cart double serves both readers: ModalCart (cartState.cartArray) and
// CartCrossSellStrip (cartState?.cartArray ?? cartArray fallback).
const mockCart = () => {
  const cart = {
    cartState: { cartArray: [line('p1', 2000)] },
    cartTotal: 2000,
    cartCount: 1,
    validationMap: {},
    validating: false,
    updateQuantity: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    validateCartItems: vi.fn(),
    applyValidationUpdates: vi.fn(),
    addToCart: vi.fn(),
  };
  (useCart as ReturnType<typeof vi.fn>).mockReturnValue(cart);
  return cart;
};

const mockOpenModal = (closeModalCart = vi.fn()) => {
  (useModalCartContext as ReturnType<typeof vi.fn>).mockReturnValue({
    isModalOpen: true,
    closeModalCart,
  });
  return { closeModalCart };
};

const merchWithCrossSells = () =>
  (useMerchandising as ReturnType<typeof vi.fn>).mockReturnValue({
    data: {
      productId: 'p1',
      context: 'cart',
      boughtTogether: [],
      crossSells: [{ _id: 'p2', name: 'Tonic', slug: 'tonic', price: 500 }],
      upSells: [],
    },
    loading: false,
  });

describe('ModalCart upsell strip', () => {
  it('renders the "goes well with" strip with a quick-add inside the open modal', () => {
    mockOpenModal();
    mockCart();
    merchWithCrossSells();

    render(<ModalCart />);

    expect(
      screen.getByRole('heading', { name: /goes well with what/i })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /quick add/i })).toBeTruthy();
  });

  it('keeps the modal open when a suggestion is quick-added', () => {
    const { closeModalCart } = mockOpenModal();
    const cart = mockCart();
    merchWithCrossSells();

    render(<ModalCart />);
    fireEvent.click(screen.getByRole('button', { name: /quick add/i }));

    expect(cart.addToCart).toHaveBeenCalledTimes(1);
    expect(cart.addToCart.mock.calls[0][0].name).toBe('Tonic');
    expect(closeModalCart).not.toHaveBeenCalled();
  });

  it('shows no strip for an empty cart', () => {
    mockOpenModal();
    const cart = mockCart();
    cart.cartState = { cartArray: [] };
    cart.cartCount = 0;
    cart.cartTotal = 0;
    merchWithCrossSells();

    render(<ModalCart />);

    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /goes well/i })).toBeNull();
  });
});
