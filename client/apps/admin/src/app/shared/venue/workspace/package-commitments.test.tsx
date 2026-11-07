// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PackageCommitments from './package-commitments';
import type { CommitmentDTO, PackageDTO } from '@/services/venue/packages';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const listing: PackageDTO = {
  id: 'pkg9', locationId: 'loc1', occurrenceId: null, name: 'VIP Booth', active: true, version: 0,
  packageLine: { subProductId: 'sub1', sizeId: 'size1' },
  components: [{ subProductId: 'sub2', sizeId: 'size2', quantity: 3 }],
  includedAdmissions: 2, tablePlan: { tableIds: ['tab1'] }, createdAt: null,
};

const committed: CommitmentDTO = {
  id: 'cmt1', locationId: 'loc1', occurrenceId: null, packageId: 'pkg9', name: 'VIP Booth',
  state: 'committed', version: 0,
  components: [{ subProductId: 'sub2', sizeId: 'size2', quantity: 3 }],
  includedAdmissions: 2, tablePlan: { tableIds: ['tab1'] }, tableClaimId: null,
  tableResourceIds: ['tab1'], admissionEntitlementId: null,
  stockReservations: [{ subProductId: 'sub2', sizeId: 'size2', quantity: 3, consumed: 1, batchCount: 0 }],
  businessDate: '2026-11-02', releasedAt: null, createdAt: null,
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function fetcher(over: { error?: { code: string; message: string } } = {}) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    const path = String(url);
    if (method === 'POST' && path.includes('/package-commitments/cmt1/redeem')) {
      const body = JSON.parse((options as RequestInit).body as string) as { input: { componentIndex: number; quantity: number } };
      expect(body.input.componentIndex).toBe(0);
      expect(body.input.quantity).toBe(1);
      if (over.error) throw Object.assign(new Error(over.error.message), { code: over.error.code });
      return jsonResponse({ id: 'r1', commitmentId: 'cmt1', componentIndex: 0, quantity: 1, sequence: 2, at: null, by: 'staff-1' });
    }
    if (method === 'POST' && path.includes('/package-commitments/cmt1/release')) {
      if (over.error) throw Object.assign(new Error(over.error.message), { code: over.error.code });
      return jsonResponse({ ...committed, state: 'released', version: 1 });
    }
    if (method === 'POST' && path.includes('/package-commitments')) {
      const body = JSON.parse((options as RequestInit).body as string) as { input: { packageId: string; expectedVersion: number; bookingAt: string | null } };
      expect(body.input.packageId).toBe('pkg9');
      expect(body.input.expectedVersion).toBe(0);
      if (body.input.bookingAt) expect(body.input.bookingAt.endsWith('Z')).toBe(true);
      return jsonResponse(committed);
    }
    if (path.includes('/package-commitments')) return jsonResponse({ items: [committed], next: null });
    return jsonResponse({ items: [listing], next: null });
  });
}

it('lists commitments with state, admission count and served quantities; commit posts the version-checked input', async () => {
  const f = fetcher();
  vi.stubGlobal('fetch', f);
  render(<PackageCommitments token="t" locationId="loc1" />);
  const boothRows = await screen.findAllByText(/vip booth/i); // dropdown option + committed row
  expect(boothRows.length).toBeGreaterThan(0);
  expect(screen.getByText(/#1 × 3 \(served 1\)/i)).toBeTruthy(); // tracked hand-out ledger detail
  fireEvent.change(screen.getByLabelText('Package'), { target: { value: 'pkg9' } });
  fireEvent.click(screen.getByRole('button', { name: /commit/i }));
  await waitFor(() => expect(f.mock.calls.some(([, o]) => (o as RequestInit).method === 'POST')).toBe(true));
});

it('serves one tracked unit through the commitment redeem route; release posts the release route', async () => {
  const f = fetcher();
  vi.stubGlobal('fetch', f);
  render(<PackageCommitments token="t" locationId="loc1" />);
  fireEvent.click(await screen.findByRole('button', { name: /serve 1/i }));
  await waitFor(() => expect(f.mock.calls.some(([url, options]) => (options as RequestInit).method === 'POST' && String(url).includes('/redeem'))).toBe(true));
  fireEvent.click(await screen.findByRole('button', { name: /release/i }));
  await waitFor(() => expect(f.mock.calls.some(([url, options]) => (options as RequestInit).method === 'POST' && String(url).includes('/release'))).toBe(true));
  const releaseCall = f.mock.calls.find(([url, options]) => (options as RequestInit).method === 'POST' && String(url).includes('/release')) as [string, RequestInit];
  expect(releaseCall[0]).toContain('/api/venue-ops/locations/loc1/package-commitments/cmt1/release');
});

it('renders the server domain code (COMPONENT_EXHAUSTED) beside the message', async () => {
  const f = fetcher({ error: { code: 'COMPONENT_EXHAUSTED', message: 'This component was included 3× in the package' } });
  vi.stubGlobal('fetch', f);
  render(<PackageCommitments token="t" locationId="loc1" />);
  fireEvent.click(await screen.findByRole('button', { name: /serve 1/i }));
  expect(await screen.findByText(/component_exhausted/i)).toBeTruthy();
});
