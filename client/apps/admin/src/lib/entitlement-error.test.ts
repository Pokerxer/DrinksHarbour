import { describe, it, expect, vi } from 'vitest';

import {
  parseEntitlementError,
  entitlementActionLabel,
  wrapFetchWithEntitlementNotices,
  FETCH_PATCH_FLAG,
  type EntitlementNotice,
} from './entitlement-error';

/** The body shape server.js's error handler actually produces for a 403. */
const readOnlyBody = {
  success: false,
  message:
    'Your free trial has ended. Reactivate your subscription to make changes.',
  code: 'SUBSCRIPTION_READ_ONLY',
  details: { reason: 'trial_expired', currentPlan: 'growth' },
};

const upgradeBody = {
  success: false,
  message:
    'Your Starter plan does not include this feature. Upgrade to Pro to unlock it.',
  code: 'PLAN_UPGRADE_REQUIRED',
  details: {
    requiredCapabilities: ['advanced_reports'],
    currentPlan: 'starter',
    upgradeTo: 'pro',
    reason: 'ok',
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseEntitlementError', () => {
  it('recognises a read-only refusal and keeps the server’s wording', () => {
    const notice = parseEntitlementError(403, readOnlyBody);
    expect(notice).not.toBeNull();
    expect(notice!.code).toBe('SUBSCRIPTION_READ_ONLY');
    // The copy has one source. If this ever stops being byte-identical to the
    // server's message, a second wording has crept in.
    expect(notice!.message).toBe(readOnlyBody.message);
    expect(notice!.reason).toBe('trial_expired');
    expect(notice!.currentPlan).toBe('growth');
  });

  it('carries upgradeTo through so the client never parses the prose', () => {
    const notice = parseEntitlementError(403, upgradeBody);
    expect(notice!.upgradeTo).toBe('pro');
  });

  it('ignores a 403 that is not a plan or billing refusal', () => {
    expect(
      parseEntitlementError(403, {
        success: false,
        message: 'You do not have access to this tenant',
      })
    ).toBeNull();
  });

  it('ignores an unknown code, so a new server code cannot toast by accident', () => {
    expect(
      parseEntitlementError(403, { code: 'SOMETHING_ELSE', message: 'nope' })
    ).toBeNull();
  });

  it('ignores the right code on the wrong status — a body cannot spoof one', () => {
    expect(parseEntitlementError(200, readOnlyBody)).toBeNull();
    expect(parseEntitlementError(500, readOnlyBody)).toBeNull();
  });

  it('survives a body that is not an object', () => {
    expect(parseEntitlementError(403, null)).toBeNull();
    expect(parseEntitlementError(403, 'Forbidden')).toBeNull();
    expect(parseEntitlementError(403, undefined)).toBeNull();
  });

  it('falls back to its own sentence only when the server sent none', () => {
    const notice = parseEntitlementError(403, {
      code: 'SUBSCRIPTION_READ_ONLY',
      message: '   ',
    });
    expect(notice!.message).toBe(
      'Your account is read-only until billing is resolved.'
    );
  });

  it('recognises the quota refusals too, not just the subscription ones', () => {
    // These carry no `upgradeTo` — the plan is not missing a capability, it is
    // full — so the CTA must still resolve rather than render blank.
    for (const code of [
      'SKU_LIMIT_REACHED',
      'STAFF_LIMIT_REACHED',
      'ADD_ON_LIMIT_REACHED',
    ]) {
      const notice = parseEntitlementError(403, {
        code,
        message: 'Limit reached on your plan.',
        details: { used: 100, limit: 100, currentPlan: 'starter' },
      });
      expect(notice, code).not.toBeNull();
      expect(notice!.message).toBe('Limit reached on your plan.');
      expect(entitlementActionLabel(notice!)).toBe('View plans');
    }
  });

  it('gives the same toastId to the same refusal so parallel 403s collapse', () => {
    const a = parseEntitlementError(403, readOnlyBody)!;
    const b = parseEntitlementError(403, readOnlyBody)!;
    expect(a.toastId).toBe(b.toastId);

    const other = parseEntitlementError(403, upgradeBody)!;
    expect(other.toastId).not.toBe(a.toastId);
  });
});

