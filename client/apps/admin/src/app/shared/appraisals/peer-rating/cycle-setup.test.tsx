// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CycleSetup from './cycle-setup';
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  replacePeerRoster: vi.fn(),
  fetchPeerParticipants: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('saves selected colleagues and validates bonus amounts without a template', async () => {
  vi.mocked(api.replacePeerRoster).mockResolvedValue({ saved: 2, revision: 1 });
  const onSaved = vi.fn();
  render(
    <CycleSetup
      cycleId="cycle"
      employees={[
        { employee: 'a', displayName: 'Ada' },
        { employee: 'b', displayName: 'Ben' },
      ]}
      participants={[]}
      onSaved={onSaved}
    />
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Ada' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Ben' }));
  fireEvent.change(screen.getByLabelText('Ada bonus allocation (₦)'), {
    target: { value: '50000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster saved');
  expect(api.replacePeerRoster).toHaveBeenCalledWith(
    'cycle',
    [
      { employee: 'a', bonusAmount: 50000, isAppraiser: true },
      { employee: 'b', bonusAmount: 0, isAppraiser: true },
    ],
    0
  );
});
it('blocks invalid and overprecision allocations', () => {
  render(
    <CycleSetup
      cycleId="cycle"
      employees={[
        { employee: 'a', displayName: 'Ada' },
        { employee: 'b', displayName: 'Ben' },
      ]}
      participants={[]}
      onSaved={() => {}}
    />
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Ada' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Ben' }));
  const save = screen.getByRole('button', {
    name: 'Save roster',
  }) as HTMLButtonElement;
  for (const value of ['-1', '1.001', '']) {
    fireEvent.change(screen.getByLabelText('Ada bonus allocation (₦)'), {
      target: { value },
    });
    expect(save.disabled).toBe(true);
  }
});
it('keeps unavailable draft participants visible so HR can remove them', async () => {
  vi.mocked(api.replacePeerRoster).mockResolvedValue({ saved: 2, revision: 1 });
  render(
    <CycleSetup
      cycleId="cycle"
      employees={[
        { employee: 'a', displayName: 'Ada' },
        { employee: 'b', displayName: 'Ben' },
      ]}
      participants={[
        {
          employee: 'a',
          displayName: 'Ada',
          allocationMinor: 10000,
          submittedAt: null,
          unavailable: false,
        },
        {
          employee: 'b',
          displayName: 'Ben',
          allocationMinor: 10000,
          submittedAt: null,
          unavailable: false,
        },
        {
          employee: 'c',
          displayName: 'Chris',
          allocationMinor: 10000,
          submittedAt: null,
          unavailable: true,
        },
      ]}
      onSaved={() => {}}
    />
  );
  const remove = screen.getByRole('checkbox', { name: 'Include Chris' });
  expect(
    (screen.getByRole('button', { name: 'Save roster' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  fireEvent.click(remove);
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster saved');
  expect(api.replacePeerRoster).toHaveBeenLastCalledWith(
    'cycle',
    [
      { employee: 'a', bonusAmount: 100, isAppraiser: true },
      { employee: 'b', bonusAmount: 100, isAppraiser: true },
    ],
    0
  );
});
it('saves against the revision the HR form was opened with', async () => {
  vi.mocked(api.replacePeerRoster).mockResolvedValue({ saved: 2, revision: 8 });
  render(
    <CycleSetup
      cycleId="cycle"
      rosterRevision={7}
      employees={[
        { employee: 'a', displayName: 'Ada' },
        { employee: 'b', displayName: 'Ben' },
      ]}
      participants={[
        {
          employee: 'a',
          displayName: 'Ada',
          allocationMinor: 10000,
          submittedAt: null,
          unavailable: false,
        },
        {
          employee: 'b',
          displayName: 'Ben',
          allocationMinor: 10000,
          submittedAt: null,
          unavailable: false,
        },
      ]}
      onSaved={() => {}}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster saved');
  expect(api.replacePeerRoster).toHaveBeenLastCalledWith(
    'cycle',
    [
      { employee: 'a', bonusAmount: 100, isAppraiser: true },
      { employee: 'b', bonusAmount: 100, isAppraiser: true },
    ],
    7
  );
});
it('retains stale edits until HR explicitly discards them and reloads', async () => {
  vi.mocked(api.replacePeerRoster).mockRejectedValue(
    new Error('Roster changed in another session.')
  );
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'draft',
    revision: 8,
    total: 2,
    submitted: 0,
    participants: [
      {
        employee: 'a',
        displayName: 'Ada',
        allocationMinor: 50000,
        submittedAt: null,
        unavailable: false,
      },
      {
        employee: 'b',
        displayName: 'Ben',
        allocationMinor: 10000,
        submittedAt: null,
        unavailable: false,
      },
    ],
  });
  render(
    <CycleSetup
      cycleId="cycle"
      rosterRevision={7}
      employees={[
        { employee: 'a', displayName: 'Ada' },
        { employee: 'b', displayName: 'Ben' },
      ]}
      participants={[
        {
          employee: 'a',
          displayName: 'Ada',
          allocationMinor: 10000,
          submittedAt: null,
          unavailable: false,
        },
        {
          employee: 'b',
          displayName: 'Ben',
          allocationMinor: 10000,
          submittedAt: null,
          unavailable: false,
        },
      ]}
      onSaved={() => {}}
    />
  );
  const amount = screen.getByLabelText(
    'Ada bonus allocation (₦)'
  ) as HTMLInputElement;
  fireEvent.change(amount, { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster changed in another session.');
  expect(amount.value).toBe('200');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved roster' }));
  expect(api.fetchPeerParticipants).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Discard edits and reload' })
  );
  await screen.findByText('Saved roster reloaded');
  expect(amount.value).toBe('500');
});

it('saves appraiser choices with allocations and requires two selected appraisers', async () => {
  vi.mocked(api.replacePeerRoster).mockResolvedValue({ saved: 3, revision: 2 });
  render(
    <CycleSetup
      cycleId="cycle"
      rosterRevision={1}
      employees={['Ada', 'Ben', 'Chris'].map((displayName, i) => ({
        employee: String(i),
        displayName,
      }))}
      participants={['Ada', 'Ben', 'Chris'].map((displayName, i) => ({
        employee: String(i),
        displayName,
        allocationMinor: 10000,
        submittedAt: null,
        unavailable: false,
        isAppraiser: true,
      }))}
      onSaved={() => {}}
    />
  );
  const save = screen.getByRole('button', {
    name: 'Save roster',
  }) as HTMLButtonElement;
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Allow Chris to appraise' })
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Allow Ben to appraise' })
  );
  expect(save.disabled).toBe(true);
  expect(screen.getByText(/at least two appraisers/i)).toBeTruthy();
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Allow Ben to appraise' })
  );
  fireEvent.click(save);
  await screen.findByText('Roster saved');
  expect(api.replacePeerRoster).toHaveBeenCalledWith(
    'cycle',
    [
      { employee: '0', bonusAmount: 100, isAppraiser: true },
      { employee: '1', bonusAmount: 100, isAppraiser: true },
      { employee: '2', bonusAmount: 100, isAppraiser: false },
    ],
    1
  );
});
it('reloads saved appraiser permissions only after explicitly discarding stale edits', async () => {
  const participants = ['Ada', 'Ben', 'Chris'].map((displayName, i) => ({
    employee: String(i),
    displayName,
    allocationMinor: 10000,
    submittedAt: null,
    unavailable: false,
    isAppraiser: true,
  }));
  vi.mocked(api.replacePeerRoster).mockRejectedValue(
    new Error('Roster changed in another session.')
  );
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'draft',
    revision: 2,
    total: 3,
    submitted: 0,
    participants: participants.map((p, i) => ({ ...p, isAppraiser: i < 2 })),
  });
  render(
    <CycleSetup
      cycleId="cycle"
      rosterRevision={1}
      employees={participants}
      participants={participants}
      onSaved={() => {}}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster changed in another session.');
  const chris = screen.getByRole('checkbox', {
    name: 'Allow Chris to appraise',
  }) as HTMLInputElement;
  expect(chris.checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved roster' }));
  expect(chris.checked).toBe(true);
  fireEvent.click(
    screen.getByRole('button', { name: 'Discard edits and reload' })
  );
  await screen.findByText('Saved roster reloaded');
  expect(chris.checked).toBe(false);
});
