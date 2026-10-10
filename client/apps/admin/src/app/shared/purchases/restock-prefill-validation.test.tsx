// @vitest-environment jsdom
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { useRestockPrefill, forgetRestockDraft } from './use-restock-prefill';
import {
  planningRequest,
  type InsightPlan,
} from '@/services/notificationInsights.service';
import { draftKey } from '../notifications/vendor-orders/order-draft';
vi.mock('@/services/notificationInsights.service', () => ({
  planningRequest: vi.fn(),
}));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});
const item = {
  key: 'p:s:w',
  offerId: 'o',
  subProductId: 'p',
  sizeId: 's',
  productName: 'Old name',
  sku: 'old',
  sizeName: 'Old size',
  quantity: 12,
  packSize: 6,
  packQty: 2,
  unitPrice: 100,
  packPrice: 600,
  type: 'unit',
  uom: 'Old pack',
  taxRate: 0,
};
const plan = {
  canPurchase: true,
  lines: [
    {
      key: 'p:s:w',
      subProductId: 'p',
      sizeId: 's',
      warehouseId: 'w',
      productName: 'Current wine',
      sku: 'NEW',
      sizeName: '75cl',
      alternatives: [
        {
          offerId: 'o',
          vendorId: 'v',
          vendorName: 'Current supplier',
          currency: 'NGN',
          unitPrice: 120,
          packagingQty: 6,
          packaging: 'Carton',
          minQuantity: 1,
          maxQuantity: null,
        },
      ],
    },
  ],
} as InsightPlan;
function seed() {
  window.history.replaceState({}, '', '?restock=1');
  sessionStorage.setItem(
    draftKey('u:t'),
    JSON.stringify({
      scope: 'u:t',
      createdAt: Date.now(),
      coverDays: 14,
      vendorId: 'v',
      vendorName: 'Old supplier',
      currency: 'NGN',
      warehouseId: 'w',
      items: [item],
    })
  );
}
it('revoked purchase permission blocks a stored order from loading', async () => {
  seed();
  vi.mocked(planningRequest).mockResolvedValue({ ...plan, canPurchase: false });
  const load = vi.fn();
  const { result } = renderHook(() => useRestockPrefill('token', 'u:t', load));
  await waitFor(() =>
    expect(result.current.error).toMatch(/purchasing access/i)
  );
  expect(load).not.toHaveBeenCalled();
});
it('a stored product identity cannot masquerade as another current product', async () => {
  seed();
  vi.mocked(planningRequest).mockResolvedValue({
    ...plan,
    lines: [{ ...plan.lines[0], subProductId: 'other' }],
  });
  const load = vi.fn();
  const { result } = renderHook(() => useRestockPrefill('token', 'u:t', load));
  await waitFor(() => expect(result.current.error).toMatch(/changed/i));
  expect(load).not.toHaveBeenCalled();
});
it('prefill refreshes names, prices and packaging while preserving reviewed quantities', async () => {
  seed();
  vi.mocked(planningRequest).mockResolvedValue(plan);
  const load = vi.fn();
  const { result } = renderHook(() => useRestockPrefill('token', 'u:t', load));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.notice).toMatch(/1 product.*updated/i);
  expect(load.mock.calls[0]?.[0]).toMatchObject({
    vendorName: 'Current supplier',
    items: [
      {
        productName: 'Current wine',
        sku: 'NEW',
        sizeName: '75cl',
        uom: 'Carton',
        unitPrice: 120,
        packPrice: 720,
        quantity: 12,
      },
    ],
  });
});

it('successful purchase cleanup removes only its prepared order and tolerates unavailable storage', () => {
  seed();
  sessionStorage.setItem(draftKey('other:t'), 'keep');
  forgetRestockDraft('u:t');
  expect(sessionStorage.getItem(draftKey('u:t'))).toBeNull();
  expect(sessionStorage.getItem(draftKey('other:t'))).toBe('keep');
  const failure = vi
    .spyOn(Storage.prototype, 'removeItem')
    .mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
  expect(() => forgetRestockDraft('u:t')).not.toThrow();
  failure.mockRestore();
});
