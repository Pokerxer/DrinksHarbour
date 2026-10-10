// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { useWarehouseTransferPrefill } from './use-warehouse-transfer-prefill';
import { planningRequest } from '@/services/notificationInsights.service';
const a = 'a'.repeat(24),
  b = 'b'.repeat(24),
  p = 'c'.repeat(24),
  s = 'd'.repeat(24);
vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams(
      `warehouseRecommendation=1&sourceWarehouseId=${a}&destinationWarehouseId=${b}&subProductId=${p}&sizeId=${s}&quantity=8&coverDays=14`
    ),
}));
vi.mock('@/services/notificationInsights.service', () => ({
  planningRequest: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
const plan = {
  generatedAt: 'now',
  coverDays: 14,
  warehouses: [],
  warnings: [],
  lines: [
    {
      key: `${p}:${s}:${b}`,
      subProductId: p,
      sizeId: s,
      warehouseId: b,
      productName: 'Drink',
      sku: 'D',
      sizeName: 'Bottle',
      warehouseName: 'Store',
      transferPlan: {
        basis: 'configured_minimum',
        nextStep: 'transfer_review',
        needUnits: 10,
        pendingUnits: 0,
        additionalUnits: 10,
        uncoveredUnits: 0,
        outboundUnits: 0,
        protectedUnits: 10,
        availableAfterCommitments: 0,
        pending: [],
        usualSources: [],
        sources: [
          {
            sourceWarehouseId: a,
            sourceWarehouseName: 'Hub',
            deliveries: 0,
            netUnits: 0,
            lastReceivedAt: null,
            typicalTransitDays: null,
            usualSource: false,
            safeSurplus: 10,
            protectedUnits: 10,
            outboundUnits: 0,
            needsManualReview: true,
            recommendedUnits: 10,
          },
        ],
      },
    },
  ],
};
it('prepares exact identities with current source prices and never creates a transfer', async () => {
  vi.mocked(planningRequest).mockResolvedValue(
    plan as Awaited<ReturnType<typeof planningRequest>>
  );
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        {
          currentQuantity: 50,
          reservedQuantity: 5,
          subProduct: { _id: p, costPrice: 4 },
          size: { _id: s, costPrice: 5, wholesalePrice: 7, unitsPerPack: 12 },
        },
      ],
    }),
  });
  vi.stubGlobal('fetch', fetch);
  const load = vi.fn(),
    reset = vi.fn();
  const { result } = renderHook(() =>
    useWarehouseTransferPrefill('token', 'u:t', false, load, reset)
  );
  await waitFor(() => expect(load).toHaveBeenCalledOnce());
  expect(result.current.error).toBe('');
  expect(load.mock.calls[0][0]).toMatchObject({
    quantity: 8,
    unitCost: 5,
    packSize: 12,
    sourceWarehouseId: a,
    destinationWarehouseId: b,
  });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][1].method).toBeUndefined();
});
it('clears stale fields and blocks prefill when the allocation changes', async () => {
  vi.mocked(planningRequest).mockResolvedValue({
    ...plan,
    lines: [],
  } as Awaited<ReturnType<typeof planningRequest>>);
  const load = vi.fn(),
    reset = vi.fn();
  const { result } = renderHook(() =>
    useWarehouseTransferPrefill('token', 'u:t', false, load, reset)
  );
  await waitFor(() => expect(result.current.error).toMatch(/changed/));
  expect(load).not.toHaveBeenCalled();
  expect(reset).toHaveBeenCalledOnce();
});
