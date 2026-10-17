// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CycleDetail from '../cycle-detail';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: 'tenant_admin' } } }),
}));
vi.mock('@/services/appraisal.service', () => ({
  fetchCycle: vi.fn(async () => ({
    _id: 'c',
    name: 'October review',
    status: 'closed',
    peerReviewEnabled: true,
  })),
  fetchCycleProgress: vi.fn(async () => ({
    byState: { released: 2 },
    feedbackTotal: 4,
    feedbackSubmitted: 4,
    stalled: [],
  })),
  launchCycle: vi.fn(),
  closeCycle: vi.fn(),
  skipPeers: vi.fn(),
}));
vi.mock('../cycle-roster', () => ({
  default: () => <section>Employee roster</section>,
}));
vi.mock('../cycle-report', () => ({
  default: () => <section>Appraisal report</section>,
}));
vi.mock('../cycle-standing-feedback', () => ({
  default: () => <section>Standing feedback</section>,
}));
afterEach(cleanup);
it('uses the shared cycle overview and preserves closed-cycle and owner-only restrictions', async () => {
  render(<CycleDetail id="c" />);
  await screen.findByRole('list', { name: 'Cycle stages' });
  expect(screen.getByRole('heading', { name: 'October review' })).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Launch' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Close cycle' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(screen.queryByText('Standing feedback')).toBeNull();
  expect(screen.getByText('Employee roster')).toBeTruthy();
});
