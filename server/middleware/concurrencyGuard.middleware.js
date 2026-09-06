'use strict';

const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Cap how many requests one caller may have **in flight at the same time**.
 *
 * This is not what a rate limiter does. `express-rate-limit` counts requests
 * over a window; it is satisfied by 200 sockets opened in the same instant so
 * long as the window total is respected. For an endpoint that holds uploads in
 * memory and makes a model call per request, the simultaneous count is the
 * number that decides whether the instance survives — so it is bounded here,
 * separately, and the two run together.
 *
 * Two ceilings:
 *   • `max`       — per key (IP by default). Stops one client flooding.
 *   • `globalMax` — per process. The backstop for a *distributed* burst, where
 *                   no single IP crosses its own limit but the sum does.
 *
 * A refused caller is not counted, so a client that keeps hammering can never
 * lock itself out beyond the life of the requests it actually holds.
 *
 * **State is per-process.** On Vercel each serverless container keeps its own
 * counter and a cold start resets it, exactly as `express-rate-limit`'s default
 * MemoryStore does throughout this codebase. These ceilings bound what one
 * instance will do concurrently; they are not a globally consistent quota. A
 * shared store (Redis) or an edge firewall rule is what makes that global.
 *
 * @param {object}   opts
 * @param {number}   opts.max            simultaneous requests allowed per key
 * @param {number}   opts.globalMax      simultaneous requests allowed per process
 * @param {Function} [opts.keyGenerator] req => string, IPv6-safe IP by default
 * @param {string}   [opts.message]      sentence shown to a refused caller
 * @param {number}   [opts.retryAfter]   seconds, for the Retry-After header
 */
module.exports = function concurrencyGuard({
  max,
  globalMax,
  keyGenerator = (req) => ipKeyGenerator(req.ip || ''),
  message = 'You have too many requests in progress. Please wait for the current one to finish.',
  retryAfter = 5,
} = {}) {
  /** @type {Map<string, number>} key → requests currently in flight */
  const counts = new Map();
  let globalCount = 0;

  function chatbotConcurrencyGuard(req, res, next) {
    const key = keyGenerator(req);
    const current = counts.get(key) || 0;

    if (current >= max) {
      res.set?.('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message });
    }

    if (globalCount >= globalMax) {
      // Not this caller's fault — the instance is saturated. 503 says "come
      // back", 429 would say "you misbehaved", and the difference matters to
      // anyone reading logs to tell an attack from a traffic spike.
      res.set?.('Retry-After', String(retryAfter));
      return res.status(503).json({
        success: false,
        message: 'The assistant is busy right now. Please try again in a moment.',
      });
    }

    counts.set(key, current + 1);
    globalCount += 1;

    // express emits 'finish' then 'close' on a normal response, and 'close'
    // alone when the client hangs up. Releasing twice would drift the counter
    // downward until the guard silently stopped guarding, so the release is
    // latched.
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const n = (counts.get(key) || 1) - 1;
      if (n <= 0) counts.delete(key);   // an idle key leaves no entry behind
      else counts.set(key, n);
      globalCount = Math.max(0, globalCount - 1);
    };

    res.on('finish', release);
    res.on('close', release);

    return next();
  }

  /** Introspection for tests and health checks — not used by the request path. */
  chatbotConcurrencyGuard.inFlight = (key) => (key === undefined ? globalCount : counts.get(key) || 0);
  chatbotConcurrencyGuard.size = () => counts.size;

  return chatbotConcurrencyGuard;
};
