// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import EnrollmentView from './enrollment-view';
const state = vi.hoisted(() => ({ role: 'tenant_owner', request: vi.fn() }));
vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({
    role: state.role,
    user: { token: 'token', tenantId: 'own-tenant' },
  }),
}));
vi.mock('@/services/market-foundation.service', () => ({
  foundationRequest: state.request,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.role = 'tenant_owner';
});
test('staff cannot load or review market applications', () => {
  state.role = 'tenant_staff';
  render(<EnrollmentView />);
  expect(screen.getByRole('alert').textContent).toMatch(/owner.*required/i);
  expect(state.request).not.toHaveBeenCalled();
});
test('tenant application sends only its scoped application and keeps fields on conflict', async () => {
  state.request
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(
      new Error('Market revision changed; reload before saving')
    );
  render(<EnrollmentView />);
  await screen.findByText('No applications yet.');
  fireEvent.change(screen.getByLabelText('Application statement'), {
    target: { value: 'Synthetic application request' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply for enrollment' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toMatch(/revision changed/)
  );
  const body = state.request.mock.calls[1][3];
  expect(body).toMatchObject({
    market: 'NG',
    category: 'beverage',
    channel: 'marketplace',
    expectedVersion: 0,
  });
  expect(body.tenant).toBeUndefined();
  expect(body.status).toBeUndefined();
  expect(
    (screen.getByLabelText('Application statement') as HTMLTextAreaElement)
      .value
  ).toBe('Synthetic application request');
  expect(screen.queryByRole('button', { name: 'Save policy' })).toBeNull();
});

test.each(['current', 'future'])(
  'tenant cannot replace a %s unexpired approval by reapplying',
  async (term) => {
    const row = {
      _id: 'approval',
      tenant: 'own-tenant',
      market: 'NG',
      category: 'beverage',
      channel: 'marketplace',
      version: 2,
      status: 'approved',
      reason: 'Reviewed approval',
      statement: 'Saved application',
      effectiveFrom: new Date(
        Date.now() + (term === 'future' ? 3600000 : -3600000)
      ).toISOString(),
      effectiveUntil: new Date(Date.now() + 7200000).toISOString(),
    };
    state.request.mockResolvedValue([row]);
    render(<EnrollmentView />);
    await screen.findByText(/Reviewed approval/);
    const button = screen.getByRole('button', {
      name: 'Apply for enrollment',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      screen.getByText(
        /Renewals or changes to this approval require platform review/
      )
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Application statement'), {
      target: { value: 'Accidental second application' },
    });
    fireEvent.click(button);
    expect(state.request).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Enrollment channel'), {
      target: { value: 'storefront' },
    });
    expect(button.disabled).toBe(false);
  }
);
test('tenant may apply again after an approval expires', async () => {
  state.request.mockResolvedValue([
    {
      _id: 'expired',
      tenant: 'own-tenant',
      market: 'NG',
      category: 'beverage',
      channel: 'marketplace',
      version: 2,
      status: 'approved',
      reason: 'Expired approval',
      effectiveFrom: '2020-01-01',
      effectiveUntil: '2021-01-01',
    },
  ]);
  render(<EnrollmentView />);
  await screen.findByText(/Expired approval/);
  expect(
    (
      screen.getByRole('button', {
        name: 'Apply for enrollment',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
});

test('application conflict draft survives the required reload of current versions', async () => {
  let finishReload: (value: unknown) => void = () => {};
  state.request
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(
      new Error('Market revision changed; reload before saving')
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishReload = resolve;
        })
    );
  render(<EnrollmentView />);
  await screen.findByText('No applications yet.');
  fireEvent.change(screen.getByLabelText('Application statement'), {
    target: {
      value:
        'Draft worth preserving after another reviewer changes the version',
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply for enrollment' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Reload applications' }));
  await waitFor(() => expect(state.request).toHaveBeenCalledTimes(3));
  expect(
    (
      screen.getByRole('button', {
        name: 'Apply for enrollment',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(
    (screen.getByLabelText('Application statement') as HTMLTextAreaElement)
      .value
  ).toBe('Draft worth preserving after another reviewer changes the version');
  finishReload([
    {
      _id: 'current',
      tenant: 'own-tenant',
      market: 'NG',
      category: 'beverage',
      channel: 'marketplace',
      version: 3,
      status: 'rejected',
      reason: 'Another review',
      statement: 'Prior application',
    },
  ]);
  await screen.findByText(/Another review/);
  expect(
    (screen.getByLabelText('Application statement') as HTMLTextAreaElement)
      .value
  ).toBe('Draft worth preserving after another reviewer changes the version');
});

test('platform policy summary exposes saved exclusive merchant and exception identities for review', async () => {
  state.role = 'super_admin';
  state.request.mockImplementation(async (_token: string, path: string) =>
    path === '/market-policies'
      ? [
          {
            _id: 'policy',
            market: 'NG',
            category: 'beverage',
            channel: 'marketplace',
            mode: 'exclusive',
            version: 4,
            exclusiveTenant: '507f1f77bcf86cd799439011',
            exceptions: ['507f1f77bcf86cd799439012'],
            effectiveFrom: '2030-01-01T00:00:00Z',
            effectiveUntil: '2031-01-01T00:00:00Z',
            contractReference: 'Reviewed agreement',
          },
        ]
      : []
  );
  render(<EnrollmentView />);
  expect(
    await screen.findByText('Exclusive merchant: 507f1f77bcf86cd799439011')
  ).toBeTruthy();
  expect(
    screen.getByText('Exception merchants: 507f1f77bcf86cd799439012')
  ).toBeTruthy();
});
