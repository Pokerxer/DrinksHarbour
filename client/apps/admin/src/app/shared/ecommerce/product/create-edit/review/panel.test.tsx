// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProductSubProductsPanel from '../product-subproducts';
import { subproductService } from '@/services/subproduct.service';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/services/subproduct.service', () => ({
  subproductService: {
    getSubProductsByProduct: vi.fn(),
    getSubProduct: vi.fn(),
    adminSetSubProductStatus: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('opens the real review from the listing panel and preserves it when the status write fails', async () => {
  const sp = {
    _id: 'sp',
    status: 'pending',
    sku: 'SKU',
    createdAt: '2026-10-17',
    tenant: { name: 'Shop A' },
    product: { name: 'Drink' },
    baseSellingPrice: 2000,
    pricing: {
      costPrice: 1000,
      platformCostPrice: 1250,
      platformSellingPrice: 1500,
      platformMarkupPct: 15,
    },
  };
  vi.mocked(subproductService.getSubProductsByProduct).mockResolvedValue({
    data: { subProducts: [sp] },
  });
  vi.mocked(subproductService.getSubProduct).mockResolvedValue({
    data: { subProduct: sp },
  });
  vi.mocked(subproductService.adminSetSubProductStatus)
    .mockRejectedValueOnce(new Error('Pricing changed; reload the listing'))
    .mockResolvedValueOnce({});
  render(<ProductSubProductsPanel productId="p" />);
  fireEvent.click(await screen.findByRole('button', { name: /Review/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Review Sub-Product' });
  await within(dialog).findByText('Base listing');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Approve listing' }));
  await screen.findByText('Pricing changed; reload the listing');
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Approve listing' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(subproductService.adminSetSubProductStatus).toHaveBeenLastCalledWith(
    'sp',
    'active',
    'token',
    {}
  );
});
