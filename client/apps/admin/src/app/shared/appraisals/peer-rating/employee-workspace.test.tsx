// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import ReviewForm from './review-form';
import EmployeePage from './employee-page';
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  fetchPeerReview: vi.fn(),
  fetchPeerResult: vi.fn(),
  savePeerRatings: vi.fn(),
  submitPeerRatings: vi.fn(),
}));
const review = {
  name: 'October review',
  status: 'collecting' as const,
  submittedAt: null,
  revision: 0,
  colleagues: [
    { employee: 'a', displayName: 'Ada' },
    { employee: 'b', displayName: 'Ben' },
  ],
  ratings: [],
};
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('filters unrated colleagues without losing ratings and provides a recoverable empty search', () => {
  render(<ReviewForm cycleId="cycle" review={review} onSubmitted={() => {}} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Ada: 4' }));
  fireEvent.click(screen.getByRole('button', { name: /Unrated/ }));
  expect(screen.queryByRole('radio', { name: 'Ada: 4' })).toBeNull();
  expect(screen.getByRole('radio', { name: 'Ben: 5' })).toBeTruthy();
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Find a colleague' }),
    { target: { value: 'Nobody' } }
  );
  expect(screen.getByText('No colleagues match your search.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Ben: 5' }));
  expect(
    screen.getByText(
      'Everyone has a rating. Review your choices before submitting.'
    )
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /All colleagues/ }));
  expect(
    (screen.getByRole('radio', { name: 'Ada: 4' }) as HTMLInputElement).checked
  ).toBe(true);
});
it('requires final confirmation and keeps the complete payload when filtered', async () => {
  vi.mocked(api.submitPeerRatings).mockResolvedValue({
    revision: 1,
    submittedAt: 'now',
  });
  render(<ReviewForm cycleId="cycle" review={review} onSubmitted={() => {}} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Ada: 4' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Ben: 5' }));
  fireEvent.click(screen.getByRole('button', { name: /Unrated/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit ratings' }));
  expect(api.submitPeerRatings).not.toHaveBeenCalled();
  expect(
    screen.getByRole('region', { name: 'Review your ratings' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(
    screen.queryByRole('region', { name: 'Review your ratings' })
  ).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Submit ratings' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit ratings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and submit' }));
  await waitFor(() =>
    expect(api.submitPeerRatings).toHaveBeenCalledWith(
      'cycle',
      [
        { subject: 'a', rating: 4 },
        { subject: 'b', rating: 5 },
      ],
      0
    )
  );
});
it('warns about unsaved ratings until the draft succeeds', async () => {
  vi.mocked(api.savePeerRatings).mockResolvedValue({
    revision: 1,
    submittedAt: null,
  });
  render(<ReviewForm cycleId="cycle" review={review} onSubmitted={() => {}} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Ada: 3' }));
  expect(screen.getByText('Unsaved ratings')).toBeTruthy();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved');
  const after = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});
it('keeps the loaded cycle visible when checking results fails and can retry', async () => {
  vi.mocked(api.fetchPeerReview).mockResolvedValue({
    ...review,
    isAppraiser: false,
    colleagues: [],
    status: 'collecting',
  });
  render(<EmployeePage id="cycle" />);
  await screen.findByRole('heading', { name: 'October review' });
  vi.mocked(api.fetchPeerReview).mockResolvedValue({
    ...review,
    isAppraiser: false,
    colleagues: [],
    status: 'closed',
  });
  vi.mocked(api.fetchPeerResult).mockRejectedValueOnce(
    new Error('Could not load final score')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Check for results' }));
  await screen.findByText(/Could not load final score/);
  expect(screen.getByRole('heading', { name: 'October review' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Submit ratings' })).toBeNull();
  vi.mocked(api.fetchPeerResult).mockResolvedValue({
    averageScore: 4,
    ratingCount: 2,
    allocationMinor: 10000,
    bonusMinor: 8000,
    currency: 'NGN',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('4.00 / 5');
});
