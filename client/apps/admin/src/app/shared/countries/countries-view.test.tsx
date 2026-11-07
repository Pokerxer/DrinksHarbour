// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import CountriesView from './countries-view';
const state = vi.hoisted(() => ({ role: 'super_admin', request: vi.fn() }));
vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({ user: { token: 'token' }, role: state.role }),
}));
vi.mock('@/services/country.service', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  countryRequest: state.request,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.role = 'super_admin';
});
const config = {
  code: 'GB',
  name: 'United Kingdom',
  version: 1,
  active: false,
  locale: 'en-GB',
  currency: 'GBP',
  timezones: ['Europe/London'],
  capabilities: { marketplace: true, storefront: true, erm: true },
  readiness: {},
  revisions: [],
};
test('tenant admins cannot load private countries or see activation actions', () => {
  state.role = 'tenant_admin';
  render(<CountriesView />);
  expect(screen.getByText(/super-admin access is required/i)).toBeTruthy();
  expect(state.request).not.toHaveBeenCalled();
});
test('country readiness keeps activation disabled until every review exists', async () => {
  state.request.mockResolvedValue([config]);
  render(<CountriesView />);
  await screen.findByRole('button', { name: /United Kingdom/ });
  fireEvent.click(screen.getByRole('button', { name: /United Kingdom/ }));
  expect(
    screen
      .getByRole('button', { name: 'Activate country' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(
    screen.getAllByText('Not reviewed', { selector: 'span' })[0]
  ).toBeTruthy();
});
test('stale country write displays conflict and preserves the form', async () => {
  state.request
    .mockResolvedValueOnce([config])
    .mockRejectedValueOnce(new Error('Country changed; reload before saving'));
  render(<CountriesView />);
  fireEvent.click(
    await screen.findByRole('button', { name: /United Kingdom/ })
  );
  fireEvent.change(screen.getByLabelText('Reason for change'), {
    target: { value: 'Synthetic configuration edit' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Country changed; reload before saving'
    )
  );
  expect(
    (screen.getByLabelText('Country name') as HTMLInputElement).value
  ).toBe('United Kingdom');
});
