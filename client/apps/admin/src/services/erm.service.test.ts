import { afterEach, expect, test, vi } from 'vitest';
import { cancelSubscription, getErmStatus } from './erm.service';
afterEach(() => vi.unstubAllGlobals());
test('cancellation reports a rejected request instead of false success', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: 'Billing manager required' }),
    }))
  );
  await expect(cancelSubscription('token')).rejects.toThrow(
    'Billing manager required'
  );
});
test('a non-JSON cancellation failure still produces a useful error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => {
        throw new Error('invalid json');
      },
    }))
  );
  await expect(cancelSubscription('token')).rejects.toThrow(
    'Failed to cancel subscription'
  );
});
test('status network failures return unavailable without crashing the dashboard', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    })
  );
  await expect(getErmStatus('token')).resolves.toBeNull();
});

test('pending plan lookup reports HTTP failures instead of enabling competing changes', async () => {
  const { getPendingPlanChange } = await import('./erm.service');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: 'Temporarily unavailable' }),
    }))
  );
  await expect(getPendingPlanChange('token')).rejects.toThrow(
    'Temporarily unavailable'
  );
});
test('pending plan lookup distinguishes no scheduled change', async () => {
  const { getPendingPlanChange } = await import('./erm.service');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: null }) }))
  );
  await expect(getPendingPlanChange('token')).resolves.toBeNull();
});
