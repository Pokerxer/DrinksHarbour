// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { it, expect, vi, beforeEach } from 'vitest';
import { useInsightPlan } from './use-insight-plan';
import { planningRequest } from '@/services/notificationInsights.service';
let session = { user: { id: 'u', tenantId: 't', token: 'token' } };
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: session, status: 'authenticated' }),
}));
vi.mock('@/services/notificationInsights.service', () => ({
  planningRequest: vi.fn(),
}));
const plan = {
  generatedAt: 'now',
  lines: [],
  warehouses: [],
  warnings: [],
  coverDays: 14,
};
beforeEach(() => {
  session = { user: { id: 'u', tenantId: 't', token: 'token' } };
  vi.resetAllMocks();
});
it('loads real data and explicit refresh bypasses cache', async () => {
  vi.mocked(planningRequest).mockResolvedValue(plan);
  const { result } = renderHook(() => useInsightPlan('demand', 'coverDays=14'));
  await waitFor(() => expect(result.current.data?.generatedAt).toBe('now'));
  act(() => result.current.refresh());
  await waitFor(() =>
    expect(planningRequest).toHaveBeenLastCalledWith(
      'token',
      'demand',
      'coverDays=14',
      expect.any(AbortSignal),
      true
    )
  );
});
it('clears tenant data immediately when session identity changes', async () => {
  vi.mocked(planningRequest)
    .mockResolvedValueOnce(plan)
    .mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(() => useInsightPlan('demand', ''));
  await waitFor(() => expect(result.current.data).not.toBeNull());
  session = { user: { id: 'other', tenantId: 'other', token: 'new' } };
  rerender();
  expect(result.current.data).toBeNull();
});
it('failed reads disclose failure without inventing a forecast', async () => {
  vi.mocked(planningRequest).mockRejectedValue(new Error('No report access'));
  const { result } = renderHook(() => useInsightPlan('demand', ''));
  await waitFor(() => expect(result.current.error).toBe('No report access'));
  expect(result.current.data).toBeNull();
});
