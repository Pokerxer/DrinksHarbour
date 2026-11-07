// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import Export from './cycle-results-export';
import { fetchCycle } from '@/services/appraisal.service';
import { fetchPeerParticipants } from '@/services/peerAppraisal.service';
import { buildCycleResultsPdf } from './cycle-results-pdf';
const save = vi.hoisted(() => vi.fn());
vi.mock('@/services/appraisal.service', () => ({ fetchCycle: vi.fn() }));
vi.mock('@/services/peerAppraisal.service', () => ({
  fetchPeerParticipants: vi.fn(),
}));
vi.mock('./cycle-results-pdf', () => ({
  buildCycleResultsPdf: vi.fn(() => ({ save })),
  cycleResultsFileName: () => 'October-results.pdf',
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('downloads fresh authorized results instead of exporting stale local progress', async () => {
  const cycle = { name: 'October' } as Awaited<ReturnType<typeof fetchCycle>>;
  const progress = { status: 'closed' } as Awaited<
    ReturnType<typeof fetchPeerParticipants>
  >;
  vi.mocked(fetchCycle).mockResolvedValue(cycle);
  vi.mocked(fetchPeerParticipants).mockResolvedValue(progress);
  render(<Export cycleId="cycle" />);
  fireEvent.click(screen.getByRole('button', { name: 'Download results PDF' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith('October-results.pdf'));
  expect(buildCycleResultsPdf).toHaveBeenCalledWith(cycle, progress);
  expect(fetchPeerParticipants).toHaveBeenCalledWith('cycle');
});
it('shows errors and permits retry without creating a partial PDF', async () => {
  vi.mocked(fetchCycle).mockRejectedValueOnce(
    new Error('Could not load cycle.')
  );
  render(<Export cycleId="cycle" />);
  fireEvent.click(screen.getByRole('button', { name: 'Download results PDF' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Could not load cycle'
  );
  expect(save).not.toHaveBeenCalled();
  expect(
    (
      screen.getByRole('button', {
        name: 'Download results PDF',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
});
