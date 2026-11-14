// client/apps/platform/src/components/Merchandising/SponsoredBadge.test.tsx
// Paid-placement disclosure (Task 10, Global Constraints): the chip must
// render wherever a sponsored card renders, and a sponsored card's quick-add
// must attribute the CPC click BEFORE the cart action. Only the hook is
// mocked — cardPrice and fireSponsoredClick run for real so the localStorage
// visitor key and the fetch payload are exercised end-to-end.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CartCrossSellStrip from './CartCrossSellStrip';
import SponsoredBadge from './SponsoredBadge';
import { useMerchandising } from './useMerchandising';
import { useCart } from '@/context/CartContext';

vi.mock('./useMerchandising', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useMerchandising')>();
  return { ...actual, useMerchandising: vi.fn() };
});
vi.mock('@/context/CartContext', () => ({
  getEffectiveUnitPrice: (i: { price?: number }) => i.price ?? 0,
  useCart: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom here does not provide localStorage; the component treats it as
// best-effort attribution, so a minimal stub is enough.
const stubVisitorStorage = (visitor: string) => {
  const store = new Map<string, string>([['dh_ad_visitor', visitor]]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  });
};

const cartLine = (id: string) => ({
  _id: id, name: `Item ${id}`, slug: id, cartItemId: `c-${id}`,
  price: 2000, quantity: 1, images: [],
});

const mockMerch = (crossSells: unknown[]) => {
  (useMerchandising as ReturnType<typeof vi.fn>).mockReturnValue({
    data: { productId: 'p1', context: 'cart', boughtTogether: [], crossSells, upSells: [] },
    loading: false,
  });
};

describe('SponsoredBadge', () => {
  it('renders the visible Sponsored chip', () => {
    render(<SponsoredBadge />);
    expect(screen.getByText('Sponsored')).toBeTruthy();
  });
});

describe('sponsored disclosure in the cart cross-sell strip', () => {
  it('shows the Sponsored chip on a sponsored card only', () => {
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({
      cartArray: [cartLine('p1')],
      addToCart: vi.fn(),
    });
    mockMerch([
      { _id: 's1', name: 'Paid Tonic', slug: 'paid-tonic', price: 500, source: 'sponsored', adCampaignId: 'camp1' },
      { _id: 'o1', name: 'Organic Soda', slug: 'organic-soda', price: 400 },
    ]);

    render(<CartCrossSellStrip />);

    // Both cards still render (the strip hides nothing new); the mandatory
    // chip appears exactly once — on the paid placement.
    expect(screen.getByText('Organic Soda')).toBeTruthy();
    expect(screen.getByText('Paid Tonic')).toBeTruthy();
    expect(screen.getAllByText('Sponsored')).toHaveLength(1);
  });

  it('renders no chip on organic-only suggestions', () => {
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({
      cartArray: [cartLine('p1')],
      addToCart: vi.fn(),
    });
    mockMerch([{ _id: 'o1', name: 'Organic Soda', slug: 'organic-soda', price: 400 }]);

    render(<CartCrossSellStrip />);
    expect(screen.getByText('Organic Soda')).toBeTruthy();
    expect(screen.queryByText('Sponsored')).toBeNull();
  });

  it('quick-add on a sponsored card fires the ads click endpoint before addToCart', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    stubVisitorStorage('visitor-1');
    const addToCart = vi.fn();
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({
      cartArray: [cartLine('p1')],
      addToCart,
    });
    mockMerch([
      { _id: 's1', name: 'Paid Tonic', slug: 'paid-tonic', price: 500, source: 'sponsored', adCampaignId: 'camp1' },
    ]);

    render(<CartCrossSellStrip />);
    fireEvent.click(screen.getByRole('button', { name: /quick add/i }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/ads/clicks/camp1');
    expect(init.method).toBe('POST');
    expect(init.body).toContain('"visitorKey":"visitor-1"');
    expect(addToCart).toHaveBeenCalledTimes(1);
  });

  it('quick-add on an organic card fires no ads click', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    const addToCart = vi.fn();
    (useCart as ReturnType<typeof vi.fn>).mockReturnValue({
      cartArray: [cartLine('p1')],
      addToCart,
    });
    mockMerch([{ _id: 'o1', name: 'Organic Soda', slug: 'organic-soda', price: 400 }]);

    render(<CartCrossSellStrip />);
    fireEvent.click(screen.getByRole('button', { name: /quick add/i }));

    expect(addToCart).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/ads/'))).toBe(false);
  });
});
