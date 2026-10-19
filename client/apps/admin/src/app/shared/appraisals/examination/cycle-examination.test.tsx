// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import CyclePanel from '../peer-rating/cycle-panel';
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  fetchPeerParticipants: vi.fn(),
  fetchPeerEmployees: vi.fn(),
  replacePeerRoster: vi.fn(),
  peerCycleAction: vi.fn(),
}));
vi.mock('@/services/appraisal.service', () => ({
  fetchDepartmentOptions: vi.fn(async () => []),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const cycle = {
  _id: 'c',
  name: 'Monthly cycle',
  status: 'collecting' as const,
  mode: 'peer_rating' as const,
  peerReviewEnabled: true,
};
const exam = {
  attendanceMonth: '2020-01',
  departments: ['d'],
  questions: [{ prompt: 'Question', options: ['A', 'B'], correctOption: 0 }],
  assigned: 1,
  submitted: 0,
  monthComplete: true,
};
const participants: api.PeerParticipant[] = ['Ada', 'Ben'].map(
  (displayName, i) => ({
    employee: String(i),
    displayName,
    submittedAt: '2026-10-19',
    allocationMinor: 5000000,
    unavailable: false,
  })
);
it('cannot close until the assigned examination is complete even when appraisers are finished', async () => {
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'collecting',
    total: 2,
    appraiserTotal: 2,
    submitted: 2,
    participants,
    examination: exam,
  });
  render(<CyclePanel cycle={cycle} />);
  const close = await screen.findByRole('button', {
    name: 'Close and calculate bonuses',
  });
  expect((close as HTMLButtonElement).disabled).toBe(true);
  expect(
    screen.getByText('0 of 1 assigned employees submitted the examination.')
  ).toBeTruthy();
});
it('saving roster edits cannot clear unsaved examination changes from the launch guard', async () => {
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'draft',
    total: 2,
    submitted: 0,
    participants,
  });
  vi.mocked(api.fetchPeerEmployees).mockResolvedValue(participants);
  vi.mocked(api.replacePeerRoster).mockResolvedValue({ saved: 2, revision: 1 });
  render(<CyclePanel cycle={{ ...cycle, status: 'draft' }} />);
  fireEvent.click(
    await screen.findByRole('checkbox', {
      name: 'Include examination and attendance',
    })
  );
  fireEvent.change(screen.getByLabelText('Ada bonus allocation (₦)'), {
    target: { value: '40000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save roster' }));
  await screen.findByText('Roster saved');
  expect(
    (screen.getByRole('button', { name: 'Launch cycle' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
});
it('shows everyone’s final combined scores and component breakdowns in the owner table', async () => {
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'closed',
    total: 2,
    submitted: 2,
    examination: { ...exam, submitted: 1 },
    participants: participants.map((p, i) => ({
      ...p,
      result: {
        averageScore: 4,
        ratingCount: 1,
        bonusMinor: i ? 4500000 : 3833333,
        allocationMinor: 5000000,
        currency: 'NGN',
        composite: {
          appraisalScore: 80,
          attendanceScore: 100,
          combinedScore: i ? 90 : 76.67,
          attendanceMonth: '2020-01',
          ...(i ? {} : { examScore: 50 }),
        },
      },
    })),
  });
  render(<CyclePanel cycle={{ ...cycle, status: 'closed' }} />);
  const ada = within(await screen.findByRole('row', { name: /Ada/ }));
  const ben = within(screen.getByRole('row', { name: /Ben/ }));
  expect(ada.getByText('76.67 / 100')).toBeTruthy();
  expect(ada.getByText('Examination')).toBeTruthy();
  expect(ben.getByText('90.00 / 100')).toBeTruthy();
  expect(ben.queryByText('Examination')).toBeNull();
});
