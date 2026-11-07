// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
  act,
} from '@testing-library/react';
import ParticipantTable from './participant-table';
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  fetchPeerEmployeeScores: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const person = {
  employee: 'ada',
  displayName: 'Ada',
  allocationMinor: 5000000,
  submittedAt: null,
  unavailable: false,
};
const detail = {
  employee: 'ada',
  displayName: 'Ada',
  cycleStatus: 'collecting' as const,
  final: false,
  allocationMinor: 5000000,
  weights: { appraisal: 40, exam: 40, attendance: 20 },
  appraisal: {
    score: 80,
    averageScore: 4,
    received: 2,
    eligible: 2,
    status: 'complete' as const,
  },
  exam: {
    score: 90,
    earnedMarks: 18,
    maxMarks: 20,
    status: 'submitted' as const,
  },
  attendance: {
    score: 100,
    status: 'complete' as const,
    attendanceFrom: '2020-01-01',
    attendanceTo: '2020-01-31',
  },
  combined: { score: 88, bonusMinor: 4400000 },
};
it('opens an employee breakdown from the name with weighted component points', async () => {
  vi.mocked(api.fetchPeerEmployeeScores).mockResolvedValue(detail);
  render(
    <ParticipantTable cycleId="cycle" participants={[person]} closed={false} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'View scores for Ada' }));
  const dialog = await screen.findByRole('dialog', { name: 'Ada’s scores' });
  await within(dialog).findByText('90.00 / 100');
  for (const text of [
    '80.00 / 100',
    '100.00 / 100',
    '20% of total',
    '20.00 weighted points',
    '88.00 / 100',
  ])
    expect(within(dialog).getByText(text)).toBeTruthy();
  expect(api.fetchPeerEmployeeScores).toHaveBeenCalledWith('cycle', 'ada');
});
it('distinguishes unrated attendance from an actual zero exam score', async () => {
  vi.mocked(api.fetchPeerEmployeeScores).mockResolvedValue({
    ...detail,
    exam: { ...detail.exam, score: 0, earnedMarks: 0 },
    attendance: { ...detail.attendance, score: null, status: 'unrated' },
    combined: null,
  });
  render(
    <ParticipantTable cycleId="cycle" participants={[person]} closed={false} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'View scores for Ada' }));
  const dialog = await screen.findByRole('dialog', { name: 'Ada’s scores' });
  await within(dialog).findByText('0.00 / 100');
  expect(within(dialog).getByText('No rated attendance')).toBeTruthy();
  expect(
    within(dialog).getByText(/Combined score is available when/)
  ).toBeTruthy();
});
it('retries a failed load without closing the employee dialog', async () => {
  vi.mocked(api.fetchPeerEmployeeScores)
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce(detail);
  render(
    <ParticipantTable cycleId="cycle" participants={[person]} closed={false} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'View scores for Ada' }));
  await screen.findByText('Connection lost');
  fireEvent.click(screen.getByRole('button', { name: 'Retry scores' }));
  await screen.findByText('90.00 / 100');
});

it('ignores a late response after another employee is opened', async () => {
  let resolveAda!: (data: typeof detail) => void;
  vi.mocked(api.fetchPeerEmployeeScores)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAda = resolve;
        })
    )
    .mockResolvedValueOnce({ ...detail, employee: 'ben', displayName: 'Ben' });
  render(
    <ParticipantTable
      cycleId="cycle"
      participants={[
        person,
        { ...person, employee: 'ben', displayName: 'Ben' },
      ]}
      closed={false}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'View scores for Ada' }));
  await screen.findByRole('dialog', { name: 'Ada’s scores' });
  fireEvent.click(screen.getByRole('button', { name: 'Close scores' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'View scores for Ben' }));
  await screen.findByRole('dialog', { name: 'Ben’s scores' });
  await screen.findByText('90.00 / 100');
  await act(async () => resolveAda(detail));
  expect(screen.getByRole('dialog', { name: 'Ben’s scores' })).toBeTruthy();
  expect(screen.queryByRole('dialog', { name: 'Ada’s scores' })).toBeNull();
});
