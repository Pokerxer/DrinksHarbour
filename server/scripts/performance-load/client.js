'use strict';
const http = require('node:http');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { secret } = require('./fixtures');
const percentile = (sorted, fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
async function load(port, scenario, concurrency, count) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
  const times = [], statuses = {}, hashes = new Map();
  let cursor = 0, bytes = 0, wireBytes = 0;
  async function request(i) {
    const tenant = scenario === 'hot' ? 0 : i % 50;
    const page = scenario === 'hot' ? 1 : Math.floor(i / 50) % 5 + 1;
    const start = performance.now();
    return new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port, agent, path: `/api/integrations/v1/products?limit=20&page=${page}`,
        headers: { authorization: `Bearer ${secret(tenant * 700 + (count === 100 ? 600 + i : i))}`, 'accept-encoding': 'gzip',
          'x-forwarded-for': `10.1.${Math.floor(i / 250)}.${i % 250 + 1}` } }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          times.push(performance.now() - start);
          statuses[res.statusCode] = (statuses[res.statusCode] || 0) + 1;
          try {
            const wire = Buffer.concat(chunks);
            const body = res.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(wire) : wire;
            wireBytes += wire.length; bytes += body.length;
            const result = JSON.parse(body);
            if (res.statusCode !== 200 || !result.success || result.data?.length !== 20 || result.pagination.total !== 160) {
              throw new Error(`Unexpected response ${res.statusCode}: ${body.toString().slice(0, 200)}`);
            }
            for (const row of result.data) {
              if (!row.sku.startsWith(`T${tenant}-`) || row.variants.length !== 2 || row.sellingPrice <= 0 || 'costPrice' in row) throw new Error('Invalid tenant or price response');
              row.variants.sort((a, b) => a.id.localeCompare(b.id));
            }
            const hash = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
            const key = `${tenant}:${page}`;
            if (hashes.has(key) && hashes.get(key) !== hash) throw new Error('Response changed during a read workload');
            hashes.set(key, hash);
            resolve();
          } catch (error) { reject(error); }
        });
      });
      req.setTimeout(30000, () => req.destroy(new Error('HTTP timeout')));
      req.on('error', reject);
    });
  }
  const start = performance.now();
  try {
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (cursor < count) { const i = cursor++; await request(i); }
    }));
    const elapsedMs = performance.now() - start;
    times.sort((a, b) => a - b);
    return { count, elapsedMs, rps: count * 1000 / elapsedMs, meanMs: times.reduce((sum, value) => sum + value, 0) / count,
      p50Ms: percentile(times, 0.5), p95Ms: percentile(times, 0.95), p99Ms: percentile(times, 0.99), statuses,
      avgBytes: bytes / count, avgWireBytes: wireBytes / count, hashes: Object.fromEntries([...hashes.entries()].sort()) };
  } finally { agent.destroy(); }
}
module.exports = { load, percentile };
