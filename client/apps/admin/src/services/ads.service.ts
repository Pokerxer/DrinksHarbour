import { readJson, readError } from './response';

/**
 * Services for the self-serve advertising API (sponsored placements).
 *
 * Shape mirrors `merchandisingPairing.service.ts` exactly: same base-URL
 * constant, same Bearer-token header, same error handling via readError, same
 * readJson unwrapping. Endpoints are the Task-7/8 routes:
 *   GET    /api/ads/campaigns
 *   GET    /api/ads/campaigns/summary   (balance + cpcTariff + campaigns)
 *   POST   /api/ads/campaigns
 *   PATCH  /api/ads/campaigns/:id/status
 *   DELETE /api/ads/campaigns/:id
 * plus the ad-wallet top-up over the existing Paystack seam (Task 8):
 *   POST   /api/payments/paystack/initialize   (requires an Idempotency-Key)
 * Tenant scoping is JWT-authoritative server-side — no tenant id is ever sent.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** One sponsored surface a campaign can run on. */
export type AdSurface = 'pdp' | 'cart';

/**
 * Row shape returned by GET /api/ads/campaigns. `product` is the central
 * catalog Product id (the list endpoint does not populate it — the table
 * resolves names client-side from the product search).
 */
export interface AdCampaignRow {
  _id: string;
  name?: string;
  product?: string;
  surfaces?: AdSurface[];
  status?: 'draft' | 'active' | 'paused' | 'budget_exhausted' | 'expired' | 'suspended';
  dailyBudget?: number;
  spentToday?: number;
  spentTotal?: number;
  clicksTotal?: number;
  impressionsTotal?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string;
}

export interface AdsSummary {
  balance: number;
  cpcTariff: number;
  campaigns: AdCampaignRow[];
}

export interface AdCampaignPayload {
  name: string;
  product: string;
  surfaces: AdSurface[];
  dailyBudget: number;
  startsAt?: string;
  endsAt?: string;
}

export interface InitializeTopupResult {
  authorizationUrl?: string;
  authorization_url?: string;
  reference?: string;
  amount?: number;
}

/** A fresh key per top-up click — the server rejects initialization without one. */
function idempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `adh-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export const adsService = {
  async list(token: string) {
    const response = await fetch(`${API_URL}/api/ads/campaigns`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch campaigns');
    }

    return readJson<{ success: boolean; data: AdCampaignRow[]; message?: string }>(response);
  },

  async summary(token: string) {
    const response = await fetch(`${API_URL}/api/ads/campaigns/summary`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch advertising summary');
    }

    return readJson<{ success: boolean; data: AdsSummary; message?: string }>(response);
  },

  async create(token: string, body: AdCampaignPayload) {
    const response = await fetch(`${API_URL}/api/ads/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to create campaign');
    }

    return readJson<{ success: boolean; data?: AdCampaignRow; message?: string }>(response);
  },

  async setStatus(token: string, id: string, status: 'active' | 'paused') {
    const response = await fetch(`${API_URL}/api/ads/campaigns/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to update campaign status');
    }

    return readJson<{ success: boolean; data?: AdCampaignRow; message?: string }>(response);
  },

  async remove(token: string, id: string) {
    const response = await fetch(`${API_URL}/api/ads/campaigns/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to delete campaign');
    }

    return readJson<{ success: boolean; data?: AdCampaignRow }>(response);
  },

  /**
   * Ad wallet top-up: rides the existing Paystack initialize seam with
   * purpose=ad_wallet metadata. A fresh Idempotency-Key is generated for every
   * call (the server rejects payment initialization without one). Returns the
   * payment data whose authorization URL the caller redirects to.
   */
  async initializeTopup(token: string, amount: number, email: string) {
    const response = await fetch(`${API_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey(),
      },
      body: JSON.stringify({
        amount,
        email,
        metadata: { purpose: 'ad_wallet' },
      }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to start wallet top-up');
    }

    return readJson<{ success: boolean; data?: InitializeTopupResult; message?: string }>(
      response
    );
  },
};
