const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface ErmPlan {
  key: string;
  label: string;
  priceMonthly: number;
  skuLimit: number | null;
  staffLimit: number | null;
  commissionRate: number;
  features: string[];
  addOnsAllowed: boolean;
}

export type ErmAddOnType = 'extra_shop' | 'extra_warehouse';

/**
 * One add-on row as the server reports it.
 *
 * `allowance` is the total the tenant may have (the one free unit plus what
 * they bought) and `purchased` is only the paid part — showing `purchased`
 * against `used` would read "0 of 0" for a tenant using their free slot.
 */
export interface ErmAddOn {
  type: ErmAddOnType;
  label: string;
  priceMonthly: number;
  purchased: number;
  pendingCancellation?: number;
  used: number;
  allowance: number;
}

export interface ErmStatus {
  plan: string;
  planLabel: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  commissionRate: number;
  addOnsAllowed: boolean;
  writesAllowed: boolean;
  capabilities?: string[];
  canManageBilling?: boolean;
  hasSubscription?: boolean;
  cancelAtPeriodEnd?: boolean;
  revenueModel?: string;
  entitlementReason: string;
  /**
   * The server's own explanation of the read-only state, from the same
   * `readOnlyMessage` the write gates put in their 403. Null when writes are
   * allowed. Render this rather than composing a sentence from
   * `entitlementReason` — that is how the three copies that used to exist
   * drifted apart.
   *
   * OPTIONAL ON PURPOSE. It is a new field, so an API older than this client
   * omits it entirely — `undefined`, not `null`. Marking it optional makes the
   * type system insist every render site says what to do about that, which is
   * how the billing page's empty-amber-box case was caught. Consumers must
   * supply a fallback or render nothing; see `ENTITLEMENT_MESSAGE_FALLBACK` in
   * `app/shared/erm/billing-page.tsx`.
   */
  entitlementMessage?: string | null;
  usage: {
    skus: { used: number; limit: number | null };
    staff: { used: number; limit: number | null };
    warehouses: { used: number; limit: number | null };
    shops: { used: number; limit: number | null };
  };
  addOns: ErmAddOn[];
}

export async function changePlan(planKey: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/erm/change-plan`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify({ planKey }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { message?: string }).message || 'Plan change failed');
}

export async function renewSubscription(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/erm/renew`, { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error(((await res.json()) as { message?: string }).message || 'Renewal failed');
}

export async function getErmPlans(): Promise<ErmPlan[]> {
  try {
    const res = await fetch(`${API_URL}/api/erm/plans`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return (await res.json() as { data: ErmPlan[] }).data;
  } catch {
    return [];
  }
}

export async function getErmStatus(token: string): Promise<ErmStatus | null> {
  try {
    const res = await fetch(`${API_URL}/api/erm/status`, {
      headers: authHeaders(token), cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json() as { data?: ErmStatus }).data ?? null;
  } catch {
    return null;
  }
}

export async function initSubscribe(
  planKey: string,
  token: string
): Promise<{ authorizationUrl: string }> {
  const res = await fetch(`${API_URL}/api/erm/subscribe`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ planKey }),
  });
  if (!res.ok)
    throw new Error(
      (await res.json() as { message?: string }).message || 'Failed to start subscription'
    );
  return (await res.json() as { data: { authorizationUrl: string } }).data;
}

export async function cancelSubscription(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/erm/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || 'Failed to cancel subscription');
  }
}

export async function manageSubscription(token: string): Promise<{ authorizationUrl: string }> {
  const res = await fetch(`${API_URL}/api/erm/manage`, {
    method: 'POST', headers: authHeaders(token),
  });
  const body = await res.json().catch(() => ({})) as { message?: string; data?: { authorizationUrl: string } };
  if (!res.ok || !body.data?.authorizationUrl) {
    throw new Error(body.message || 'Unable to open payment settings');
  }
  return body.data;
}

/**
 * Buy ONE unit of an add-on. Resolves to a Paystack checkout URL — the quota
 * does not move until the subscription.create webhook lands, so the caller
 * must redirect rather than optimistically update.
 */
export async function subscribeAddOn(
  addOnType: ErmAddOnType,
  token: string
): Promise<{ authorizationUrl: string }> {
  const res = await fetch(`${API_URL}/api/erm/add-ons`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ addOnType }),
  });
  // One read of the stream, then branch — `res.json()` cannot be called twice,
  // and it is typed `unknown` here, so the shape is named rather than indexed.
  const body = (await res.json()) as {
    message?: string;
    data?: { authorizationUrl: string };
  };
  if (!res.ok || !body.data)
    throw new Error(body.message || 'Failed to start add-on checkout');
  return body.data;
}

export async function cancelAddOn(
  addOnType: ErmAddOnType,
  token: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/erm/add-ons/${addOnType}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = (await res.json()) as { message?: string };
    throw new Error(body.message || 'Failed to cancel add-on');
  }
}

export type PendingPlanChange = { targetPlan: string; effectiveAt: string; state: string };
export async function getPendingPlanChange(token: string, signal?: AbortSignal): Promise<PendingPlanChange | null> {
  const response = await fetch(`${API_URL}/api/erm/change-plan`, {
    headers: authHeaders(token), cache: 'no-store', signal,
  });
  const body = await response.json().catch(() => null) as { message?: string; data?: PendingPlanChange | null } | null;
  if (!response.ok || !body || body.data === undefined) {
    throw new Error(body?.message || 'Unable to check pending plan changes. Please retry.');
  }
  return body.data;
}
