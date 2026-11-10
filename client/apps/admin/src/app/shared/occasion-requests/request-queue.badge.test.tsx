// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
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
  vi.unstubAllGlobals();
  state.token = 'signed';
  state.role = 'admin';
});
const result = (reference: string, extra: Record<string, unknown> = {}) => ({
  requests: [
    {
      _id: reference,
      reference,
      name: 'Customer',
      occasion: 'Party',
      city: 'Abuja',
      channel: 'email',
      status: 'pending',
      createdAt: '2026-11-09T09:00:00Z',
      dueAt: '2026-11-09T09:30:00Z',
      ...extra,
    },
  ],
  total: 1,
  page: 1,
  pages: 1,
});

test('queue rows surface the customer read-receipt badge and keep deep links', async () => {
  state.list.mockResolvedValue(result('ROWONE', {
    status: 'sent',
    customerUnreadCount: 3,
    firstStaffReplyAt: '2026-11-09T09:20:00Z',
    hasStaffReply: true,
    lastMessageAt: '2026-11-09T09:25:00Z',
  }));
  render(<RequestQueue />);
  await screen.findByText('ROWONE');
  expect(document.querySelector('a[href="/occasion-requests/ROWONE"]')).toBeTruthy();
  expect(document.body.textContent).toContain('3 saved replies this customer has not read yet');
});

test('a read (or legacy) conversation never shows the unread badge', async () => {
  state.list.mockResolvedValue({
    ...result('QUIET'),
    requests: [{ ...result('QUIET').requests[0], customerUnreadCount: 0, hasStaffReply: true }],
  });
  render(<RequestQueue />);
  await screen.findByText('QUIET');
  expect(document.body.textContent).not.toContain('0 saved replies');
});

test('two-pane selection intercepts a row activation while the deep link stays real', async () => {
  const onSelect = vi.fn();
  state.list.mockResolvedValue(result('PANEONE'));
  render(<RequestQueue pane selectedId="" onSelect={onSelect} />);
  await screen.findByText('PANEONE');
  const link = document.querySelector('a[href="/occasion-requests/PANEONE"]') as HTMLAnchorElement;
  expect(link).toBeTruthy();
  fireEvent.click(link);
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith('PANEONE'));
});
