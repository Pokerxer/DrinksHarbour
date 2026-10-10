// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import CreateKeyForm from './create-key-form';
afterEach(cleanup);
test('website preset updates permissions without submitting and creates a scoped key', async () => {
  const onCreate = vi.fn(async () => true);
  render(<CreateKeyForm busy={false} bookings={false} onCreate={onCreate} />);
  fireEvent.change(screen.getByLabelText('Integration name'), {
    target: { value: 'My website' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Stock sync' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tenant website' }));
  expect(onCreate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
  await waitFor(() =>
    expect(onCreate).toHaveBeenCalledWith({
      name: 'My website',
      scopes: ['storefront:read', 'checkout:write'],
      expiresInDays: 90,
    })
  );
});
test('catalogue preset grants no checkout writes and busy form prevents creation', () => {
  const onCreate = vi.fn(async () => true);
  const { rerender } = render(
    <CreateKeyForm busy={false} bookings={false} onCreate={onCreate} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Catalogue only' }));
  const checked = screen
    .getAllByRole('checkbox')
    .filter((input) => (input as HTMLInputElement).checked);
  expect(checked).toHaveLength(1);
  rerender(<CreateKeyForm busy={true} bookings={false} onCreate={onCreate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
  expect(onCreate).not.toHaveBeenCalled();
});
