'use strict';
const { key, runRedis } = require('../config/redis');
const revision = row => row.updatedAt && Number.isFinite(new Date(row.updatedAt).getTime())
  ? new Date(row.updatedAt).toISOString() : null;
// Only public, explicitly projected metadata belongs here. Never pass operational documents.
function createMetadataCache(run = runRedis) {
  async function read(tenant, resource, rows, load) {
    if (!rows.length) return [];
    const fresh = async () => {
      const loaded = await load(rows);
      const byId = new Map(loaded.map(row => [String(row._id), row]));
      if (rows.some(row => !byId.has(String(row._id)) ||
        (revision(row) && revision(byId.get(String(row._id))) !== revision(row)))) return null;
      return rows.map(row => byId.get(String(row._id)));
    };
    if (rows.some(row => !revision(row))) return fresh();
    const keys = rows.map(row => key('metadata', String(tenant), resource, String(row._id), revision(row)));
    let cached;
    try { cached = await run(client => client.mGet(keys)); }
    catch { return fresh(); }
    const decoded = cached.map((value, index) => {
      try {
        const row = JSON.parse(value);
        return row && String(row._id) === String(rows[index]._id) && revision(row) === revision(rows[index]) ? row : null;
      } catch { return null; }
    });
    const missing = rows.filter((_, index) => !decoded[index]);
    if (!missing.length) return decoded;
    const loaded = await load(missing);
    const byId = new Map(loaded.map(row => [String(row._id), row]));
    // A write during the live revision probe must never populate an old revision key.
    if (missing.some(row => revision(byId.get(String(row._id)) || {}) !== revision(row))) return null;
    try {
      await run(client => Promise.all(missing.map(row => client.set(
        key('metadata', String(tenant), resource, String(row._id), revision(row)),
        JSON.stringify(byId.get(String(row._id))), { EX: 300 }))));
    } catch { /* Cache failure leaves the authoritative response available. */ }
    return rows.map((row, index) => decoded[index] || byId.get(String(row._id)));
  }
  return { read };
}
module.exports = { createMetadataCache, revision };
