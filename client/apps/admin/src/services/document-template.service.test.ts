import { afterEach, expect, it, vi } from 'vitest';
import { documentPreferences } from './document-template.service';
afterEach(() => vi.unstubAllGlobals());
it('persists scoped preferences as JSON and returns the stored response', async () => {
  const saved = { version: 1, defaultTemplate: 'signature', families: { stock: 'ledger' } };
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, data: saved })));
  vi.stubGlobal('fetch', fetcher);
  expect(
    await documentPreferences('token', 'tenant-shop', {
      defaultTemplate: 'signature',
      families: { stock: 'ledger' },
    })
  ).toEqual(saved);
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain('/api/tenants/document-templates');
  expect(init.method).toBe('PUT');
  expect(init.headers).toMatchObject({
    Authorization: 'Bearer token',
    'x-tenant-slug': 'tenant-shop',
  });
  expect(JSON.parse(init.body as string)).toEqual({
    defaultTemplate: 'signature',
    families: { stock: 'ledger' },
  });
});
it('propagates failed requests instead of silently substituting a default', async () => {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ message: 'Tenant access denied' }), { status: 403 })
  );
  await expect(documentPreferences('token')).rejects.toThrow('Tenant access denied');
});
