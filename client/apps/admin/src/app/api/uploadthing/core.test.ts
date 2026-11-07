import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock('next-auth/next', () => ({ getServerSession }));
vi.mock('@/app/api/auth/[...nextauth]/auth-options', () => ({ authOptions: {} }));

import { ourFileRouter } from './core';

const profile = {
  _id: 'user-1', role: 'tenant_staff', status: 'active',
  tenant: { _id: 'trusted-tenant' },
};
const fetchProfile = vi.fn();
const upload = (route: keyof typeof ourFileRouter = 'avatar') =>
  Promise.resolve().then(() => ourFileRouter[route].middleware({
    req: new Request('http://localhost/api/uploadthing', {
      headers: { 'x-tenant-slug': 'untrusted-tenant' },
    }),
    files: [], input: undefined,
  }));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchProfile);
  getServerSession.mockResolvedValue({ user: { id: 'user-1', token: 'test-access-token' } });
  fetchProfile.mockResolvedValue(Response.json({ success: true, data: profile }));
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('upload authorization', () => {
  it.each(['avatar', 'generalMedia'] as const)('denies anonymous %s uploads', async (route) => {
    getServerSession.mockResolvedValue(null);
    await expect(upload(route)).rejects.toThrow('Unauthorized');
    expect(fetchProfile).not.toHaveBeenCalled();
  });
  it('uses a supported forbidden response when upload access is denied', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(upload()).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Unauthorized' });
    expect(fetchProfile).not.toHaveBeenCalled();
  });
  it('denies an incomplete or failed session without contacting the backend', async () => {
    for (const session of [{ user: { id: 'user-1' } }, {
      user: { id: 'user-1', token: 'test-access-token' }, error: 'RefreshAccessTokenError',
    }]) {
      getServerSession.mockResolvedValue(session);
      await expect(upload()).rejects.toThrow('Unauthorized');
    }
    expect(fetchProfile).not.toHaveBeenCalled();
  });
  it('uses a fresh backend identity and tenant instead of request hints', async () => {
    await expect(upload()).resolves.toEqual({ userId: 'user-1', tenantId: 'trusted-tenant' });
    expect(fetchProfile).toHaveBeenCalledWith(expect.stringMatching(/\/api\/users\/me$/), {
      headers: { Authorization: 'Bearer test-access-token' },
      cache: 'no-store', signal: expect.any(AbortSignal),
    });
  });
  it.each([
    { ...profile, role: 'customer' }, { ...profile, role: 'unknown' },
    { ...profile, status: 'suspended' }, { ...profile, _id: 'different-user' },
    { ...profile, tenant: null }, {},
  ])('denies invalid backend profiles: %j', async (data) => {
    fetchProfile.mockResolvedValue(Response.json({ success: true, data }));
    await expect(upload()).rejects.toThrow('Unauthorized');
  });
  it('permits a platform administrator without a tenant', async () => {
    fetchProfile.mockResolvedValue(Response.json({ success: true, data: {
      ...profile, role: 'super_admin', tenant: null,
    } }));
    await expect(upload('generalMedia')).resolves.toEqual({ userId: 'user-1', tenantId: null });
  });
  it('fails closed on revoked tokens, malformed responses and network failures', async () => {
    for (const response of [new Response(null, { status: 401 }),
      Response.json({ success: false, data: profile }), new Response('invalid-json')]) {
      fetchProfile.mockResolvedValue(response);
      await expect(upload()).rejects.toThrow('Unauthorized');
    }
    fetchProfile.mockRejectedValue(new Error('backend unavailable'));
    await expect(upload()).rejects.toThrow('Unauthorized');
  });
});
