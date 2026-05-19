// @ts-nocheck
// Sync manager — processes offline pending sales queue when online
// Browser-only

import { posDB } from './db';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOrderWithRetry(
  payload: any,
  token: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const delays = [500, 1000, 2000];

  for (let attempt = 0; attempt <= MAX_RETRIES - 1; attempt++) {
    try {
      const res = await fetch(`${API_URL}/api/pos/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        return { ok: true, data };
      }

      // Non-retriable client errors (4xx)
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, error: data.message || `HTTP ${res.status}` };
      }

      // Server error — retry
      if (attempt < MAX_RETRIES - 1) {
        await sleep(delays[attempt]);
      }
    } catch (err: any) {
      // Network error — retry
      if (attempt < MAX_RETRIES - 1) {
        await sleep(delays[attempt]);
      } else {
        return { ok: false, error: err.message || 'Network error' };
      }
    }
  }

  return { ok: false, error: 'Max retries exceeded' };
}

export async function processPendingSales(
  token: string
): Promise<{ success: number; failed: number }> {
  if (typeof window === 'undefined') return { success: 0, failed: 0 };
  if (!navigator.onLine) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  try {
    const pendingSales = await posDB.getPendingSales();

    for (const sale of pendingSales) {
      const { localId, retries = 0, ...payload } = sale;

      // Skip if already exceeded max retries
      if (retries >= MAX_RETRIES) {
        failed++;
        continue;
      }

      const result = await postOrderWithRetry(payload, token);

      if (result.ok) {
        await posDB.removePendingSale(localId);
        success++;
      } else {
        // Increment retry count but leave in queue
        await posDB.updatePendingSale(localId, { retries: retries + 1 });
        failed++;
      }
    }
  } catch (err) {
    console.error('[syncManager] Error processing pending sales:', err);
  }

  return { success, failed };
}

/**
 * Start auto-sync — listens for online events and processes queue.
 * Returns a cleanup function.
 */
export function startAutoSync(getToken: () => string | null): () => void {
  if (typeof window === 'undefined') return () => {};

  async function trySync() {
    const token = getToken();
    if (!token) return;
    await processPendingSales(token);
  }

  window.addEventListener('online', trySync);

  // Also run immediately if online
  if (navigator.onLine) {
    trySync();
  }

  return () => {
    window.removeEventListener('online', trySync);
  };
}
