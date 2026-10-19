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
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  savePeerRatings: vi.fn(),
  submitPeerRatings: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const review = {
  name: 'October',
  status: 'collecting' as const,
  submittedAt: null,
  revision: 0,
  colleagues: [
    { employee: 'a', displayName: 'Ada' },
    { employee: 'b', displayName: 'Ben' },
  ],
  ratings: [],
};
it('requires one rating per colleague and preserves entries after failure', async () => {
  vi.mocked(api.submitPeerRatings).mockRejectedValue(
    new Error('Connection lost')
  );
  render(<ReviewForm cycleId="cycle" review={review} onSubmitted={() => {}} />);
  const submit = screen.getByRole('button', {
    name: 'Submit ratings',
  }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'Ada: 4' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Ben: 5' }));
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and submit' }));
  await screen.findByText(/Connection lost/);
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(
    (screen.getByRole('radio', { name: 'Ada: 4' }) as HTMLInputElement).checked
  ).toBe(true);
});
it('saves a draft and submits with the returned revision', async () => {
  vi.mocked(api.savePeerRatings).mockResolvedValue({
    revision: 1,
    submittedAt: null,
  });
  vi.mocked(api.submitPeerRatings).mockResolvedValue({
    revision: 2,
    submittedAt: 'now',
  });
  const done = vi.fn();
  render(<ReviewForm cycleId="cycle" review={review} onSubmitted={done} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Ada: 4' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved');
  fireEvent.click(screen.getByRole('radio', { name: 'Ben: 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit ratings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and submit' }));
  await waitFor(() => expect(done).toHaveBeenCalled());
  expect(api.submitPeerRatings).toHaveBeenCalledWith(
    'cycle',
    [
      { subject: 'a', rating: 4 },
      { subject: 'b', rating: 5 },
    ],
    1
  );
});
it('keeps submitted and cancelled cycles read only', () => {
  const view = render(
    <ReviewForm
      cycleId="cycle"
      review={{ ...review, submittedAt: 'now' }}
      onSubmitted={() => {}}
    />
  );
  expect(screen.queryByRole('button', { name: 'Submit ratings' })).toBeNull();
  view.rerender(
    <ReviewForm
      key="cancelled"
      cycleId="cycle"
      review={{ ...review, status: 'cancelled' }}
      onSubmitted={() => {}}
    />
  );
  expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Ada: 4' }));
  expect(api.savePeerRatings).not.toHaveBeenCalled();
});
