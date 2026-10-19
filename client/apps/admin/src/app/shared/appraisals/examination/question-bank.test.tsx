// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import Setup from './setup';
import * as api from '@/services/examination.service';
import { fetchDepartmentOptions } from '@/services/appraisal.service';
vi.mock('@/services/examination.service', () => ({
  saveExamination: vi.fn(),
  fetchQuestionBank: vi.fn(),
  generateExamQuestions: vi.fn(),
}));
vi.mock('@/services/appraisal.service', () => ({
  fetchDepartmentOptions: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const bank = {
  name: 'Wyn City',
  questionsPerEmployee: 10,
  marksPerQuestion: 2,
  questions: Array.from({ length: 30 }, (_, i) => ({
    prompt: `Bank question ${i + 1}`,
    options: ['Correct', 'Wrong'],
    correctOption: 0,
  })),
};
const banks = [
  { id: 'wyn-city-drinks-30', name: 'Wyn City', questionCount: 30 },
];
it('loads the supplied bank and saves an inclusive attendance range with ten questions per employee', async () => {
  vi.mocked(fetchDepartmentOptions).mockResolvedValue([
    { _id: 'd', name: 'Retail' },
  ]);
  vi.mocked(api.fetchQuestionBank).mockResolvedValue(bank);
  vi.mocked(api.saveExamination).mockResolvedValue({ revision: 2 });
  render(
    <Setup
      cycleId="c"
      initial={null}
      revision={1}
      banks={banks}
      onDirty={() => {}}
      onSaved={() => {}}
    />
  );
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Include examination and attendance',
    })
  );
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Retail' }));
  fireEvent.change(screen.getByLabelText('Attendance start date'), {
    target: { value: '2026-09-10' },
  });
  fireEvent.change(screen.getByLabelText('Attendance end date'), {
    target: { value: '2026-09-20' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Use Wyn City question bank' })
  );
  await screen.findByText('30 questions in bank');
  expect(screen.getByText('10 questions per employee · 20 marks')).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save examination settings' })
  );
  await screen.findByText('Examination settings saved');
  expect(api.saveExamination).toHaveBeenCalledWith(
    'c',
    {
      durationMinutes: 30,
      attendanceFrom: '2026-09-10',
      attendanceTo: '2026-09-20',
      questionsPerEmployee: 10,
      marksPerQuestion: 2,
      departments: ['d'],
      questions: bank.questions.map((q) => ({ ...q, marks: 2 })),
    },
    1
  );
});
it('reviews AI questions before explicitly replacing the current bank', async () => {
  vi.mocked(fetchDepartmentOptions).mockResolvedValue([
    { _id: 'd', name: 'Retail' },
  ]);
  const generated = bank.questions.map((q, i) => ({
    ...q,
    prompt: `Generated question ${i + 1}`,
    marks: 3,
    difficulty: 'hard' as const,
  }));
  vi.mocked(api.generateExamQuestions).mockResolvedValue({
    questions: generated,
    model: 'test-model',
    questionsPerEmployee: 10,
    marksPerQuestion: 2,
  });
  render(
    <Setup
      cycleId="c"
      initial={{
        ...bank,
        attendanceFrom: '2026-09-01',
        attendanceTo: '2026-09-30',
        departments: ['d'],
      }}
      revision={1}
      onDirty={() => {}}
      onSaved={() => {}}
    />
  );
  fireEvent.change(screen.getByLabelText('Topics for AI questions'), {
    target: { value: 'Beverage knowledge and customer service' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Generate draft questions' })
  );
  await screen.findByText('Model: test-model');
  expect(
    (screen.getByLabelText('Question 1') as HTMLTextAreaElement).value
  ).toBe('Bank question 1');
  fireEvent.click(
    screen.getByRole('button', { name: 'Use generated questions' })
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Question 1') as HTMLTextAreaElement).value
    ).toBe('Generated question 1')
  );
  expect(
    (screen.getByLabelText('Marks for question 1') as HTMLInputElement).value
  ).toBe('3');
  expect(
    screen.getByLabelText('Difficulty for question 1').textContent
  ).toContain('Hard');
  expect(api.saveExamination).not.toHaveBeenCalled();
});

it('keeps date edits made while loading a bank and blocks saving until the load finishes', async () => {
  vi.mocked(fetchDepartmentOptions).mockResolvedValue([
    { _id: 'd', name: 'Retail' },
  ]);
  let resolveBank!: (value: typeof bank) => void;
  vi.mocked(api.fetchQuestionBank).mockReturnValue(
    new Promise((resolve) => {
      resolveBank = resolve;
    })
  );
  render(
    <Setup
      cycleId="c"
      initial={{
        ...bank,
        attendanceFrom: '2026-09-01',
        attendanceTo: '2026-09-30',
        departments: ['d'],
      }}
      revision={1}
      banks={banks}
      onDirty={() => {}}
      onSaved={() => {}}
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Use Wyn City question bank' })
  );
  fireEvent.change(screen.getByLabelText('Attendance start date'), {
    target: { value: '2026-09-10' },
  });
  expect(
    (
      screen.getByRole('button', {
        name: 'Save examination settings',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  resolveBank(bank);
  await screen.findByText('30 questions loaded');
  expect(
    (screen.getByLabelText('Attendance start date') as HTMLInputElement).value
  ).toBe('2026-09-10');
  expect(
    (
      screen.getByRole('button', {
        name: 'Save examination settings',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
});
it('preserves the existing bank after AI generation fails', async () => {
  vi.mocked(fetchDepartmentOptions).mockResolvedValue([
    { _id: 'd', name: 'Retail' },
  ]);
  vi.mocked(api.generateExamQuestions).mockRejectedValue(
    new Error('AI returned an invalid bank.')
  );
  render(
    <Setup
      cycleId="c"
      initial={{
        ...bank,
        attendanceFrom: '2026-09-01',
        attendanceTo: '2026-09-30',
        departments: ['d'],
      }}
      revision={1}
      onDirty={() => {}}
      onSaved={() => {}}
    />
  );
  fireEvent.change(screen.getByLabelText('Topics for AI questions'), {
    target: { value: 'Wine knowledge' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Generate draft questions' })
  );
  await screen.findByText('AI returned an invalid bank.');
  expect(
    (screen.getByLabelText('Question 1') as HTMLTextAreaElement).value
  ).toBe('Bank question 1');
  expect(api.saveExamination).not.toHaveBeenCalled();
});
it('explains invalid question marks and enables saving after correction', async () => {
  vi.mocked(fetchDepartmentOptions).mockResolvedValue([
    { _id: 'd', name: 'Retail' },
  ]);
  render(
    <Setup
      cycleId="c"
      initial={{
        ...bank,
        attendanceFrom: '2026-09-01',
        attendanceTo: '2026-09-30',
        departments: ['d'],
      }}
      revision={1}
      onDirty={() => {}}
      onSaved={() => {}}
    />
  );
  fireEvent.change(screen.getByLabelText('Marks for question 1'), {
    target: { value: '0' },
  });
  expect(
    screen.getByText('Question 1 needs whole-number marks from 1 to 20.')
  ).toBeTruthy();
  expect(
    (
      screen.getByRole('button', {
        name: 'Save examination settings',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Marks for question 1'), {
    target: { value: '2' },
  });
  expect(screen.getByText('Ready to save')).toBeTruthy();
  expect(
    (
      screen.getByRole('button', {
        name: 'Save examination settings',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
});
