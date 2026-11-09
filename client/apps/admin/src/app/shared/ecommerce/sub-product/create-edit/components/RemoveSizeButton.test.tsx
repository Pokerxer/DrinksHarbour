// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RemoveSizeButton from './RemoveSizeButton';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'tenant-token' } } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const eligibility = (allowed = true, reason = null) => ({
  ok: true,
  json: async () => ({
    success: true,
    data: { allowed, reason },
  }),
});

it('deletes a saved size in the database immediately and only then removes the row', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(eligibility(true))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetcher);
  const onRemove = vi.fn();
  render(
    <RemoveSizeButton
      productId="subproduct-1"
      sizeId="size-2"
      label="75cl"
      onRemove={onRemove}
    />
  );

  // Open the dialog — eligibility check fires.
  fireEvent.click(screen.getByRole('button', { name: 'Remove size 75cl' }));
  await waitFor(() =>
    expect(screen.getByText(/deleted immediately|database/i))
  );

  fireEvent.click(screen.getByRole('button', { name: 'Remove size' }));

  await waitFor(() => expect(onRemove).toHaveBeenCalled());
  const [deleteCall] = fetcher.mock.calls.slice(1);
  expect(deleteCall[0]).toBe(
    'http://localhost:5001/api/subproducts/subproduct-1/sizes/size-2'
  );
  expect(deleteCall[1].method).toBe('DELETE');
  expect(deleteCall[1].headers.Authorization).toBe('Bearer tenant-token');
});

it('keeps the row and shows the server reason when the database delete is rejected', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(eligibility(true))
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        message: 'Cannot delete 75cl: This size has history or is still used in Order.',
      }),
    });
  vi.stubGlobal('fetch', fetcher);
  const onRemove = vi.fn();
  render(
    <RemoveSizeButton
      productId="subproduct-1"
      sizeId="size-2"
      label="75cl"
      onRemove={onRemove}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Remove size 75cl' }));
  await waitFor(() => expect(screen.getByText(/deleted immediately|database/i)));

  fireEvent.click(screen.getByRole('button', { name: 'Remove size' }));

  await waitFor(() =>
    expect(screen.getByText(/still used in Order/))
  );
  expect(onRemove).not.toHaveBeenCalled();
});

it('removes an unsaved row locally without hitting the database', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const onRemove = vi.fn();
  render(
    <RemoveSizeButton productId="subproduct-1" sizeId="" label="75cl" onRemove={onRemove} />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Remove size 75cl' }));
  await waitFor(() => expect(screen.getByText(/database/i)));
  fireEvent.click(screen.getByRole('button', { name: 'Remove size' }));

  await waitFor(() => expect(onRemove).toHaveBeenCalled());
  expect(fetcher).not.toHaveBeenCalled();
});
