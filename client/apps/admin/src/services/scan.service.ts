// client/apps/admin/src/services/scan.service.ts
// API client for the Sales Scan & Match feature. Desktop endpoints use the
// admin JWT; the mobile upload uses the pairing code alone (no token).

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface ScanMatchedSize {
  size: string;
  displayName?: string;
  volumeMl?: number | null;
  sku?: string;
  sellingPrice: number;
  costPrice: number;
  availableStock?: number;
  isDefault?: boolean;
}

export interface ScanMatchedSubProduct {
  _id: string;
  sku: string;
  baseSellingPrice: number;
  costPrice: number;
  taxRate: number;
  sellWithoutSizeVariants: boolean;
  bundleDeals: unknown[];
  sizes: ScanMatchedSize[];
}

export interface ScanResultItem {
  extractedName: string;
  brand?: string | null;
  type?: string | null;
  sizeText?: string | null;
  packUnit?: 'pack' | 'carton' | 'case' | 'unit' | null;
  qty: number;
  /** 'exact' | 'partial' | 'none' */
  confidence: 'exact' | 'partial' | 'none';
  note?: string | null;
  matchedProductId?: string | null;
  matchedProductName?: string | null;
  matchedSubProducts: ScanMatchedSubProduct[];
  suggestedSizeId?: string | null;
  partial: boolean;
}

export interface PairingSession {
  pairingCode: string;
  expiresAt: number;
}

export interface ScanStatus {
  status: 'pending' | 'uploaded' | 'processing' | 'complete' | 'error';
  result?: ScanResultItem[] | { error: string };
  expiresAt?: number;
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseRes(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !body.success) throw new Error(body.message || fallback);
  return body.data;
}

export const scanService = {
  /** Desktop: create a QR pairing session. */
  async createPairing(token: string): Promise<PairingSession> {
    const res = await fetch(`${API_URL}/api/scan/pair`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    return parseRes(res, 'Failed to create pairing code');
  },

  /** Desktop: poll a pairing session's status (Socket.io fallback). */
  async getStatus(token: string, code: string): Promise<ScanStatus> {
    const res = await fetch(`${API_URL}/api/scan/status/${code}`, {
      headers: authHeaders(token),
    });
    return parseRes(res, 'Failed to fetch pairing status');
  },

  /** Desktop: direct match (image URL or text), synchronous. */
  async match(
    token: string,
    input: { imageUrl?: string; text?: string }
  ): Promise<ScanResultItem[]> {
    const res = await fetch(`${API_URL}/api/scan/match`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    const data = await parseRes(res, 'Failed to match');
    return data.items ?? [];
  },

  /**
   * Fuzzy live search (no AI). Alias expansion + Brand.tradingAs + Category
   * lookup + token scoring. Call this when plain-text search yields 0 results.
   */
  async smartSearch(token: string, query: string): Promise<ScanResultItem[]> {
    const res = await fetch(`${API_URL}/api/scan/smart-search`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ query }),
    });
    const data = await parseRes(res, 'Smart search failed');
    return data.items ?? [];
  },

  /** Mobile: upload a photo via the pairing code (no auth token).
   *  Uses the Next.js proxy route (/api/scan/upload-mobile/[code]) so the
   *  request stays same-origin — avoids CORS and mixed-content blocks on
   *  mobile browsers when the phone scans a QR pointing to the admin domain. */
  async uploadMobile(
    code: string,
    file: File
  ): Promise<{ status: string; imageUrl?: string }> {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`/api/scan/upload-mobile/${code}`, {
      method: 'POST',
      body: form,
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || !body.success)
      throw new Error(body.message || 'Upload failed');
    return body.data ?? { status: 'processing' };
  },
};
