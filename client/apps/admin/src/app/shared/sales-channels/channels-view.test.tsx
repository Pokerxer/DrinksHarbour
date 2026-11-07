// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ChannelsView from './channels-view';
const state = vi.hoisted(() => ({ role: 'tenant_owner', request: vi.fn() }));
vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({ role: state.role, user: { token: 'token' } }),
}));
vi.mock('@/services/market-foundation.service', () => ({
  foundationRequest: state.request,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.role = 'tenant_owner';
});
test('merchant can read its own reviewed channels but cannot configure ownership', async () => {
  state.request.mockResolvedValue({ channels: [] });
  render(<ChannelsView />);
  await screen.findByText('No configured channels.');
  expect(screen.queryByRole('button', { name: 'Save channel' })).toBeNull();
});
test('staff cannot load channel account configuration', () => {
  state.role = 'tenant_staff';
  render(<ChannelsView />);
  expect(screen.getByRole('alert').textContent).toMatch(/manager.*required/i);
  expect(state.request).not.toHaveBeenCalled();
});
