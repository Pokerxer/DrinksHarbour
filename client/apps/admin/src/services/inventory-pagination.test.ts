import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService } from './inventory.service';
afterEach(() => vi.unstubAllGlobals());
it('loads all movement pages and preserves query scope', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      expect(params.get('startDate')).toBe('2026-10-01');
      const page = params.get('page');
      return {
        ok: true,
        json: async () => ({ data: { movements: [{ _id: page }], total: 2, totalPages: 2 } }),
      };
    }),
  );
  const result = await inventoryService.getAllMovements('token', { startDate: '2026-10-01' });
  expect(result.movements.map((m) => m._id)).toEqual(['1', '2']);
  expect(result.truncated).toBe(false);
});
it('reports incomplete history instead of silently capping it', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { movements: [{ _id: 'one' }], total: 1000, totalPages: 3 } }),
    })),
  );
  const result = await inventoryService.getAllMovements('token', {}, { maxPages: 1 });
  expect(result.truncated).toBe(true);
});
it('fails a later-page error rather than returning partial totals', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { movements: [{ _id: 'one' }], totalPages: 2, total: 2 } }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'History unavailable' }) }),
  );
  await expect(inventoryService.getAllMovements('token')).rejects.toThrow('History unavailable');
});
