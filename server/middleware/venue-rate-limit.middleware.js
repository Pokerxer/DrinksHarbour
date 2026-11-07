// Reusable per-endpoint rate limiters for the venue backend surfaces.
//
// Existing precedent: auth routes limit login at 20/15min and public booking
// submission at 10/hour (routes/venue.routes.js). Venue staff surfaces had no
// brakes at all, while they carry the money and capacity mutations of the
// platform. The limiters below are keyed by the authenticated actor (admin JWT
// user or POS token user), NOT by IP — one terminal behind a shared NAT must
// not steal another shift's budget, and one attacker cannot exhaust another
// user's bucket by spoofing cheap traffic.
//
// Windows follow the repo's 15-minute convention. Thresholds are deliberately
// generous so a busy venue shift never throttles legitimate POS traffic:
//
// | Limiter              | Window | Max | Sustained worst case          |
// |----------------------|--------|-----|-------------------------------|
// | staffCommands        | 15 min | 300 | 20 bill-freeze+collect/min    |
// | staffConfigurations  | 15 min |  60 | 4 menu/floor/capacity saves/min |
// | staffSupport         | 15 min |  60 | 4 refund/portion supports/min |
//
// Customer-side provider calls (deposits, payer links) already carry their own
// 20/1min limiter in routes/venue-money.routes.js and are intentionally left
// stricter than these staff buckets.
//
// `req.user._id` covers admin JWTs and venue-experience staff; `req.posUser`
// covers the POS-token chain used by the venue-ops POS router. A read-only
// unauthenticated caller can never reach these routes, so the anonymous
// fallback key is a safety net, not a public surface.

'use strict';
const rateLimit = require('express-rate-limit');
// v8 requires custom keyGenerators to wrap raw request IPs in this helper —
// it normalises IPv6 to its /64 subnet so one device can't mint unlimited
// keys by cycling addresses (ERR_ERL_KEY_GEN_IPV6). Same pattern as
// pos.routes.js and concurrencyGuard.middleware.js.
const { ipKeyGenerator } = require('express-rate-limit');

function venueLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
      const user = req.posUser?._id || req.user?._id || req.user?.id;
      return `venue:${user ? String(user) : 'anon'}@${ipKeyGenerator(req.ip)}`;
    },
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    message: { success: false, code: 'RATE_LIMITED', message },
  });
}

// High-frequency POS-adjacent state changes: open visit, write lines, freeze
// bill, collect, reconcile, close, request review/seating. 300 per user per
// 15 min ≈ every visit of a full evening rush on one user account.
const staffCommands = venueLimiter({ windowMs: 15 * 60 * 1000, limit: 300, message: 'Too many venue commands from this account. Please wait a moment.' });

// Back-office configuration (venue profile, menu, floor, capacity policy).
// Human-paced editing; 60 per user per 15 min stops a runaway save loop.
const staffConfigurations = venueLimiter({ windowMs: 15 * 60 * 1000, limit: 60, message: 'Too many configuration changes from this account. Please wait a moment.' });

// Low-frequency money support: refunds, payer portions and cash collection.
// 60 per user per 15 min bounds a runaway reconciliation loop.
const staffSupport = venueLimiter({ windowMs: 15 * 60 * 1000, limit: 60, message: 'Too many financial support actions from this account. Please wait a moment.' });

module.exports = { venueLimiter, staffCommands, staffConfigurations, staffSupport };
