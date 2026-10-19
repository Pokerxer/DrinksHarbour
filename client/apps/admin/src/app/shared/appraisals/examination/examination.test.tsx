// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Setup from './setup';
import EmployeeExam from './employee-exam';
import Breakdown from './score-breakdown';
import * as api from '@/services/examination.service';
import { fetchDepartmentOptions } from '@/services/appraisal.service';
vi.mock('@/services/examination.service', () => ({
  saveExamination: vi.fn(),
  fetchExamination: vi.fn(),
  saveExamAnswers: vi.fn(),
  submitExamAnswers: vi.fn(),
}));
vi.mock('@/services/appraisal.service', () => ({
  fetchDepartmentOptions: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('saves departments, attendance dates and correct MCQ options and marks unsaved settings dirty', async () => {
  vi.mocked(fetchDepartmentOptions).mockResolvedValue([
    { _id: 'retail', name: 'Retail' },
  ]);
  vi.mocked(api.saveExamination).mockResolvedValue({ revision: 6 });
  const onDirty = vi.fn();
  render(
    <Setup
      cycleId="c"
      initial={{
        attendanceFrom: '',
        attendanceTo: '',
        departments: [],
        questions: Array.from({ length: 10 }, (_, i) => ({
          prompt: `Question ${i + 1}`,
          options: ['Wrong', 'Correct'],
          correctOption: 0,
        })),
      }}
      revision={5}
      onDirty={onDirty}
      onSaved={() => {}}
    />
  );
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Retail' }));
  fireEvent.change(screen.getByLabelText('Attendance start date'), {
    target: { value: '2020-01-10' },
  });
  fireEvent.change(screen.getByLabelText('Attendance end date'), {
    target: { value: '2020-01-20' },
  });
  fireEvent.change(screen.getByLabelText('Question 1'), {
    target: { value: 'Choose the answer' },
  });
  fireEvent.change(screen.getByLabelText('Question 1 option 1'), {
    target: { value: 'Wrong' },
  });
  fireEvent.change(screen.getByLabelText('Question 1 option 2'), {
    target: { value: 'Correct' },
  });
  fireEvent.click(screen.getByLabelText('Correct answer for question 1'));
  fireEvent.click(await screen.findByRole('option', { name: /Option 2/ }));
  fireEvent.change(screen.getByLabelText('Marks for question 1'), {
    target: { value: '5' },
  });
  fireEvent.change(screen.getByLabelText('Examination duration (minutes)'), {
    target: { value: '45' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save examination settings' })
  );
  await screen.findByText('Examination settings saved');
  expect(onDirty).toHaveBeenCalledWith(true);
  expect(api.saveExamination).toHaveBeenCalledWith(
    'c',
    {
      durationMinutes: 45,
      attendanceFrom: '2020-01-10',
      attendanceTo: '2020-01-20',
      questionsPerEmployee: 10,
      marksPerQuestion: 2,
      departments: ['retail'],
      questions: Array.from({ length: 10 }, (_, i) => ({
        prompt: i === 0 ? 'Choose the answer' : `Question ${i + 1}`,
        options: ['Wrong', 'Correct'],
        correctOption: i === 0 ? 1 : 0,
        marks: i === 0 ? 5 : 2,
      })),
    },
    5
  );
});
it('requires every MCQ answer and displays the server-marked examination score', async () => {
  vi.mocked(api.fetchExamination).mockResolvedValue({
    assigned: true,
    marksPerQuestion: 2,
    status: 'collecting',
    revision: 0,
    submittedAt: null,
    answers: [],
    questions: [
      { question: 'q', prompt: 'Choose one', options: ['Wrong', 'Correct'] },
    ],
  });
  vi.mocked(api.submitExamAnswers).mockResolvedValue({
    revision: 1,
    submittedAt: '2026-10-19',
    answers: [{ question: 'q', option: 1 }],
    score: 100,
    correctCount: 1,
    questionCount: 1,
    earnedMarks: 2,
    maxMarks: 2,
  });
  render(<EmployeeExam cycleId="c" />);
  const submit = await screen.findByRole('button', {
    name: 'Submit examination',
  });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'Correct' }));
  fireEvent.click(submit);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm submission' }));
  await screen.findByText('100.00 / 100');
  expect(screen.getByText('2 / 2 marks')).toBeTruthy();
  expect(api.submitExamAnswers).toHaveBeenCalledWith(
    'c',
    [{ question: 'q', option: 1 }],
    0
  );
  expect(
    screen.queryByRole('button', { name: 'Submit examination' })
  ).toBeNull();
});
it('keeps stale examination answers visible after a save error', async () => {
  vi.mocked(api.fetchExamination).mockResolvedValue({
    assigned: true,
    status: 'collecting',
    revision: 0,
    submittedAt: null,
    answers: [],
    questions: [
      { question: 'q', prompt: 'Choose one', options: ['Wrong', 'Correct'] },
    ],
  });
  vi.mocked(api.saveExamAnswers).mockRejectedValue(
    new Error('Examination changed in another session.')
  );
  render(<EmployeeExam cycleId="c" />);
  const answer = await screen.findByRole('radio', { name: 'Correct' });
  fireEvent.click(answer);
  fireEvent.click(
    screen.getByRole('button', { name: 'Save examination draft' })
  );
  await screen.findByRole('alert');
  expect((answer as HTMLInputElement).checked).toBe(true);
});
it('shows the combined result and all components without inventing an exam for other departments', () => {
  render(
    <Breakdown
      result={{
        appraisalScore: 80,
        attendanceScore: 100,
        combinedScore: 90,
        attendanceMonth: '2020-01',
      }}
    />
  );
  expect(screen.getByText('90.00 / 100')).toBeTruthy();
  expect(
    screen.getByText(/Appraisal and attendance carry equal weight/)
  ).toBeTruthy();
  expect(screen.queryByText('Examination')).toBeNull();
});
