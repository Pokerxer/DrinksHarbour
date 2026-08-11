// server/middleware/kiosk.middleware.js
//
// How a screen with nobody signed in to it gets a tenant.
//
// attendance.routes.js used to open with a comment saying the kiosk was NOT an
// exception to the admin gate, because the manager's JWT was carrying two
// things at once: which tenant the punch belongs to, and the authority to write
// it. That reasoning was right, and this file is what makes it possible to drop
// the login without dropping either job — the device token names a tenant, and
// possessing it is the authority.
//
// It is deliberately NOT a hole in the existing chain. `protect` and friends
// are untouched; `kioskOrAdmin` below picks one complete chain or the other,
// so a request either presents an admin JWT and goes through every gate it
// always did, or presents a device token and goes through this one.

const Tenant = require('../models/Tenant');
const asyncHandler = require('../utils/asyncHandler');
const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('./auth.middleware');
const {
  parseKioskToken,
  resolveKioskDevice,
} = require('../services/kioskToken.helpers');

/** Where the device sends its token. */
const KIOSK_TOKEN_HEADER = 'x-kiosk-token';

/**
 * The tenant fields a logged-out kiosk is allowed to know about.
 *
 * Narrower than TENANT_SELECT_FIELDS in tenant.middleware.js on purpose: this
 * response is rendered on a screen anybody can walk up to, so it carries the
 * shop's name, mark and colour — which are on the shopfront already — and
 * nothing about the plan, the revenue model or the margins.
 */
const KIOSK_TENANT_FIELDS =
  '_id name slug status subscriptionStatus primaryColor logo utcOffsetMinutes kioskDevices';

/**
 * One generic refusal, whatever went wrong.
 *
 * An unpaired device, a revoked one and a mistyped token all answer the same
 * way. Distinguishing them would let somebody holding half a token learn
 * whether the other half exists.
 */
function refuse(res) {
  return res.status(401).json({
    success: false,
    code: 'kiosk_unpaired',
    message: 'This kiosk is not paired. Ask a manager to pair it again.',
  });
}

/** Did this request even claim to be a kiosk? */
function hasKioskToken(req) {
  return Boolean(req.headers?.[KIOSK_TOKEN_HEADER]);
}

/**
 * Authenticate a device token and attach the tenant it names.
 *
 * On success `req.tenant` is set exactly as `attachTenant` would have set it,
 * so the controllers underneath cannot tell the difference and keep scoping
 * every query the same way. `req.kioskDevice` is what says the request came in
 * WITHOUT a login — the clock reads it to refuse a typed PIN.
 */
const authenticateKiosk = asyncHandler(async (req, res, next) => {
  const parsed = parseKioskToken(req.headers?.[KIOSK_TOKEN_HEADER]);
  if (!parsed) return refuse(res);

  let tenant;
  try {
    // The device id is the only thing we have to go on — there is no session to
    // narrow by, which is what the kioskDevices._id index exists for.
    tenant = await Tenant.findOne({ 'kioskDevices._id': parsed.deviceId })
      .select(KIOSK_TENANT_FIELDS)
      .lean();
  } catch (_) {
    return refuse(res);
  }
  if (!tenant) return refuse(res);

  const device = resolveKioskDevice(tenant.kioskDevices, parsed);
  if (!device) return refuse(res);

  // The same liveness test every other tenant-scoped route applies. A shop
  // whose subscription lapsed stops clocking staff in for the same reason it
  // stops taking orders — and failing closed here keeps a controller from
  // falling back to an unscoped query.
  if (tenant.status !== 'approved') return refuse(res);
  if (!['active', 'trialing'].includes(tenant.subscriptionStatus)) return refuse(res);

  // kioskDevices is stripped before the tenant goes any further: every other
  // tenant's hash is not in here, but this one's are, and nothing downstream
  // has any business reading them.
  const { kioskDevices, ...safeTenant } = tenant;
  req.tenant = safeTenant;
  req.kioskDevice = { _id: device._id, name: device.name };

  // Best effort, and not awaited: the settings list wants to show which screens
  // are still alive, but a failed bookkeeping write must never cost somebody
  // their clock-in.
  Tenant.updateOne(
    { _id: tenant._id, 'kioskDevices._id': device._id },
    { $set: { 'kioskDevices.$.lastSeenAt': new Date() } }
  ).catch(() => {});

  return next();
});

/**
 * The gates a request had to pass to clock somebody in before the kiosk went
 * public. Held here, in full, rather than left at the call site — this file is
 * the one place that decides who may punch, so the alternative to a device
 * token is written down next to it.
 */
const ADMIN_CLOCK_CHAIN = [protect, attachTenant, requireOwnTenant, tenantAdminOrSuperAdmin];

/**
 * Take EITHER a paired device OR a signed-in admin — one whole chain or the
 * other, never a mixture.
 *
 * The in-app kiosk (a manager with the tablet already signed in) keeps working
 * unchanged: a request with no device token is routed straight down the
 * middleware it has always used, in the same order, with nothing relaxed.
 *
 * A single exported middleware rather than a factory, deliberately. Two
 * reasons, and the second is the load-bearing one:
 *   * there is only one answer to "who may punch", so a per-route chain would
 *     be a way to configure a weaker one;
 *   * __tests__/routeGuardCoverage.test.js recognises a guard by FUNCTION
 *     IDENTITY against the middleware modules. A factory returns a fresh
 *     closure each call, which no identity check can see — so the endpoint
 *     would have had to be allowlisted as "public", which it is not.
 */
const kioskOrAdmin = (req, res, next) => {
  if (hasKioskToken(req)) return authenticateKiosk(req, res, next);

  // The admin chain is run by hand rather than mounted with `router.use`, which
  // would apply it to the kiosk path too. Running it here keeps the gates
  // themselves untouched: no `if` was added inside any of them, which is how a
  // bypass ends up somewhere nobody is looking.
  let i = 0;
  const step = (err) => {
    if (err) return next(err);
    const mw = ADMIN_CLOCK_CHAIN[i];
    i += 1;
    if (!mw) return next();
    return mw(req, res, step);
  };
  return step();
};

module.exports = {
  KIOSK_TOKEN_HEADER,
  hasKioskToken,
  authenticateKiosk,
  kioskOrAdmin,
};
