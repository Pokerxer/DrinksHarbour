'use strict';
const crypto = require('node:crypto');
const { enabled, runRedis, key } = require('../config/redis');
const INCREMENT = `local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {hits, ttl}`;
const DECREMENT = `local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
if hits > 0 then return redis.call('DECR', KEYS[1]) end
return 0`;
class RedisRateLimitStore {
  constructor(scope, run = runRedis) {
    this.scope = scope; this.run = run; this.localKeys = false;
    this.prefix = `${key('limits', scope)}:${scope}:`;
  }
  init(options) { this.windowMs = options.windowMs; }
  identifier(value) { return this.prefix + crypto.createHash('sha256').update(value).digest('hex'); }
  async increment(value) {
    const [totalHits, ttl] = await this.run(client => client.eval(INCREMENT,
      { keys: [this.identifier(value)], arguments: [String(this.windowMs)] }));
    return { totalHits: Number(totalHits), resetTime: new Date(Date.now() + Number(ttl)) };
  }
  async decrement(value) {
    await this.run(client => client.eval(DECREMENT, { keys: [this.identifier(value)], arguments: [] }));
  }
  async resetKey(value) { await this.run(client => client.del(this.identifier(value))); }
}
const sharedStore = scope => enabled() ? { store: new RedisRateLimitStore(scope) } : {};
module.exports = { RedisRateLimitStore, sharedStore };
