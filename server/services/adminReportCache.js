'use strict';
const { randomUUID } = require('node:crypto');
const { enabled, key, runRedis } = require('../config/redis');
const TTL = 30;
const MAX_BYTES = 100_000;
const STORE = `
if (redis.call('GET', KEYS[1]) or '0') ~= ARGV[1] then return 0 end
if (redis.call('GET', KEYS[2]) or '0') ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])
return 1`;
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const cacheable = result => result?.status === 200 && result.body?.success === true && !result.noCache;
const revisionKey = scope => key('admin-report-revision', scope);
function createAdminReportCache({ run = runRedis, isEnabled = () => enabled() && process.env.REDIS_ADMIN_REPORT_CACHE !== 'false' } = {}) {
  const pending = new Map();
  async function read(context, load, { fresh = false } = {}) {
    if (!isEnabled()) return load();
    const keys = [revisionKey('all'), revisionKey(context.scope), key('admin-report-v1', canonical(context))];
    let versions, raw;
    try {
      const values = await run(client => client.mGet(keys));
      versions = values.slice(0, 2).map(v => v || '0'); raw = values[2];
    } catch { return load(); }
    if (!fresh && raw && Buffer.byteLength(raw) <= MAX_BYTES) {
      try {
        const envelope = JSON.parse(raw);
        if (JSON.stringify(envelope.versions) === JSON.stringify(versions) && cacheable(envelope.result)) return envelope.result;
      } catch { /* Corrupt cache entries are misses. */ }
    }
    const requestKey = `${keys[2]}:${JSON.stringify(versions)}`;
    if (!fresh && pending.has(requestKey)) return pending.get(requestKey);
    const work = (async () => {
      const result = await load();
      if (cacheable(result)) {
        const serialized = JSON.stringify({ versions, result });
        if (Buffer.byteLength(serialized) <= MAX_BYTES) {
          try {
            await run(client => client.eval(STORE, { keys, arguments: [...versions, serialized, String(TTL)] }));
          } catch { /* Cache errors never replace the live report. */ }
        }
      }
      return result;
    })();
    const share = !fresh && pending.size < 200;
    if (share) pending.set(requestKey, work);
    try { return await work; }
    finally { if (share) pending.delete(requestKey); }
  }
  async function invalidate(scopes) {
    if (!isEnabled()) return;
    try {
      await run(client => {
        const transaction = client.multi();
        const revision = randomUUID();
        for (const scope of new Set(scopes)) transaction.set(revisionKey(scope), revision, { EX: 3600 });
        return transaction.exec();
      });
    } catch { /* TTL bounds staleness if invalidation is unavailable. */ }
  }
  return { read, invalidate, isEnabled };
}
const adminReportCache = createAdminReportCache();
module.exports = { createAdminReportCache, adminReportCache, canonical };
