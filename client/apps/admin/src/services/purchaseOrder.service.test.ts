// services/purchaseOrder.service.test.ts — the PO destination-warehouse readers.
//
// A PO's `warehouse` comes back populated ({_id, name, code}) from getPurchaseOrder but
// raw (a string id) from create/update. Every screen that seeds a picker from it has to
// handle both, so both readings live here rather than being re-derived per component.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  warehouseIdOf,
  warehouseLabelOf,
  purchaseOrderService,
} from './purchaseOrder.service';

describe('warehouseIdOf', () => {
  it('reads a populated warehouse', () => {
    expect(warehouseIdOf({ _id: 'wh1', name: 'Main', code: 'MN' })).toBe('wh1');
  });

  it('reads a raw id', () => {
    expect(warehouseIdOf('wh1')).toBe('wh1');
  });

  it('returns "" for an absent destination so a <select> stays controlled', () => {
    // undefined/null into a select's value would flip it to uncontrolled and React
    // would warn on the first user pick.
    expect(warehouseIdOf(undefined)).toBe('');
    expect(warehouseIdOf(null)).toBe('');
    expect(warehouseIdOf('')).toBe('');
  });

  it('returns "" for a populated ref that somehow lost its _id', () => {
    expect(warehouseIdOf({} as { _id: string })).toBe('');
  });
});

describe('warehouseLabelOf', () => {
  it('renders name and code together', () => {
    expect(warehouseLabelOf({ _id: 'wh1', name: 'Main', code: 'MN' })).toBe(
      'Main (MN)'
    );
  });

  it('drops the parenthetical when there is no code', () => {
    expect(warehouseLabelOf({ _id: 'wh1', name: 'Main' })).toBe('Main');
  });

  it('has no label for an unpopulated id — the caller shows a dash', () => {
    // A bare id must never be rendered as if it were a name.
    expect(warehouseLabelOf('wh1')).toBe('');
    expect(warehouseLabelOf(undefined)).toBe('');
    expect(warehouseLabelOf('wh1')).toBe('');
  });
});

describe('purchaseOrderService.getAllPurchaseOrders', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown) {
    return {
      ok: true,
      json: async () => body,
    } as unknown as Response;
  }

  it('walks every page so analysis is never silently capped at one page size', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const page = new URL(url).searchParams.get('page');
      if (page === '1')
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: [{ _id: 'po1' }],
            pagination: { currentPage: 1, totalPages: 2, totalCount: 2 },
          })
        );
      return Promise.resolve(
        jsonResponse({
          success: true,
          data: [{ _id: 'po2' }],
          pagination: { currentPage: 2, totalPages: 2, totalCount: 2 },
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await purchaseOrderService.getAllPurchaseOrders('tok');

    expect(res.orders.map((o) => o._id)).toEqual(['po1', 'po2']);
    expect(res.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('page=1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('limit=500');
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2');
  });

  it('flags truncation instead of lying when the safety cap is hit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: [{ _id: `po-page` }],
        pagination: { currentPage: 1, totalPages: 9, totalCount: 4500 },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await purchaseOrderService.getAllPurchaseOrders('tok', {
      maxPages: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.truncated).toBe(true);
  });

  it('stops early when a page returns fewer rows than promised', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: [], pagination: undefined })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await purchaseOrderService.getAllPurchaseOrders('tok');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.orders).toEqual([]);
    expect(res.truncated).toBe(false);
  });

  it('propagates server errors with the API message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Not allowed' }),
      } as unknown as Response)
    );

    await expect(
      purchaseOrderService.getAllPurchaseOrders('tok')
    ).rejects.toThrow('Not allowed');
  });
});
