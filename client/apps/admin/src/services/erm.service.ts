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

export interface ErmStatus {
  plan: string;
  planLabel: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  commissionRate: number;
  usage: {
    skus: { used: number; limit: number | null };
    staff: { used: number; limit: number | null };
  };
  addOns: { type: string; quantity: number }[];
}

export async function getErmPlans(): Promise<ErmPlan[]> {
  const res = await fetch(`${API_URL}/api/erm/plans`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return (await res.json()).data;
}

export async function getErmStatus(token: string): Promise<ErmStatus | null> {
  const res = await fetch(`${API_URL}/api/erm/status`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()).data;
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
      (await res.json()).message || 'Failed to start subscription'
    );
  return (await res.json()).data;
}

export async function cancelSubscription(token: string): Promise<void> {
  await fetch(`${API_URL}/api/erm/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  });
}
