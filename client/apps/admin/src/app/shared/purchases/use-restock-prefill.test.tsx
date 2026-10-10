// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { useRestockPrefill } from './use-restock-prefill';
import { planningRequest } from '@/services/notificationInsights.service';
vi.mock('@/services/notificationInsights.service', () => ({
  planningRequest: vi.fn(),
}));
it('clears prepared fields and blocks save when the tenant changes', async () => {
  window.history.replaceState({}, '', '?restock=1');
  const onLoad = vi.fn(),
    onReset = vi.fn();
  const { result, rerender } = renderHook(
    ({ scope }) => useRestockPrefill('token', scope, onLoad, onReset),
    { initialProps: { scope: 'u:t' } }
  );
  await waitFor(() => expect(result.current.error).toMatch(/expired/));
  expect(onReset).toHaveBeenCalledTimes(1);
  rerender({ scope: 'u:other' });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(onReset).toHaveBeenCalledTimes(2));
  expect(onLoad).not.toHaveBeenCalled();
  expect(planningRequest).not.toHaveBeenCalled();
});
