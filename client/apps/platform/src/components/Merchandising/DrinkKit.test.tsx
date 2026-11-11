import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DrinkKit from './DrinkKit';
import type { KitCartLine } from './resolveDrinkKit';
import type { ProductType } from '@/types/product.types';

const mocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  search: vi.fn(),
  read: vi.fn(),
  cartState: { cartArray: [] as KitCartLine[] },
}));

vi.mock('@/context/CartContext', () => ({ useCart: () => mocks }));
vi.mock('@/context/ShoppingLocationContext', () => ({ useShoppingLocation: () => ({ location: null, revision: '' }) }));
vi.mock('@/lib/gtag', () => ({ gtagEvent: vi.fn() }));
vi.mock('./catalogue', () => ({ searchOffers: mocks.search, readOfferProduct: mocks.read }));

const bottle = (id: string, name: string, type: string, price: number): ProductType => ({
  id, slug: id, name, type, price,
  availableAt: [{
    _id: `listing-${id}`,
    tenant: { _id: 'seller', name: 'Seller', slug: 'seller' },
    sizes: [{ _id: `size-${id}`, size: '75cl', stock: 6, pricing: { websitePrice: price } }],
  }],
});

const gin = bottle('gin', 'Dry Gin', 'gin', 20_000);
const tonic = bottle('tonic', 'Tonic Water', 'mixer', 1_500);

function setCatalogue() {
  mocks.search.mockImplementation(async (params: URLSearchParams) => [params.getAll('type').includes('gin') || params.get('q') === 'gin' ? gin : tonic]);
  mocks.read.mockImplementation(async (slug: string) => slug === 'gin' ? gin : tonic);
}

async function chooseKit() {
  render(<DrinkKit />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a kit' }), { target: { value: 'Gin and tonic kit' } });
  await screen.findByRole('checkbox', { name: /Dry Gin/ });
}

afterEach(() => { cleanup(); vi.resetAllMocks(); mocks.cartState.cartArray = []; });

it('adds only the selected ingredient using its exact seller and size', async () => {
  setCatalogue();
  await chooseKit();
  fireEvent.click(screen.getByRole('checkbox', { name: /Dry Gin/ }));
  fireEvent.click(screen.getByRole('button', { name: /Add selected.*1,500/ }));
  await waitFor(() => expect(mocks.addToCart).toHaveBeenCalledTimes(1));
  expect(mocks.addToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'tonic' }),
    '75cl', '', 'Seller', 'seller', 1, 'size-tonic', 'listing-tonic', undefined);
});

it('adds neither ingredient when a selected price changes during revalidation', async () => {
  setCatalogue();
  await chooseKit();
  mocks.read.mockImplementation(async (slug: string) => slug === 'gin' ? gin : bottle('tonic', 'Tonic Water', 'mixer', 1700));
  fireEvent.click(screen.getByRole('button', { name: /Add selected/ }));
  await screen.findByText(/price or stock changed/);
  expect(mocks.addToCart).not.toHaveBeenCalled();
});

it('automatically offers taxonomy-matched tonic for Bombay Sapphire and skips cola with a misleading name', async () => {
  const bombay = bottle('bombay', 'Bombay Sapphire', 'spirit', 20_000);
  const cartGin = { ...bombay, category: { slug: 'gin', name: 'Gin', type: 'gin' }, selectedVendorId: 'seller' };
  const mixer = bottle('mixer', 'Indian Mixer', 'tonic_water', 1500);
  const cola = { ...bottle('cola', 'Tonic Cola', 'tonic_water', 100),
    subCategory: { slug: 'cola', name: 'Cola' } };
  mocks.cartState.cartArray = [cartGin];
  mocks.search.mockResolvedValue([cola, mixer]);
  mocks.read.mockImplementation(async slug => slug === 'mixer' ? mixer : cola);

  render(<DrinkKit />);
  await screen.findByText('Complete your gin and tonic');
  expect(screen.getByText('Bombay Sapphire · In your cart')).toBeTruthy();
  expect(screen.queryByText('Tonic Cola')).toBeNull();
  expect(mocks.search.mock.calls.some(([params]) => params.getAll('type').includes('tonic_water'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Add selected.*1,500/ }));
  await waitFor(() => expect(mocks.addToCart).toHaveBeenCalledTimes(1));
  expect(mocks.addToCart.mock.calls[0][0].id).toBe('mixer');
});

it('does not prompt when a tonic classified by subcategory is already in the cart', async () => {
  mocks.cartState.cartArray = [gin, { ...tonic, name: 'Indian Mixer', subCategory: 'Tonic Water' }];
  render(<DrinkKit />);
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveProperty('value', ''));
  expect(mocks.search).not.toHaveBeenCalled();
});

it('does not suggest a kit for a ready-to-drink gin and tonic', async () => {
  mocks.cartState.cartArray = [{ ...gin, name: 'Bombay Sapphire Gin & Tonic',
    type: 'cocktail_ready_to_drink', category: { slug: 'gin', name: 'Gin', type: 'gin' } }];
  render(<DrinkKit />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Build a drink kit' })).toBeTruthy());
  expect(mocks.search).not.toHaveBeenCalled();
});
