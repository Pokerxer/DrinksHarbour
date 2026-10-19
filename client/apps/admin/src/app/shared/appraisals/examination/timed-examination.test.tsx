// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import EmployeeExam from './employee-exam';
import * as api from '@/services/examination.service';
vi.mock('@/services/examination.service', () => ({
  fetchExamination: vi.fn(),
  startExamination: vi.fn(),
  saveExamAnswers: vi.fn(),
  submitExamAnswers: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.useRealTimers();
});
const paper = {
  assigned: true,
  status: 'collecting' as const,
  durationMinutes: 1,
  revision: 1,
  startedAt: '2026-10-19T10:00:00Z',
  expiresAt: '2026-10-19T10:01:00Z',
  serverNow: '2026-10-19T10:00:58Z',
  submittedAt: null,
  answers: [],
  questionCount: 2,
  maxMarks: 4,
  questions: [
    { question: 'a', prompt: 'Easy question', options: ['A', 'B'], marks: 1 },
    { question: 'b', prompt: 'Hard question', options: ['C', 'D'], marks: 3 },
  ],
};
it('requires explicit start, shows marks and preserves the server deadline on reload', async () => {
  vi.mocked(api.fetchExamination).mockResolvedValue({
    ...paper,
    startedAt: null,
    expiresAt: null,
    questions: [],
    revision: 0,
  });
  vi.mocked(api.startExamination).mockResolvedValue(paper);
  const view = render(<EmployeeExam cycleId="c" />);
  const start = await screen.findByRole('button', {
    name: 'Start examination',
  });
  expect(screen.queryByText('Easy question')).toBeNull();
  expect(screen.getByText(/1 minute/)).toBeTruthy();
  fireEvent.click(start);
  await screen.findByRole('radio', { name: 'C' });
  expect(screen.getByText('3 marks')).toBeTruthy();
  await screen.findByText('00:02');
  view.unmount();
  vi.mocked(api.fetchExamination).mockResolvedValue({
    ...paper,
    serverNow: '2026-10-19T10:00:59Z',
  });
  render(<EmployeeExam cycleId="c" />);
  await screen.findByRole('radio', { name: 'C' });
  await screen.findByText('00:01');
  expect(
    screen.queryByRole('button', { name: 'Start examination' })
  ).toBeNull();
});
it('autosaves timed answers and locks the paper at expiry while loading the server grade', async () => {
  vi.useFakeTimers();
  const expired = {
    ...paper,
    submittedAt: '2026-10-19T10:01:00Z',
    serverNow: '2026-10-19T10:01:00Z',
    timedOut: true,
    earnedMarks: 3,
    maxMarks: 4,
    score: 75,
    correctCount: 1,
    answers: [{ question: 'b', option: 0 }],
    revision: 3,
  };
  vi.mocked(api.fetchExamination)
    .mockResolvedValueOnce(paper)
    .mockResolvedValue(expired);
  vi.mocked(api.saveExamAnswers).mockResolvedValue({
    revision: 2,
    submittedAt: null,
    answers: [{ question: 'b', option: 0 }],
    serverNow: paper.serverNow,
  });
  await act(async () => {
    render(<EmployeeExam cycleId="c" />);
  });
  fireEvent.click(screen.getByRole('radio', { name: 'C' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(api.saveExamAnswers).toHaveBeenCalledWith(
    'c',
    [{ question: 'b', option: 0 }],
    1
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2200);
  });
  expect(screen.getByText('75.00 / 100')).toBeTruthy();
  expect(screen.getByText('3 / 4 marks')).toBeTruthy();
  expect(screen.getByText(/Time expired/)).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Submit examination' })
  ).toBeNull();
});

it('preserves answers selected during an autosave and saves them using the next revision', async () => {
  vi.useFakeTimers();
  vi.mocked(api.fetchExamination).mockResolvedValue({
    ...paper,
    serverNow: '2026-10-19T10:00:00Z',
  });
  let resolveSave!: (value: api.ExamAttempt) => void;
  vi.mocked(api.saveExamAnswers)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    )
    .mockResolvedValue({
      revision: 3,
      submittedAt: null,
      answers: [
        { question: 'a', option: 0 },
        { question: 'b', option: 0 },
      ],
      serverNow: '2026-10-19T10:00:01Z',
    });
  await act(async () => {
    render(<EmployeeExam cycleId="c" />);
  });
  fireEvent.click(screen.getByRole('radio', { name: 'C' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  fireEvent.click(screen.getByRole('radio', { name: 'A' }));
  await act(async () => {
    resolveSave({
      revision: 2,
      submittedAt: null,
      answers: [{ question: 'b', option: 0 }],
      serverNow: '2026-10-19T10:00:00Z',
    });
  });
  expect(
    (screen.getByRole('radio', { name: 'A' }) as HTMLInputElement).checked
  ).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(api.saveExamAnswers).toHaveBeenLastCalledWith(
    'c',
    [
      { question: 'a', option: 0 },
      { question: 'b', option: 0 },
    ],
    2
  );
  expect(screen.getByText('Answers saved')).toBeTruthy();
});

it('locks expired answers after a connection error and lets the employee retry finalization', async () => {
  vi.useFakeTimers();
  vi.mocked(api.fetchExamination)
    .mockResolvedValueOnce(paper)
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValue({
      ...paper,
      submittedAt: '2026-10-19T10:01:00Z',
      timedOut: true,
      score: 0,
      earnedMarks: 0,
      maxMarks: 4,
      correctCount: 0,
      revision: 2,
    });
  await act(async () => {
    render(<EmployeeExam cycleId="c" />);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  expect(screen.getByText(/Connection lost/)).toBeTruthy();
  expect(
    (
      screen
        .getByRole('radio', { name: 'C' })
        .closest('fieldset') as HTMLFieldSetElement
    ).disabled
  ).toBe(true);
  expect(
    screen.queryByRole('button', { name: 'Submit examination' })
  ).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Retry finalization' }));
  });
  expect(screen.getByText('0.00 / 100')).toBeTruthy();
});
it('does not try to finalize a cancelled examination when its deadline passes', async () => {
  vi.useFakeTimers();
  vi.mocked(api.fetchExamination)
    .mockResolvedValueOnce({ ...paper, status: 'cancelled' })
    .mockRejectedValue(new Error('Unexpected finalization'));
  await act(async () => {
    render(<EmployeeExam cycleId="c" />);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(api.fetchExamination).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText('Time expired. Loading your final score…')
  ).toBeNull();
});
