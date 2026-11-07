import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import VenuesDirectory from './VenuesDirectory';

vi.mock('@/lib/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('shows the proposed visit in the browser local timezone rather than UTC', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 11, 1, 12, 0, 0));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ _id: 'one', name: 'Main lounge', slug: 'main', city: 'Abuja' }] }))));
  render(<VenuesDirectory />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  fireEvent.click(screen.getByRole('button', { name: 'Request a table' }));
  expect((screen.getByLabelText('Date and time') as HTMLInputElement).value).toBe('2026-12-01T14:00');
});
