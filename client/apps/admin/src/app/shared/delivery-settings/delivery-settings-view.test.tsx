// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
const state = vi.hoisted(() => ({
  request: vi.fn(),
  role: 'super_admin',
  token: 'signed',
}));
vi.mock('@/hooks/use-authorization', () => ({
  useAuthorization: () => ({
    user: { token: state.token },
    role: state.role,
    permissions: ['settings:write'],
  }),
}));
vi.mock('@/services/delivery-settings.service', () => ({
  deliverySettingsRequest: state.request,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.role = 'super_admin';
  state.token = 'signed';
});
const location = {
  _id: 'origin',
  tenant: 'merchant',
  name: 'Origin',
  code: 'ORIGIN',
  tenantName: 'Merchant',
};
const configuration = {
  location,
  state: 'unavailable',
  creationEnabled: false,
  latest: null,
  contracts: [],
  pagination: { page: 1, pages: 0, total: 0, limit: 10 },
};
async function view() {
  const imported = await import('./delivery-settings-view').catch(() => ({
    default: undefined,
  }));
  expect(imported.default).toBeTypeOf('function');
  return render(imported.default ? <imported.default /> : null);
}
function reads() {
  state.request.mockImplementation(async (_token: string, path: string) =>
    path.startsWith('/configuration/locations')
      ? { locations: [location], pagination: { page: 1, pages: 1, total: 1 } }
      : configuration
  );
}
function completeReviewDraft() {
  fireEvent.change(screen.getByLabelText('Accepted charge (kobo)'), {
    target: { value: '1500' },
  });
  fireEvent.change(screen.getByLabelText('Maximum units'), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByLabelText('Maximum weight (grams)'), {
    target: { value: '5000' },
  });
  fireEvent.change(screen.getByLabelText('Valid until'), {
    target: { value: '2035-01-01T12:00' },
  });
  fireEvent.change(screen.getByLabelText('Review evidence'), {
    target: { value: 'Explicit synthetic reviewed evidence' },
  });
  for (const [label, value] of [
    ['State', 'FCT'],
    ['City', 'Abuja'],
    ['Minimum latitude', '9'],
    ['Maximum latitude', '9.1'],
    ['Minimum longitude', '7.3'],
    ['Maximum longitude', '7.5'],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText('Country'), {
    target: { value: 'Nigeria' },
  });
  fireEvent.click(screen.getByLabelText('bike'));
  fireEvent.change(screen.getByLabelText('Alcohol handling'), {
    target: { value: 'no' },
  });
  fireEvent.change(screen.getByLabelText('Age verification'), {
    target: { value: 'no' },
  });
  fireEvent.change(screen.getByLabelText('Fragile handling'), {
    target: { value: 'yes' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review exact terms' }));
}
test('platform workspace selects a saved location and requires exact explicit review confirmation', async () => {
  reads();
  await view();
  fireEvent.change(await screen.findByLabelText('Location'), {
    target: { value: 'origin' },
  });
  await screen.findByText('No reviewed delivery terms');
  completeReviewDraft();
  expect(screen.getByText(/NGN 15.00/)).toBeTruthy();
  expect(state.request.mock.calls.some((c) => c[2] === 'POST')).toBe(false);
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm reviewed terms' })
  );
  await waitFor(() =>
    expect(
      state.request.mock.calls.some(
        (c) => c[1] === '/contracts' && c[2] === 'POST'
      )
    ).toBe(true)
  );
  const body = state.request.mock.calls.find((c) => c[1] === '/contracts')?.[3];
  expect(body).toMatchObject({
    tenant: 'merchant',
    location: 'origin',
    version: 1,
    amountMinor: 1500,
    capabilities: { alcohol: false, ageVerification: false, fragile: true },
    coverage: [expect.objectContaining({ country: 'Nigeria' })],
  });
});
test('tenant cannot request configuration', async () => {
  state.role = 'tenant_owner';
  await view();
  expect(screen.getByRole('alert').textContent).toContain('Platform');
  expect(state.request).not.toHaveBeenCalled();
});
test('switching sessions immediately removes the previous location', async () => {
  reads();
  const mounted = await view();
  fireEvent.change(await screen.findByLabelText('Location'), {
    target: { value: 'origin' },
  });
  await screen.findByText('No reviewed delivery terms');
  state.token = 'second';
  state.request.mockImplementation(() => new Promise(() => {}));
  const View = (await import('./delivery-settings-view')).default;
  mounted.rerender(<View />);
  expect(screen.queryByText('No reviewed delivery terms')).toBeNull();
});
test('exact saved review revocation requires confirmation and duplicate clicks cannot submit twice', async () => {
  const contract = {
    _id: 'immutable-review',
    tenant: 'merchant',
    location: 'origin',
    version: 3,
    currency: 'NGN',
    status: 'reviewed',
    amountMinor: 1500,
    maxUnits: 4,
    maxWeightGrams: 5000,
    vehicleTypes: ['bike'],
    capabilities: { alcohol: false, ageVerification: false, fragile: true },
    coverage: [],
    reviewReference: 'Saved review evidence',
    reviewedAt: '2035-01-01',
    validUntil: '2035-02-01',
  };
  let finish: (() => void) | undefined;
  state.request.mockImplementation(
    async (_token: string, path: string, method: string) => {
      if (method === 'POST') {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return {};
      }
      return path.startsWith('/configuration/locations')
        ? { locations: [location], pagination: { page: 1, pages: 1 } }
        : {
            ...configuration,
            state: 'reviewed',
            latest: contract,
            contracts: [contract],
          };
    }
  );
  await view();
  fireEvent.change(await screen.findByLabelText('Location'), {
    target: { value: 'origin' },
  });
  fireEvent.click(
    await screen.findByRole('button', { name: 'Revoke version 3' })
  );
  expect(state.request.mock.calls.filter((c) => c[2] === 'POST')).toHaveLength(
    0
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirm revocation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm revocation' }));
  expect(state.request.mock.calls.filter((c) => c[2] === 'POST')).toHaveLength(
    1
  );
  expect(state.request.mock.calls.find((c) => c[2] === 'POST')?.[1]).toBe(
    '/contracts/immutable-review/revoke'
  );
  finish?.();
  await screen.findByText('Saved. Refreshing reviewed terms.');
});
test('a late response for an abandoned location cannot display that review', async () => {
  let complete: ((value: unknown) => void) | undefined;
  state.request.mockImplementation(async (_token: string, path: string) =>
    path.startsWith('/configuration/locations')
      ? {
          locations: [location, { ...location, _id: 'second', name: 'Second' }],
          pagination: { page: 1, pages: 1 },
        }
      : path.includes('/origin?')
        ? new Promise((resolve) => {
            complete = resolve;
          })
        : configuration
  );
  await view();
  fireEvent.change(await screen.findByLabelText('Location'), {
    target: { value: 'origin' },
  });
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  fireEvent.change(screen.getByLabelText('Location'), {
    target: { value: 'second' },
  });
  await screen.findByText('No reviewed delivery terms');
  complete?.({ ...configuration, state: 'revoked' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText('Current review: revoked')).toBeNull();
});

test('unknown review result preserves exact proposal version after an explicit refresh', async () => {
  let discovered = false;
  state.request.mockImplementation(
    async (_token: string, path: string, method: string) => {
      if (method === 'POST') throw new Error('Connection lost');
      if (path.startsWith('/configuration/locations'))
        return { locations: [location], pagination: { page: 1, pages: 1 } };
      return discovered
        ? { ...configuration, state: 'reviewed', latest: { version: 1 } }
        : configuration;
    }
  );
  await view();
  fireEvent.change(await screen.findByLabelText('Location'), {
    target: { value: 'origin' },
  });
  await screen.findByText('No reviewed delivery terms');
  completeReviewDraft();
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm reviewed terms' })
  );
  await screen.findByRole('alert');
  expect(
    screen.getByRole('region', { name: 'Confirm review' }).textContent
  ).toContain('version 1');
  discovered = true;
  fireEvent.click(
    screen.getByRole('button', { name: 'Refresh reviewed terms' })
  );
  await screen.findByText('Current review: reviewed');
  expect(state.request.mock.calls.filter((c) => c[2] === 'POST')).toHaveLength(
    1
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm reviewed terms' })
  );
  await waitFor(() =>
    expect(
      state.request.mock.calls.filter((c) => c[2] === 'POST')
    ).toHaveLength(2)
  );
  expect(
    state.request.mock.calls
      .filter((c) => c[2] === 'POST')
      .map((c) => c[3].version)
  ).toEqual([1, 1]);
});

test('a failed location read offers retry and recovers without reloading the page', async () => {
  state.request.mockRejectedValueOnce(new Error('Locations unavailable'));
  await view();
  await screen.findByText('Locations unavailable');
  reads();
  fireEvent.click(screen.getByRole('button', { name: 'Retry locations' }));
  await screen.findByLabelText('Location');
  expect(screen.queryByText('Locations unavailable')).toBeNull();
});
