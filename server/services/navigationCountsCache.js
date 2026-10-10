'use strict';
const { enabled, key, runRedis } = require('../config/redis');
const FIELDS = new Set(['category', 'subCategory']);
const valid = counts => counts && typeof counts === 'object' && !Array.isArray(counts) &&
  Object.values(counts).every(count => Number.isSafeInteger(count) && count >= 0);

// Approximate public navigation counts only. Never cache operational documents.
function createNavigationCountsCache({ run = runRedis, isEnabled = enabled } = {}) {
  const pending = new Map();
  async function read(field, load) {
    if (!FIELDS.has(field)) throw new Error('Unsupported navigation count field');
    if (!isEnabled() || process.env.REDIS_NAVIGATION_COUNTS_CACHE === 'false') return load(field);
    if (pending.has(field)) return pending.get(field);
    const cacheKey = key('navigation-counts-v1', 'central-catalog', field);
    const work = (async () => {
      try {
        const raw = await run(client => client.get(cacheKey));
        const counts = JSON.parse(raw);
        if (valid(counts)) return counts;
      } catch { /* Redis errors/corrupt entries use MongoDB. */ }
      const counts = await load(field);
      const serialized = JSON.stringify(counts);
      if (valid(counts) && Buffer.byteLength(serialized) <= 100_000) {
        try { await run(client => client.set(cacheKey, serialized, { EX: 60 })); }
        catch { /* The live response remains available. */ }
      }
      return counts;
    })();
    pending.set(field, work);
    try { return await work; }
    finally { pending.delete(field); }
  }
  return { read };
}
module.exports = { createNavigationCountsCache };
