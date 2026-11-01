'use strict';
const crypto = require('node:crypto');

// Compatibility boundary for cache factories and archived benchmarks. The
// application runs independently of Redis; stale provider variables are ignored.
const enabled = () => false;
const metadataEnabled = () => false;
const namespace = () => `drinksharbour:${process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'}`;
const key = (...parts) => `${namespace()}:v1:${parts[0]}:${crypto.createHash('sha256').update(JSON.stringify(parts.slice(1))).digest('hex')}`;
async function runRedis() {
  const error = new Error('External cache is disabled; use the authoritative loader');
  error.code = 'CACHE_DISABLED';
  throw error;
}
async function closeRedis() { /* No external connection exists. */ }
module.exports = { enabled, metadataEnabled, key, runRedis, closeRedis };
