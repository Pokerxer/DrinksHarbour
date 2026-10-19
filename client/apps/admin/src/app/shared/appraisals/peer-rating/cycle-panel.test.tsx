// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CyclePanel from './cycle-panel';
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  fetchPeerEmployees: vi.fn(),
  fetchPeerParticipants: vi.fn(),
  peerCycleAction: vi.fn(),
  replacePeerRoster: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('does not launch a saved roster when displayed allocations have changed', async () => {
  const employees = [
    { employee: 'a', displayName: 'Ada' },
    { employee: 'b', displayName: 'Ben' },
  ];
  vi.mocked(api.fetchPeerEmployees).mockResolvedValue(employees);
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'draft',
    total: 2,
    submitted: 0,
    participants: employees.map((p) => ({
      ...p,
      allocationMinor: 10000,
      submittedAt: null,
      unavailable: false,
    })),
  });
  render(
    <CyclePanel
      cycle={{
        _id: 'cycle',
        name: 'October',
        status: 'draft',
        mode: 'peer_rating',
        peerReviewEnabled: true,
      }}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Launch cycle' }));
  fireEvent.change(screen.getByLabelText('Ada bonus allocation (₦)'), {
    target: { value: '200' },
  });
  const confirm = screen.getByRole('button', {
    name: 'Confirm launch',
  }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.click(confirm);
  expect(api.peerCycleAction).not.toHaveBeenCalled();
});
it('refresh synchronizes a cycle closed by another HR session', async () => {
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'collecting',
    total: 2,
    submitted: 2,
    participants: [],
  });
  render(
    <CyclePanel
      cycle={{
        _id: 'cycle',
        name: 'October',
        status: 'collecting',
        mode: 'peer_rating',
        peerReviewEnabled: true,
      }}
    />
  );
  await screen.findByRole('button', { name: 'Close and calculate bonuses' });
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'closed',
    total: 2,
    submitted: 2,
    participants: [],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh progress' }));
  await screen.findByRole('status', { name: 'Cycle closed' });
  expect(
    screen.queryByRole('button', { name: 'Close and calculate bonuses' })
  ).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cancel cycle' })).toBeNull();
});
it('an older progress response cannot undo a newer closed state', async () => {
  const initial = {
    status: 'collecting' as const,
    total: 2,
    submitted: 2,
    participants: [],
  };
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue(initial);
  render(
    <CyclePanel
      cycle={{
        _id: 'cycle',
        name: 'October',
        status: 'collecting',
        mode: 'peer_rating',
        peerReviewEnabled: true,
      }}
    />
  );
  await screen.findByRole('button', { name: 'Refresh progress' });
  let oldResolve!: (value: api.PeerProgress) => void;
  let newResolve!: (value: api.PeerProgress) => void;
  vi.mocked(api.fetchPeerParticipants)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          oldResolve = r;
        })
    )
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          newResolve = r;
        })
    );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh progress' }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh progress' }));
  newResolve({ ...initial, status: 'closed' });
  await screen.findByRole('status', { name: 'Cycle closed' });
  oldResolve(initial);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(
    screen.queryByRole('button', { name: 'Close and calculate bonuses' })
  ).toBeNull();
});

it('closes after selected appraisers submit without waiting for subjects who do not appraise', async () => {
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'collecting',
    total: 3,
    appraiserTotal: 2,
    submitted: 2,
    participants: ['Ada', 'Ben', 'Chris'].map((displayName, i) => ({
      employee: String(i),
      displayName,
      isAppraiser: i < 2,
      allocationMinor: 10000,
      submittedAt: i < 2 ? '2026-10-19' : null,
      unavailable: false,
    })),
  });
  render(
    <CyclePanel
      cycle={{
        _id: 'cycle',
        name: 'October',
        status: 'collecting',
        mode: 'peer_rating',
        peerReviewEnabled: true,
      }}
    />
  );
  const close = await screen.findByRole('button', {
    name: 'Close and calculate bonuses',
  });
  expect((close as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText('2 of 2 appraisers submitted')).toBeTruthy();
  expect(screen.getByText('Not an appraiser')).toBeTruthy();
});
it('changing appraiser selection invalidates an open launch confirmation', async () => {
  const participants = ['Ada', 'Ben', 'Chris'].map((displayName, i) => ({
    employee: String(i),
    displayName,
    allocationMinor: 10000,
    submittedAt: null,
    unavailable: false,
  }));
  vi.mocked(api.fetchPeerEmployees).mockResolvedValue(participants);
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'draft',
    total: 3,
    submitted: 0,
    participants,
  });
  render(
    <CyclePanel
      cycle={{
        _id: 'cycle',
        name: 'October',
        status: 'draft',
        mode: 'peer_rating',
        peerReviewEnabled: true,
      }}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Launch cycle' }));
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Allow Chris to appraise' })
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Confirm launch',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});
