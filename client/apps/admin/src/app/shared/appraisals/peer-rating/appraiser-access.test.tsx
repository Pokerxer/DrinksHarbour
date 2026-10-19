// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import EmployeePage from './employee-page';
import MyCycles from './my-cycles';
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  fetchPeerReview: vi.fn(),
  fetchPeerResult: vi.fn(),
  fetchMyPeerCycles: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const base = {
  name: 'October',
  status: 'collecting' as const,
  submittedAt: null,
  revision: 0,
  isAppraiser: false,
  colleagues: [],
  ratings: [],
};
it('shows a results waiting view rather than a rating form to non-appraisers', async () => {
  vi.mocked(api.fetchPeerReview).mockResolvedValue(base);
  render(<EmployeePage id="cycle" />);
  await screen.findByRole('heading', { name: 'October' });
  expect(screen.queryByRole('button', { name: 'Submit ratings' })).toBeNull();
  expect(
    screen.queryByRole('heading', { name: 'Rate your colleagues' })
  ).toBeNull();
  expect(screen.getByText(/not selected to appraise/i)).toBeTruthy();
});
it('still releases a non-appraiser’s own score and bonus when closed', async () => {
  vi.mocked(api.fetchPeerReview).mockResolvedValue({
    ...base,
    status: 'closed',
  });
  vi.mocked(api.fetchPeerResult).mockResolvedValue({
    averageScore: 4,
    ratingCount: 2,
    allocationMinor: 5000000,
    bonusMinor: 4000000,
    currency: 'NGN',
  });
  render(<EmployeePage id="cycle" />);
  await screen.findByText('4.00 / 5');
  expect(api.fetchPeerResult).toHaveBeenCalledWith('cycle');
  expect(screen.queryByRole('button', { name: 'Submit ratings' })).toBeNull();
});
it('does not invite a non-appraiser to rate from their cycle list', async () => {
  vi.mocked(api.fetchMyPeerCycles).mockResolvedValue([
    {
      _id: 'cycle',
      name: 'October',
      status: 'collecting',
      submittedAt: null,
      isAppraiser: false,
    },
  ]);
  render(<MyCycles />);
  await screen.findByRole('link', { name: /October/ });
  expect(screen.queryByText('Rate colleagues →')).toBeNull();
  expect(screen.getByText('Awaiting your results')).toBeTruthy();
});
