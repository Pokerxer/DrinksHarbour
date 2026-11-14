// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { subproductService } from '@/services/subproduct.service';
import SubProductsTable from './table';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { token: 'test-token' } } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: null }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

it('offers the Archived filter when the current catalog is empty and keeps archives out of the total', async () => {
  const get = vi.spyOn(subproductService, 'getSubProducts').mockImplementation(
    async (_token, params) => ({
      success: true,
      data: {
        subProducts: params?.includeArchived ? [{
          _id: 'archived-only',
          sku: 'ARCHIVED',
          status: 'archived',
          product: { name: 'Archived bottle', type: 'wine' },
          totalStock: 5,
        }] : [],
      },
    }),
  );

  render(<SubProductsTable />);
  fireEvent.click(await screen.findByRole('button', { name: 'Archived', pressed: false }));
  expect(await screen.findByText('Archived bottle')).toBeTruthy();
  expect(screen.getByText('0 items available in your store')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /^Archived/, pressed: true }));
  await waitFor(() => expect(screen.queryByText('Archived bottle')).toBeNull());
  expect(await screen.findByRole('button', { name: 'Archived', pressed: false })).toBeTruthy();
  expect(get.mock.calls.map(([, params]) => params?.includeArchived)).toEqual([
    undefined, 'true', undefined,
  ]);
});
