import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ path: '/accounting', status: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-pathname': mocks.path }) }));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedUser: async () => ({ role: 'tenant_owner', token: 'token' }) }));
vi.mock('@/services/erm.service', () => ({ getErmStatus: mocks.status }));
vi.mock('@/components/read-only-banner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('@/context/LiveErmTenant', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/app/shared/upgrade-required/upgrade-required', () => ({ default: () => <p>Upgrade required</p> }));
import AccessTemplate from './template';
const render = async () => renderToStaticMarkup(await AccessTemplate({ children: <p>Private module</p> }));
beforeEach(() => { mocks.path = '/accounting'; mocks.status.mockReset(); });
test('live upgrade opens the module', async () => {
  mocks.status.mockResolvedValue({ plan: 'pro', capabilities: ['advanced_reports'], writesAllowed: true });
  expect(await render()).toContain('Private module');
});
test('custom negotiated capabilities override the default plan', async () => {
  mocks.status.mockResolvedValue({ plan: 'custom', capabilities: ['inventory'], writesAllowed: true });
  expect(await render()).not.toContain('Private module');
});
test('past-due preserves readable paid modules with the server warning', async () => {
  mocks.status.mockResolvedValue({ plan: 'pro', capabilities: ['advanced_reports'], subscriptionStatus: 'past_due', writesAllowed: false, entitlementMessage: 'Payment failed' });
  const html = await render();
  expect(html).toContain('Private module'); expect(html).toContain('Payment failed');
});
test('unavailable entitlements block paid modules without inventing an upgrade', async () => {
  mocks.status.mockResolvedValue(null);
  const html = await render();
  expect(html).toContain('Unable to check'); expect(html).not.toContain('Private module');
});
test('billing recovery remains reachable during an outage', async () => {
  mocks.path = '/settings/billing'; mocks.status.mockResolvedValue(null);
  expect(await render()).toContain('Private module');
});
