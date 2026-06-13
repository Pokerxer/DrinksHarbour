// services/liveRates.service.js
// Pulls live FX rates from open.er-api.com (free, keyless, NGN supported;
// provider refreshes once a day) and upserts them as ExchangeRate documents.
const axios = require('axios');
const ExchangeRate = require('../models/ExchangeRate');

const PROVIDER_URL =
  process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest/USD';

// How long stored live rates stay fresh before a read triggers a re-sync.
const SYNC_TTL_MS =
  (parseInt(process.env.EXCHANGE_RATE_SYNC_TTL_MINUTES, 10) || 360) * 60 * 1000;

const SUPPORTED = ['NGN', 'USD', 'EUR', 'GBP'];

// Per-tenant guards so a provider outage doesn't add latency to every read
// and concurrent reads don't trigger duplicate syncs.
const lastAttemptAt = new Map();
const inFlight = new Map();

async function fetchProviderRates() {
  const { data } = await axios.get(PROVIDER_URL, { timeout: 10000 });
  const rates = data?.rates;
  const base = data?.base_code || data?.base;
  if (data?.result === 'error' || !rates || !base) {
    throw new Error(
      `Live rate provider returned an invalid response${
        data?.['error-type'] ? `: ${data['error-type']}` : ''
      }`
    );
  }
  return { base: String(base).toUpperCase(), rates };
}

// Build every directed pair among the supported currencies (one direction
// each; ExchangeRate.convertCurrency falls back to the inverse pair).
function buildPairs({ base, rates }) {
  const value = (code) => (code === base ? 1 : rates[code]);
  for (const code of SUPPORTED) {
    if (!value(code) || value(code) <= 0) {
      throw new Error(`Live rate provider has no rate for ${code}`);
    }
  }
  const pairs = [];
  for (let i = 0; i < SUPPORTED.length; i++) {
    for (let j = i + 1; j < SUPPORTED.length; j++) {
      const from = SUPPORTED[i];
      const to = SUPPORTED[j];
      // Cross rate via the provider base: from→to = base→to / base→from.
      pairs.push({
        fromCurrency: from,
        toCurrency: to,
        rate: value(to) / value(from),
      });
    }
  }
  return pairs;
}

/**
 * Fetches live rates and upserts today's rate for every supported pair.
 * Manual rates entered for today are left untouched — live data never
 * overwrites a user's explicit override.
 */
async function syncLiveRates(tenantId, userId) {
  const pairs = buildPairs(await fetchProviderRates());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let updated = 0;
  let skippedManual = 0;

  for (const pair of pairs) {
    const existing = await ExchangeRate.findOne({
      tenant: tenantId,
      fromCurrency: pair.fromCurrency,
      toCurrency: pair.toCurrency,
      effectiveDate: today,
    });

    if (existing) {
      if (existing.source !== 'live') {
        skippedManual++;
        continue;
      }
      // Refresh the rate but respect the user's active/inactive choice.
      existing.rate = pair.rate;
      existing.updatedBy = userId;
      await existing.save();
    } else {
      await ExchangeRate.create({
        tenant: tenantId,
        ...pair,
        effectiveDate: today,
        isActive: true,
        source: 'live',
        notes: 'Live rate (open.er-api.com)',
        createdBy: userId,
      });
    }
    updated++;
  }

  lastAttemptAt.set(String(tenantId), Date.now());
  return { updated, skippedManual, pairs: pairs.length };
}

/**
 * Re-syncs when the tenant's live rates are older than the TTL.
 * Never throws — stored rates keep serving reads if the provider is down.
 */
async function autoSyncIfStale(tenantId, userId) {
  const key = String(tenantId);
  if (inFlight.has(key)) return inFlight.get(key);
  if (Date.now() - (lastAttemptAt.get(key) || 0) < SYNC_TTL_MS) return null;

  const freshestLive = await ExchangeRate.findOne({
    tenant: tenantId,
    source: 'live',
  }).sort({ updatedAt: -1 });

  if (
    freshestLive &&
    Date.now() - freshestLive.updatedAt.getTime() < SYNC_TTL_MS
  ) {
    lastAttemptAt.set(key, Date.now());
    return null;
  }

  const promise = syncLiveRates(tenantId, userId)
    .catch((err) => {
      // Don't retry until the TTL passes; reads fall back to stored rates.
      lastAttemptAt.set(key, Date.now());
      console.error('Auto-sync of live exchange rates failed:', err.message);
      return null;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

module.exports = { syncLiveRates, autoSyncIfStale };
