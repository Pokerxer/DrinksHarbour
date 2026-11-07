// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import RequestQueue from './request-queue';
const state = vi.hoisted(() => ({
  list: vi.fn(),
  token: 'signed',
  role: 'admin',
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: state.token, role: state.role } },
    status: 'authenticated',
  }),
}));
vi.mock('@/services/occasionRequest.service', () => ({
  occasionRequestService: { list: state.list },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.token = 'signed';
  state.role = 'admin';
});
const result = (reference: string) => ({
  requests: [
    {
      _id: reference,
      reference,
      name: 'Customer',
      occasion: 'Party',
      city: 'Abuja',
      channel: 'email',
      status: 'pending',
      createdAt: '2026-10-27',
      dueAt: '2026-10-27',
    },
  ],
  total: 1,
  page: 1,
  pages: 1,
});
test('a late response for a previous filter cannot replace the current queue', async () => {
  let finish: (value: unknown) => void = () => {};
  state.list
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue(result('CURRENT'));
  render(<RequestQueue />);
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'draft' },
  });
  await screen.findByText('CURRENT');
  await act(async () => {
    finish(result('ABANDONED'));
  });
  expect(screen.queryByText('ABANDONED')).toBeNull();
  expect(screen.getByText('CURRENT')).toBeTruthy();
});

test('moving to another page removes old rows while the new page loads', async () => {
  state.list
    .mockResolvedValueOnce({ ...result('FIRST_PAGE'), pages: 2 })
    .mockImplementationOnce(() => new Promise(() => {}));
  render(<RequestQueue />);
  await screen.findByText('FIRST_PAGE');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.queryByText('FIRST_PAGE')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Loading requests');
});

test('changing the signed-in session immediately removes the previous queue', async () => {
  state.list
    .mockResolvedValueOnce(result('PRIVATE_PREVIOUS'))
    .mockImplementationOnce(() => new Promise(() => {}));
  const mounted = render(<RequestQueue />);
  await screen.findByText('PRIVATE_PREVIOUS');
  state.token = 'second-session';
  mounted.rerender(<RequestQueue />);
  expect(screen.queryByText('PRIVATE_PREVIOUS')).toBeNull();
});

test('unauthorized staff do not load the private customer request queue', () => {
  state.role = 'tenant_staff';
  render(<RequestQueue />);
  expect(screen.getByRole('alert').textContent).toContain('administrator');
  expect(state.list).not.toHaveBeenCalled();
});
