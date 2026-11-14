import { readJson, readError } from './response';

/**
 * Services for the manual-merchandising pairing API.
 *
 * Shape mirrors `banner.service.ts` exactly: same base-URL constant, same
 * Bearer-token header, same error handling via readError, same readJson
 * unwrapping. Endpoints are the Task-2 routes:
 *   GET    /api/merchandising/pairings
 *   PUT    /api/merchandising/pairings        (upsert on {tenant, sourceProduct})
 *   DELETE /api/merchandising/pairings/:id
 * Tenant scoping is JWT-authoritative server-side — no tenant id is ever sent.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** Populated row shape returned by GET /api/merchandising/pairings. */
export interface PairingProductRef {
  _id: string;
  name?: string;
  slug?: string;
  type?: string;
  images?: { url?: string }[];
}

export interface PairingListItem {
  _id: string;
  sourceProduct?: PairingProductRef | null;
  suggestedProducts?: PairingProductRef[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PairingPayload {
  sourceProduct: string;
  suggestedProducts: string[];
  active?: boolean;
}

export const merchandisingPairingService = {
  async list(token: string) {
    const response = await fetch(`${API_URL}/api/merchandising/pairings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch pairings');
    }

    return readJson<{ success: boolean; data: PairingListItem[]; message?: string }>(response);
  },

  async upsert(token: string, body: PairingPayload) {
    const response = await fetch(`${API_URL}/api/merchandising/pairings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to save pairing');
    }

    return readJson<{ success: boolean; data?: PairingListItem; message?: string }>(response);
  },

  async remove(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/merchandising/pairings/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to delete pairing');
    }

    return readJson<{ success: boolean; data?: PairingListItem }>(response);
  },
};
