import { afterEach, expect, test, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NextRequest } from 'next/server';
vi.mock('next-auth/middleware', () => ({ default: (handler: unknown) => handler }));
vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));
import middleware, { config } from './middleware';

function request(path: string, role = 'tenant_owner', tenantId: string | null = 'shop') {
  const req = new NextRequest(`http://localhost:3000${path}`);
  Object.assign(req, { nextauth: { token: { role, tenantId, tenantSlug: 'shop', plan: 'free_trial' } } });
  return req;
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
test('staff inventory navigation uses fresh grants and fails closed on lookup errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { customPermissions: ['inventory:read'] } }) }));
  expect((await middleware(request('/inventory', 'tenant_staff'))).status).toBe(200);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  expect((await middleware(request('/inventory', 'tenant_staff'))).headers.get('location')).toContain('/access-denied');
});
test('cached free-trial plan never blocks live upgrade verification', async () => {
  const res = await middleware(request('/accounting'));
  expect(res.status).toBe(200);
  expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/accounting');
});
test('staff role is refused before reaching employee administration', async () => {
  expect((await middleware(request('/employees', 'tenant_staff'))).headers.get('location')).toContain('/access-denied');
});
test('tenant identity is required across every business module', async () => {
  expect((await middleware(request('/accounting', 'tenant_owner', null))).headers.get('location')).toContain('/access-denied');
});
test('production query parameters cannot select another tenant', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const res = await middleware(request('/settings?_tenant=other'));
  expect(res.status).toBe(200);
  expect(res.headers.get('x-middleware-request-x-tenant-slug')).toBeNull();
});
test('all actual business pages, including nested POS pages, have session middleware', () => {
  const root = join(process.cwd(), 'src/app');
  function pages(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? pages(join(dir, entry.name)) : entry.name === 'page.tsx' ? [join(dir, entry.name)] : []);
  }
  const business = pages(root).map(file => relative(root, file)).filter(file =>
    file.startsWith('(hydrogen)/') || file.startsWith('(print)/') || file.startsWith('pos/'));
  const missing = business.filter(file => {
    const path = '/' + file.split('/').filter(part => !part.startsWith('(')).slice(0, -1).join('/');
    return !config.matcher.some(pattern => {
      const prefix = pattern.replace('/:path*', '');
      return path === pattern || pattern.endsWith('/:path*') && (path === prefix || path.startsWith(prefix + '/'));
    });
  });
  expect(business.length).toBeGreaterThan(100);
  expect(missing).toEqual([]);
  expect(config.matcher.some(p => p.startsWith('/kiosk'))).toBe(false);
  expect(config.matcher.some(p => p.startsWith('/scan'))).toBe(false);
});
test('stale session retains document options on the sign-in return link', async () => {
  const req = request('/sales/123/print?type=proforma');
  req.cookies.set('next-auth.session-token', 'stale');
  const response = await middleware(req);
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/signin');
  expect(location.searchParams.get('callbackUrl')).toBe('/sales/123/print?type=proforma');
});
