import { describe, it, expect, vi } from 'vitest';
import { salesOrderService } from '@/services/salesOrder.service';
import { loadReturnOrders } from './load-return-orders';
vi.mock('@/services/salesOrder.service', () => ({ salesOrderService: { list: vi.fn() } }));
describe('return order history', () => {
  it('reports an incomplete page rather than looping or presenting partial history', async () => {
    vi.mocked(salesOrderService.list).mockReset().mockImplementation(async (_token, params) => {
      if (Number(params?.page) > 1) throw new Error('Unexpected extra request');
      return { success: true, data: [], pagination: { currentPage: 1, totalPages: 2, hasNextPage: true } };
    });
    await expect(loadReturnOrders('token')).rejects.toThrow(/incomplete/i);
  });
  it('loads later pages and requests returns made in either Sales or POS', async () => {
    const list = vi.mocked(salesOrderService.list);
    list.mockReset();
    list.mockImplementation(async (_token, params) => ({
      success: true,
      data: [{ _id: `${params?.status}-${params?.page}` }] as never,
      pagination: { currentPage: Number(params?.page), totalPages: 2, hasNextPage: params?.page === 1 },
    }));
    const orders = await loadReturnOrders('token');
    expect(orders.map(order => order._id)).toEqual(['fulfilled-1','fulfilled-2','partially_fulfilled-1','partially_fulfilled-2']);
    expect(list).toHaveBeenCalledTimes(4);
    for (const [,params] of list.mock.calls) expect(params?.includeReturns).toBe('1');
  });
});
