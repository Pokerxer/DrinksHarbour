// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RequestQueue from './request-queue';
import type { RequestRow } from '@/services/venue/experience';
afterEach(cleanup);
it('keeps an ambiguous local-time amendment editable and explains the error', () => {
  const row: RequestRow = {
    id: 'one',
    reference: 'VR-one',
    status: 'pending',
    statusLabel: 'Awaiting venue confirmation',
    requestState: 'reviewed',
    version: 1,
    bookingAt: '2026-11-01T05:30:00Z',
    partySize: 2,
    guest: { name: 'Guest', phone: '+234123456789' },
    locationId: 'location',
    serviceSessionId: null,
    policy: {
      timezone: 'America/New_York',
      policies: 'Request only',
      venueName: 'Lounge',
      locationName: 'Main',
    },
  };
  const action = vi.fn();
  render(
    <RequestQueue
      rows={[row]}
      tables={[]}
      canManage
      canSeat={false}
      busy={false}
      onAction={action}
      onMore={() => {}}
      more={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Amend request' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save amendment' }));
  expect(screen.getByRole('alert').textContent).toMatch(/ambiguous|twice/i);
  expect(screen.getByRole('button', { name: 'Save amendment' })).toBeTruthy();
  expect(action).not.toHaveBeenCalled();
});
