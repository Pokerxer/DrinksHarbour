// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProductDetails from './product-details';

const { readAdmin, readPublic, session } = vi.hoisted(() => ({
  readAdmin: vi.fn(),
  readPublic: vi.fn(),
  session: { user: { role: 'admin', token: 'token' } },
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'product-id' }),
}));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: session }) }));
vi.mock('@/services/product.service', () => ({
  productService: {
    getAdminProductDetails: readAdmin,
    getProductById: readPublic,
  },
}));

const homeProduct = {
  _id: 'product-id',
  name: 'Oak table',
  type: 'home_furniture',
  isAlcoholic: true,
  specifications: { material: 'Solid oak' },
  subProducts: [
    {
      _id: 'tenant-listing',
      tenant: { name: 'Oak shop' },
      sku: 'OAK-1',
      status: 'active',
      baseSellingPrice: 150000,
      isPublished: false,
      sizes: [{ _id: 'size-1', displayName: 'Dining', stock: 4 }],
    },
  ],
};

beforeEach(() => {
  session.user.role = 'admin';
  readAdmin.mockReset().mockResolvedValue({ data: { product: homeProduct } });
  readPublic.mockReset().mockResolvedValue({ data: { product: homeProduct } });
});
afterEach(cleanup);

it('shows the recorded home specifications and keeps price and stock within their tenant listing', async () => {
  render(<ProductDetails />);
  await screen.findByRole('heading', { name: 'Oak table' });
  expect(readAdmin).toHaveBeenCalledWith(
    'product-id',
    'token',
    expect.any(AbortSignal)
  );
  expect(screen.getByText('Solid oak')).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'Sizes & finishes' })
  ).toBeTruthy();
  expect(screen.queryByText('Alcoholic')).toBeNull();
  const listing = within(screen.getByRole('row', { name: /Oak shop/ }));
  expect(listing.getByText('4')).toBeTruthy();
  expect(listing.getByText('Unpublished')).toBeTruthy();
  expect(listing.getByRole('link').getAttribute('href')).toBe(
    '/sub-products/tenant-listing'
  );
});

it('uses the public read and hides private listing actions for a tenant user', async () => {
  session.user.role = 'tenant_admin';
  render(<ProductDetails />);
  await screen.findByRole('heading', { name: 'Oak table' });
  expect(readPublic).toHaveBeenCalledWith(
    'product-id',
    'token',
    false,
    expect.any(AbortSignal)
  );
  expect(readAdmin).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'Edit product' })).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
});

it('quotes each tenant listing by its size price(s), falling back to base', async () => {
  readAdmin.mockResolvedValue({
    data: {
      product: {
        ...homeProduct,
        subProducts: [
          {
            _id: 'sized-listing',
            tenant: { name: 'Sized shop' },
            sku: 'SIZED-1',
            status: 'active',
            isPublished: true,
            baseSellingPrice: 100000,
            sizes: [
              { _id: 's1', size: '35cl', sellingPrice: 2500 },
              { _id: 's2', size: '75cl', sellingPrice: 5000 },
            ],
          },
          {
            _id: 'unit-listing',
            tenant: { name: 'Unit shop' },
            sku: 'UNIT-1',
            status: 'active',
            isPublished: true,
            baseSellingPrice: 750,
            sizes: [],
          },
        ],
      },
    },
  });
  render(<ProductDetails />);
  await screen.findByRole('heading', { name: 'Oak table' });

  const sizedRow = within(screen.getByRole('row', { name: /Sized shop/ }));
  // Priced sizes win over the base price and render as a min–max range.
  expect(sizedRow.getByText(/₦2,500\.00 – ₦5,000\.00/)).toBeTruthy();
  expect(sizedRow.queryByText(/100,000/)).toBeNull();

  const unitRow = within(screen.getByRole('row', { name: /Unit shop/ }));
  expect(unitRow.getByText('₦750.00')).toBeTruthy();
});

it('lets the administrator retry a failed read', async () => {
  readAdmin.mockRejectedValueOnce(new Error('Unable to load'));
  render(<ProductDetails />);
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByRole('heading', { name: 'Oak table' })
  ).toBeTruthy();
  expect(readAdmin).toHaveBeenCalledTimes(2);
});
