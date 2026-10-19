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
import { saveExamination } from '@/services/examination.service';
vi.mock('@/services/appraisal.service', () => ({
  fetchDepartmentOptions: vi.fn(async () => [
    { _id: 'retail', name: 'Retail' },
  ]),
}));
vi.mock('@/services/examination.service', () => ({
  saveExamination: vi.fn(async () => ({ revision: 2 })),
}));
const initial = {
  durationMinutes: 30,
  attendanceFrom: '2020-01-01',
  attendanceTo: '2020-01-31',
  departments: ['retail'],
  questions: Array.from({ length: 10 }, (_, i) => ({
    prompt: `Question ${i}`,
    options: ['Yes', 'No'],
    correctOption: 0,
    marks: 2,
  })),
};
const recipients = [
  { employee: 'a', displayName: 'Ada', department: 'retail' },
  { employee: 'b', displayName: 'Ben', department: 'retail' },
];
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('saves only checked employees and restores a saved selection', async () => {
  const props = {
    cycleId: 'cycle',
    revision: 1,
    initial,
    onDirty: vi.fn(),
    onSaved: vi.fn(),
    recipients,
  };
  const view = render(<Setup {...props} />);
  const ada = await screen.findByRole('checkbox', { name: 'Send exam to Ada' });
  expect((ada as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Send exam to Ben' }));
  expect(screen.getByText('1 employee will receive the exam')).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Save examination settings' })
  );
  await waitFor(() =>
    expect(saveExamination).toHaveBeenCalledWith(
      'cycle',
      expect.objectContaining({ recipientIds: ['a'] }),
      1
    )
  );
  view.unmount();
  render(<Setup {...props} initial={{ ...initial, recipientIds: ['a'] }} />);
  expect(
    (
      (await screen.findByRole('checkbox', {
        name: 'Send exam to Ben',
      })) as HTMLInputElement
    ).checked
  ).toBe(false);
});
it('requires a recipient and requires saving the roster first', async () => {
  const props = {
    cycleId: 'cycle',
    revision: 1,
    initial,
    onDirty: vi.fn(),
    onSaved: vi.fn(),
    recipients,
  };
  const view = render(<Setup {...props} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Clear selection' })
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Save examination settings',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Select all employees' }));
  expect(
    (
      screen.getByRole('button', {
        name: 'Save examination settings',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
  view.rerender(<Setup {...props} rosterDirty />);
  expect(
    (
      screen.getByRole('button', {
        name: 'Save examination settings',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});
it('never adds new roster employees to an explicit selection', async () => {
  const props = {
    cycleId: 'cycle',
    revision: 1,
    initial: { ...initial, recipientIds: ['a'] },
    onDirty: vi.fn(),
    onSaved: vi.fn(),
    recipients,
  };
  const view = render(<Setup {...props} />);
  await screen.findByRole('checkbox', { name: 'Send exam to Ben' });
  view.rerender(
    <Setup
      {...props}
      recipients={[
        ...recipients,
        { employee: 'c', displayName: 'Chidi', department: 'retail' },
      ]}
    />
  );
  expect(
    (
      screen.getByRole('checkbox', {
        name: 'Send exam to Chidi',
      }) as HTMLInputElement
    ).checked
  ).toBe(false);
  fireEvent.click(
    screen.getByRole('button', { name: 'Save examination settings' })
  );
  await waitFor(() =>
    expect(saveExamination).toHaveBeenCalledWith(
      'cycle',
      expect.objectContaining({ recipientIds: ['a'] }),
      1
    )
  );
});

it('keeps recipient edits while accepting the revision returned by a local roster save', async () => {
  const props = {
    cycleId: 'cycle',
    revision: 1,
    initial,
    onDirty: vi.fn(),
    onSaved: vi.fn(),
    recipients,
  };
  const view = render(<Setup {...props} rosterDirty />);
  fireEvent.click(
    await screen.findByRole('checkbox', { name: 'Send exam to Ben' })
  );
  view.rerender(
    <Setup
      {...props}
      revision={2}
      rosterDirty={false}
      rosterSavedRevision={2}
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save examination settings' })
  );
  await waitFor(() =>
    expect(saveExamination).toHaveBeenCalledWith(
      'cycle',
      expect.objectContaining({ recipientIds: ['a'] }),
      2
    )
  );
});
