'use strict';
const { createClient } = require('redis');
const crypto = require('node:crypto');
let client, connecting, retryAt = 0;
const enabled = () => Boolean(process.env.REDIS_URL);
const metadataEnabled = () => enabled() && process.env.REDIS_PUBLIC_METADATA_CACHE === 'true';
const namespace = () => process.env.REDIS_NAMESPACE || `drinksharbour:${process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'}`;
const key = (...parts) => `${namespace()}:v1:${parts[0]}:${crypto.createHash('sha256').update(JSON.stringify(parts.slice(1))).digest('hex')}`;
async function connection() {
  if (!enabled()) throw new Error('Redis is not configured');
  if (client?.isReady) return client;
  if (Date.now() < retryAt) throw new Error('Redis temporarily unavailable');
  if (!connecting) {
    client = createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true, commandsQueueMaxLength: 1000,
      socket: { connectTimeout: 500, reconnectStrategy: false }, commandOptions: { timeout: 500 } });
    // Never log a connection URL or provider error containing credentials.
    client.on('error', () => {});
    connecting = client.connect().then(() => client).catch(error => {
      retryAt = Date.now() + 5000;
      if (client.isOpen) client.destroy();
      throw error;
    }).finally(() => { connecting = null; });
  }
  return connecting;
}
async function runRedis(operation) {
  try { return await operation(await connection()); }
  catch {
    if (Date.now() >= retryAt) retryAt = Date.now() + 5000;
    const error = new Error('Shared request service temporarily unavailable');
    error.statusCode = 503;
    throw error;
  }
}
async function closeRedis() {
  if (connecting) await connecting.catch(() => {});
  if (client?.isOpen) client.destroy();
  client = null; retryAt = 0;
}
module.exports = { enabled, metadataEnabled, key, runRedis, closeRedis };
