// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PackagesEditor from './packages-editor';
import type { PackageDTO } from '@/services/venue/packages';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const row: PackageDTO = {
  id: 'pkg1',
  locationId: 'loc1',
  occurrenceId: null,
  name: 'VIP Booth',
  active: true,
  version: 0,
  packageLine: { subProductId: 'sub1', sizeId: 'size1' },
  components: [{ subProductId: 'sub2', sizeId: 'size2', quantity: 2 }, { subProductId: 'sub3', sizeId: 'size3', quantity: 1 }],
  includedAdmissions: 6,
  tablePlan: { seatCount: 6 },
  createdAt: '2026-11-01T10:00:00.000Z',
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const catalog = [
  { id: 'sub1', name: 'Platinum Night', sizes: [{ id: 'size1', name: 'Table' }] },
  { id: 'sub2', name: 'House red', sizes: [{ id: 'size2', name: '750ml' }] },
];

it('lists active packages with component/admission/seat facts', async () => {
  const f = vi.fn(async () => jsonResponse({ items: [row], next: null }));
  vi.stubGlobal('fetch', f);
  render(<PackagesEditor token="t" locationId="loc1" catalog={catalog} />);
  expect(await screen.findByText(/vip booth/i)).toBeTruthy();
  expect(screen.getByText(/2 components · 6 included admissions · ≥6 seats/i)).toBeTruthy();
  expect(screen.getAllByText(/active/i).length).toBe(1);
});

it('creates a version-0 definition carrying line, component, admissions and seat plan', async () => {
  let listResponses = 0;
  const f = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    if (method === 'POST') {
      const body = JSON.parse((options as RequestInit).body as string) as { input: { name: string; packageSubProductId: string; sizeId: string; components: unknown[]; includedAdmissions: number; tablePlan: { seatCount: number } } };
      expect(body.input.name).toBe('Gold Booth');
      expect(body.input.packageSubProductId).toBe('sub1');
      expect(body.input.sizeId).toBe('size1');
      expect(body.input.components).toEqual([{ subProductId: 'sub2', sizeId: 'size2', quantity: 2 }]);
      expect(body.input.tablePlan).toEqual({ seatCount: 4 });
      return jsonResponse({ ...row, id: 'pkg2', name: 'Gold Booth', tablePlan: { seatCount: 4 } });
    }
    if (String(url).includes('/api/venue-ops/locations/loc1/packages')) listResponses += 1;
    return jsonResponse({ items: [row], next: null });
  });
  vi.stubGlobal('fetch', f);
  render(<PackagesEditor token="t" locationId="loc1" catalog={catalog} />);
  fireEvent.change(await screen.findByLabelText(/package name/i), { target: { value: 'Gold Booth' } });
  fireEvent.change(screen.getByLabelText(/sellable package line/i), { target: { value: 'sub1' } });
  fireEvent.change(screen.getByLabelText(/package size/i), { target: { value: 'size1' } });
  fireEvent.change(screen.getByLabelText(/included component/i), { target: { value: 'sub2' } });
  fireEvent.change(screen.getByLabelText(/component size/i), { target: { value: 'size2' } });
  fireEvent.change(screen.getByLabelText(/seats to reserve/i), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: /create package/i }));
  await waitFor(() => expect(f.mock.calls.some(([, options]) => (options as RequestInit).method === 'POST')).toBe(true));
  const post = f.mock.calls.find(([, options]) => (options as RequestInit).method === 'POST') as [string, RequestInit];
  expect(post[0]).toContain('/api/venue-ops/locations/loc1/packages');
});

it('deactivates with the row version; server codes surface with the message', async () => {
  const f = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    if (method === 'PATCH') {
      const body = JSON.parse((options as RequestInit).body as string) as { expectedVersion: number; input: { active: boolean } };
      expect(body.expectedVersion).toBe(0);
      expect(body.input.active).toBe(false);
      throw Object.assign(new Error('The reservation pool needs reconciliation'), { code: 'STOCK_REVIEW_REQUIRED' });
    }
    return jsonResponse({ items: [row], next: null });
  });
  vi.stubGlobal('fetch', f);
  render(<PackagesEditor token="t" locationId="loc1" catalog={catalog} />);
  fireEvent.click(await screen.findByRole('button', { name: /deactivate/i }));
  expect(await screen.findByText(/stock_review_required/i)).toBeTruthy();
});