describe('entitlementActionLabel', () => {
  const notice = (over: Partial<EntitlementNotice>): EntitlementNotice => ({
    code: 'PLAN_UPGRADE_REQUIRED',
    message: 'x',
    toastId: 'x',
    ...over,
  });

  it('sends a read-only tenant to billing', () => {
    expect(
      entitlementActionLabel(notice({ code: 'SUBSCRIPTION_READ_ONLY' }))
    ).toBe('Go to billing');
  });

  it('names the plan when the server named one', () => {
    expect(entitlementActionLabel(notice({ upgradeTo: 'pro' }), 'Pro')).toBe(
      'Upgrade to Pro'
    );
  });

  it('stays generic when no plan unlocks it', () => {
    expect(entitlementActionLabel(notice({ upgradeTo: null }))).toBe(
      'View plans'
    );
  });
});

describe('wrapFetchWithEntitlementNotices', () => {
  it('notifies on a billing 403', async () => {
    const onNotice = vi.fn();
    const patched = wrapFetchWithEntitlementNotices(
      async () => jsonResponse(403, readOnlyBody),
      onNotice
    );

    await patched('/api/warehouses', { method: 'POST' });

    expect(onNotice).toHaveBeenCalledTimes(1);
    expect(onNotice.mock.calls[0][0].code).toBe('SUBSCRIPTION_READ_ONLY');
  });

  it('leaves the response body unread for the real caller', async () => {
    const patched = wrapFetchWithEntitlementNotices(
      async () => jsonResponse(403, readOnlyBody),
      vi.fn()
    );

    const res = await patched('/api/warehouses', { method: 'POST' });

    // Every service's handle() does exactly this. If the wrapper consumed the
    // stream, every one of them would throw on an already-read body instead of
    // reporting the server's message.
    expect(res.bodyUsed).toBe(false);
    await expect(res.json()).resolves.toMatchObject({
      code: 'SUBSCRIPTION_READ_ONLY',
    });
  });

  it('passes non-403 responses straight through without reading them', async () => {
    const onNotice = vi.fn();
    const patched = wrapFetchWithEntitlementNotices(
      async () => jsonResponse(200, { success: true, data: [] }),
      onNotice
    );

    const res = await patched('/api/warehouses');

    expect(onNotice).not.toHaveBeenCalled();
    expect(res.bodyUsed).toBe(false);
  });

  it('does not turn a non-JSON 403 into a failed request', async () => {
    const onNotice = vi.fn();
    const patched = wrapFetchWithEntitlementNotices(
      async () => new Response('<html>Forbidden</html>', { status: 403 }),
      onNotice
    );

    const res = await patched('/api/anything');

    expect(res.status).toBe(403);
    expect(onNotice).not.toHaveBeenCalled();
  });

  it('propagates a network failure unchanged', async () => {
    const boom = new TypeError('Failed to fetch');
    const patched = wrapFetchWithEntitlementNotices(async () => {
      throw boom;
    }, vi.fn());

    await expect(patched('/api/anything')).rejects.toBe(boom);
  });

  it('forwards the arguments it was given', async () => {
    const inner = vi.fn(async () => jsonResponse(200, {}));
    const patched = wrapFetchWithEntitlementNotices(inner, vi.fn());
    const init = { method: 'PUT', body: '{}' };

    await patched('/api/x', init);

    expect(inner).toHaveBeenCalledWith('/api/x', init);
  });

  it('marks itself so a second mount cannot double-wrap', () => {
    const patched = wrapFetchWithEntitlementNotices(
      async () => jsonResponse(200, {}),
      vi.fn()
    );
    expect(patched[FETCH_PATCH_FLAG]).toBe(true);
  });
});
