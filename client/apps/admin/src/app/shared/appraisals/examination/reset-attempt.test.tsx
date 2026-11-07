// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import ResetAttempt from './reset-attempt';
import { resetEmployeeExamination } from '@/services/examination.service';
vi.mock('@/services/examination.service', () => ({
  resetEmployeeExamination: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const props = {
  cycleId: 'cycle',
  employee: 'employee',
  displayName: 'Ada',
  cycleRevision: 9,
  attempt: {
    employee: 'employee',
    revision: 4,
    durationMinutes: 8,
    startedAt: '2026-10-20T10:00:00Z',
    submittedAt: null,
  },
  onReset: vi.fn(),
};
it('requires confirmation and sends both saved revisions before refreshing', async () => {
  vi.mocked(resetEmployeeExamination).mockResolvedValue({
    revision: 10,
    attemptRevision: 5,
  });
  render(<ResetAttempt {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reset test for Ada' }));
  expect(resetEmployeeExamination).not.toHaveBeenCalled();
  expect(screen.getByText(/full 8 minutes/i)).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Clear answers and reset time' })
  );
  await waitFor(() => expect(props.onReset).toHaveBeenCalled());
  expect(resetEmployeeExamination).toHaveBeenCalledWith(
    'cycle',
    'employee',
    4,
    9
  );
  expect(screen.getByRole('status').textContent).toMatch(/reset/i);
});
it('cancel preserves the attempt and failures allow refresh before retrying', async () => {
  render(<ResetAttempt {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reset test for Ada' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep current attempt' }));
  expect(resetEmployeeExamination).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Reset test for Ada' }));
  vi.mocked(resetEmployeeExamination).mockRejectedValue(
    new Error('Refresh progress before resetting.')
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Clear answers and reset time' })
  );
  expect((await screen.findByRole('alert')).textContent).toMatch(
    /Refresh progress/
  );
});
