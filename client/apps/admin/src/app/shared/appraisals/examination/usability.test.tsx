// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import Editor from './question-bank-editor';
import EmployeeExam from './employee-exam';
import * as api from '@/services/examination.service';
vi.mock('@/services/examination.service', () => ({
  fetchExamination: vi.fn(),
  saveExamAnswers: vi.fn(),
  submitExamAnswers: vi.fn(),
  startExamination: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const initial = {
  departments: ['d'],
  questions: [
    {
      prompt: 'Wine service',
      options: ['A', 'B'],
      correctOption: 0,
      marks: 1,
      difficulty: 'easy' as const,
    },
    {
      prompt: 'Whisky origins',
      options: ['Scotland', 'France'],
      correctOption: 0,
      marks: 3,
      difficulty: 'hard' as const,
    },
  ],
};
it('finds questions by options and difficulty and edits the original question after filtering', async () => {
  function Bank() {
    const [config, setConfig] = useState<api.ExamConfiguration>(initial);
    return <Editor config={config} disabled={false} onChange={setConfig} />;
  }
  render(<Bank />);
  fireEvent.change(screen.getByLabelText('Search question bank'), {
    target: { value: 'Scotland' },
  });
  fireEvent.click(screen.getByLabelText('Filter by difficulty'));
  fireEvent.click(await screen.findByRole('option', { name: 'Hard' }));
  fireEvent.click(screen.getByRole('button', { name: /Whisky origins/ }));
  fireEvent.change(screen.getByLabelText('Marks for question 2'), {
    target: { value: '5' },
  });
  fireEvent.change(screen.getByLabelText('Search question bank'), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByLabelText('Filter by difficulty'));
  fireEvent.click(
    await screen.findByRole('option', { name: 'All difficulties' })
  );
  fireEvent.click(screen.getByRole('button', { name: /Wine service/ }));
  expect(
    (screen.getByLabelText('Marks for question 1') as HTMLInputElement).value
  ).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: /Whisky origins/ }));
  expect(
    (screen.getByLabelText('Marks for question 2') as HTMLInputElement).value
  ).toBe('5');
});
it('shows an empty search state and clears filters without changing the bank', () => {
  render(<Editor config={initial} disabled={false} onChange={() => {}} />);
  fireEvent.change(screen.getByLabelText('Search question bank'), {
    target: { value: 'missing' },
  });
  expect(screen.getByText('No questions match your filters.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByRole('button', { name: /Wine service/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Whisky origins/ })).toBeTruthy();
});
it('tracks answer progress, focuses the next unanswered question and requires confirmation to submit', async () => {
  vi.mocked(api.fetchExamination).mockResolvedValue({
    assigned: true,
    status: 'collecting',
    revision: 0,
    submittedAt: null,
    answers: [],
    questions: [
      { question: 'a', prompt: 'First', options: ['A', 'B'], marks: 1 },
      { question: 'b', prompt: 'Second', options: ['C', 'D'], marks: 3 },
    ],
  });
  vi.mocked(api.submitExamAnswers).mockResolvedValue({
    revision: 1,
    submittedAt: '2026-10-19',
    answers: [],
    score: 75,
    earnedMarks: 3,
    maxMarks: 4,
    correctCount: 1,
    questionCount: 2,
  });
  render(<EmployeeExam cycleId="c" />);
  await screen.findByRole('radio', { name: 'A' });
  expect(
    screen
      .getByRole('progressbar', { name: 'Examination completion' })
      .getAttribute('aria-valuenow')
  ).toBe('0');
  fireEvent.click(screen.getByRole('radio', { name: 'A' }));
  expect(screen.getByText('1 of 2 answered')).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Go to next unanswered question' })
  );
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Question 2');
  fireEvent.click(screen.getByRole('radio', { name: 'C' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit examination' }));
  expect(
    screen.getByRole('region', { name: 'Review your submission' })
  ).toBeTruthy();
  expect(api.submitExamAnswers).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep answering' }));
  expect(
    (screen.getByRole('radio', { name: 'C' }) as HTMLInputElement).checked
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Submit examination' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm submission' }));
  await screen.findByText('75.00 / 100');
});
