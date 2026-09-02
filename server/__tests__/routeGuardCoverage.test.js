// Every mutating endpoint (POST/PUT/PATCH/DELETE) in server/routes must carry
// an authentication guard, unless it is on the allowlist below.
//
// This exists because five brand-mutation routes shipped under a comment
// reading "// Protected routes (existing)" with no guard at all, and stayed
// that way in production until an audit on 2026-08-07 — an anonymous
// DELETE /api/brands/:id would have deleted a brand. Nothing was watching.
//
// The walk uses the live Express routers rather than parsing source: requiring
// a route file yields a router whose `stack` already has router.use(...)
// globals and guard-array variables (e.g. banner.routes.js's
// `const adminOnly = [protect, authorize(...)]`) composed by Express itself.
// A guard is recognised by function identity against the middleware modules,
// so renaming or rewrapping one cannot fool it.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.5

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

// optionalProtect is deliberately absent: it calls next() when no token is
// present, so it authenticates nobody. Routes that use it are allowlisted below.
//
// hasKioskToken is absent for a stronger reason: it is a PREDICATE, not a gate.
// It answers "did this request claim to be a kiosk", which is the question
// kioskOrAdmin asks before choosing a chain — used on its own in front of a
// route it would authenticate precisely nobody.
const NOT_A_GUARD = new Set(['optionalProtect', 'hasKioskToken']);

/** Every exported middleware that actually refuses an unauthenticated caller. */
function collectGuards() {
  const guards = new Set();
  for (const mod of [
    '../middleware/auth.middleware',
    '../middleware/tenant.middleware',
    '../middleware/pos.middleware',
    // The attendance kiosk. Its guards authenticate a paired DEVICE rather than
    // a person — a long random token that names the tenant and is revocable —
    // so /clock is guarded without being behind a login. It is listed here, and
    // NOT on the public allowlist below, because the distinction matters: the
    // allowlist turns the check off, and this endpoint genuinely refuses an
    // unauthenticated caller.
    '../middleware/kiosk.middleware',
  ]) {
    for (const [name, value] of Object.entries(require(mod))) {
      if (typeof value === 'function' && !NOT_A_GUARD.has(name)) guards.add(value);
    }
  }
  return guards;
}

// ─── Public allowlist ────────────────────────────────────────────────────────
// Every entry is a mutating endpoint that is unauthenticated ON PURPOSE.
// Adding a line here is a security decision — say why.
const PUBLIC_ALLOWLIST = new Set([
  // Anonymous analytics beacons. No read path, no PII, write-only counters.
  'POST analytics.routes.js /track',
  'POST analytics.routes.js /track/duration',
  'PATCH analytics.routes.js /track/duration',
  'POST analytics.routes.js /track/conversion',
  'POST banner.routes.js /:id/impression',
  'POST banner.routes.js /:id/click',
  // Same class, added later under banner.routes.js's "Public storefront
  // endpoints" heading without the allowlist being updated: write-only counters
  // on a banner the storefront just showed an anonymous visitor. The /entity
  // pair is the brand/category/subcategory hero equivalent.
  'POST banner.routes.js /:id/conversion',
  'POST banner.routes.js /entity/:type/:id/impression',
  'POST banner.routes.js /entity/:type/:id/click',
  'POST sale.routes.js /:id/view',
  'POST product.routes.js /cart/:id',

  // Public TTS: read-aloud of product search results via Fish Audio. No PII,
  // no writes — text in, audio out; rate-limited (30/15min) and char-capped.
  'POST tts.routes.js /',

  // Storefront: a guest must be able to shop before signing in.
  'POST cart.routes.js /validate',
  'POST coupon.routes.js /validate',
  'POST coupon.routes.js /auto-apply',
  'POST order.routes.js /', // guest checkout — uses optionalProtect, not protect

  // Public chatbot on the storefront.
  'POST chatbot.routes.js /greeting',
  'POST chatbot.routes.js /query',
  'POST chatbot.routes.js /escalate',

  // Payment-provider webhooks. Authenticated by provider signature over the
  // raw body, not by a session — a bearer token is impossible here.
  'POST payment.routes.js /webhooks/stripe',
  'POST payment.routes.js /webhooks/paystack',
  'POST payment.routes.js /webhooks/korapay',
  'POST erm.routes.js /webhook',

  // Authentication entry points — by definition reachable without a session.
  'POST user.routes.js /register',
  'POST user.routes.js /login',
  'POST user.routes.js /forgot-password',
  'POST user.routes.js /reset-password/:token', // authenticated by the emailed token
  'POST user.routes.js /verify-email',
  'POST user.routes.js /resend-verification',
  'POST user.routes.js /refresh-token',         // authenticated by the refresh cookie
  'POST user.routes.js /mfa/verify',            // authenticated by the partial MFA token
  'POST verification.routes.js /send-code',
  'POST verification.routes.js /verify-code',
  'POST verification.routes.js /resend-code',
  'POST pos.routes.js /auth/pin-login',
  'POST pos.routes.js /auth/staff-login',

  // Self-service tenant signup: the applicant has no account yet.
  'POST tenant.routes.js /apply',

  // Phone-to-desktop image handoff, authenticated by the one-time :code in the
  // URL that the desktop session generated.
  'POST scan.routes.js /upload-mobile/:code',
]);

