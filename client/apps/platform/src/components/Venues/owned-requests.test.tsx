import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import OwnedRequests from './owned-requests';
const { api, auth } = vi.hoisted(() => ({ api: vi.fn(), auth: { user: { _id: 'customer', email: 'customer@example.test' }, isAuthenticated: true, isLoading: false } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/venue/client', () => ({ privateVenue: api, venueKey: async () => 'key' }));
vi.mock('./booking-deposit', () => ({ default: () => null }));
afterEach(() => { cleanup(); api.mockReset(); auth.isAuthenticated = true; });
it('offers sign-in instead of leaving signed-out customers on an endless loader', () => {
  auth.isAuthenticated = false;
  render(<OwnedRequests reference="VR-one" />);
  expect(screen.getByRole('link', { name: 'Sign in to view reservations' }).getAttribute('href')).toContain('redirect=%2Fmy-account%2Freservations%2FVR-one');
  expect(screen.queryByText('Loading your reservations…')).toBeNull();
});
it('prevents duplicate pagination while the next reservation page is loading', async () => {
  api.mockResolvedValueOnce({ items: [], next: 'cursor+/=' }).mockImplementationOnce(() => new Promise(() => {}));
  render(<OwnedRequests />);
  const more = await screen.findByRole('button', { name: 'More reservations' });
  fireEvent.click(more);
  expect(screen.getByRole('button', { name: 'Loading more reservations…' })).toHaveProperty('disabled', true);
  fireEvent.click(more);
  expect(api).toHaveBeenCalledTimes(2);
  expect(api.mock.calls[1][0]).toBe('/me/requests?after=cursor%2B%2F%3D');
});
