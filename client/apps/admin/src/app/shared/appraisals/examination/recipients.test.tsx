// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import Panel from '../peer-rating/cycle-panel';
import * as api from '@/services/peerAppraisal.service';
vi.mock('@/services/peerAppraisal.service', () => ({
  fetchPeerEmployees: vi.fn(),
  fetchPeerParticipants: vi.fn(),
  replacePeerRoster: vi.fn(),
  peerCycleAction: vi.fn(),
}));
vi.mock('@/services/appraisal.service', () => ({
  fetchDepartmentOptions: vi.fn(async () => [
    { _id: 'retail', name: 'Retail' },
    { _id: 'bar', name: 'Bar service' },
  ]),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const employees = [
  { employee: 'a', displayName: 'Ada', department: 'retail' },
  { employee: 'b', displayName: 'Ben', department: 'bar' },
  { employee: 'c', displayName: 'Chidi', department: 'retail' },
  { employee: 'd', displayName: 'Dara', department: null },
];
it('previews only selected cycle employees and updates for department and unsaved roster changes', async () => {
  vi.mocked(api.fetchPeerEmployees).mockResolvedValue(employees);
  vi.mocked(api.fetchPeerParticipants).mockResolvedValue({
    status: 'draft',
    revision: 0,
    total: 2,
    submitted: 0,
    participants: employees.slice(0, 2).map((p) => ({
      ...p,
      allocationMinor: 10000,
      unavailable: false,
      submittedAt: null,
    })),
  });
  render(
    <Panel
      cycle={{
        _id: 'cycle',
        name: 'Review',
        mode: 'peer_rating',
        status: 'draft',
        peerReviewEnabled: true,
      }}
    />
  );
  fireEvent.click(
    await screen.findByRole('checkbox', {
      name: 'Include examination and attendance',
    })
  );
  const department = await screen.findByRole('checkbox', { name: 'Retail' });
  fireEvent.click(department);
  const preview = screen.getByRole('region', {
    name: 'Examination recipients',
  });
  expect(within(preview).getByText('Ada')).toBeTruthy();
  expect(within(preview).queryByText('Ben')).toBeNull();
  expect(within(preview).queryByText('Chidi')).toBeNull();
  expect(within(preview).queryByText('Dara')).toBeNull();
  expect(
    within(preview).getByText('1 employee will receive the exam')
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Dara' }));
  expect(within(preview).queryByText('Dara')).toBeNull();
  expect(
    within(preview).getByText('1 employee will receive the exam')
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Chidi' }));
  expect(within(preview).getByText('Chidi')).toBeTruthy();
  expect(
    within(preview).getByText('2 employees will receive the exam')
  ).toBeTruthy();
  expect(
    within(preview).getByText(/includes unsaved roster changes/)
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Bar service' }));
  expect(within(preview).getByText('Ben')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Ada' }));
  expect(within(preview).queryByText('Ada')).toBeNull();
  fireEvent.click(department);
  expect(within(preview).queryByText('Chidi')).toBeNull();
  expect(within(preview).getByText('Ben')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Bar service' }));
  expect(
    within(preview).getByText('Select a department to preview recipients.')
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include Chidi' }));
  fireEvent.click(department);
  expect(
    within(preview).getByText('0 employees will receive the exam')
  ).toBeTruthy();
  expect(
    within(preview).getByText(
      'No selected cycle participants belong to these departments.'
    )
  ).toBeTruthy();
});
