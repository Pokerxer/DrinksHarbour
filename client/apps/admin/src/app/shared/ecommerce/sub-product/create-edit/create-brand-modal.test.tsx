// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CreateBrandModal from './create-brand-modal';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('submits edited brand fields from the fixed footer and reports the created identity', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ data: { _id: 'created-brand' } }),
    });
  vi.stubGlobal('fetch', fetcher);
  const created = vi.fn();
  render(
    <CreateBrandModal
      isOpen
      onClose={vi.fn()}
      onBrandCreated={created}
      token="staff-token"
    />
  );
  fireEvent.change(screen.getByLabelText(/Brand Name/), {
    target: { value: 'Harbour Drinks' },
  });
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Local beverages' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create Brand' }));
  await waitFor(() => expect(created).toHaveBeenCalledWith('created-brand'));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    name: 'Harbour Drinks',
    slug: 'harbour-drinks',
    description: 'Local beverages',
  });
});