/** Walks one router and appends every unguarded mutating endpoint to `out`. */
function walk(file, router, label, guards, out, counter) {
  let globalGuard = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (guards.has(layer.handle)) globalGuard = true;
      continue;
    }

    const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
    if (!methods.some((m) => MUTATING.has(m))) continue;

    counter.total += 1;
    const routeGuard = layer.route.stack.some((sub) => guards.has(sub.handle));
    if (routeGuard || globalGuard) continue;

    for (const method of methods.filter((m) => MUTATING.has(m))) {
      out.push(`${method.toUpperCase()} ${file}${label} ${layer.route.path}`);
    }
  }
}

function findUnguarded() {
  const guards = collectGuards();
  const out = [];
  const counter = { total: 0 };

  for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js')).sort()) {
    const mod = require(path.join(ROUTES_DIR, file));

    if (mod && Array.isArray(mod.stack)) {
      walk(file, mod, '', guards, out, counter);
      continue;
    }
    // appraisal.routes.js exports { cycleRouter, appraisalRouter, ... }
    if (mod && typeof mod === 'object') {
      for (const [key, value] of Object.entries(mod)) {
        if (value && Array.isArray(value.stack)) walk(file, value, `[${key}]`, guards, out, counter);
      }
    }
  }

  return { unguarded: out, total: counter.total };
}

test('every mutating endpoint is guarded, or explicitly allowlisted as public', () => {
  const { unguarded } = findUnguarded();
  const unexpected = unguarded.filter((e) => !PUBLIC_ALLOWLIST.has(e)).sort();

  assert.deepStrictEqual(
    unexpected,
    [],
    'These mutating endpoints accept an anonymous caller. Add a guard, or add ' +
    'the endpoint to PUBLIC_ALLOWLIST with a comment saying why it is public:\n  ' +
    unexpected.join('\n  ')
  );
});

test('the allowlist has no stale entries', () => {
  // A guarded route left on the allowlist would silently excuse the next
  // regression on that same path.
  const { unguarded } = findUnguarded();
  const live = new Set(unguarded);
  const stale = [...PUBLIC_ALLOWLIST].filter((e) => !live.has(e)).sort();

  assert.deepStrictEqual(
    stale,
    [],
    `These allowlist entries are guarded now (or the route moved) — remove them:\n  ${stale.join('\n  ')}`
  );
});

test('the walk actually covered the route tree', () => {
  // Guards against the whole test silently passing because nothing loaded.
  const { total } = findUnguarded();
  assert.ok(total > 400, `expected 400+ mutating endpoints, walked ${total}`);
});

test('the five brand routes that were open are guarded now', () => {
  const { unguarded } = findUnguarded();
  for (const entry of unguarded) {
    assert.ok(
      !entry.includes('brand.routes.js'),
      `brand.routes.js must have no unguarded mutating endpoint, found: ${entry}`
    );
  }
});
