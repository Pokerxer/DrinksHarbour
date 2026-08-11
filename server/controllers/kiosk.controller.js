// server/controllers/kiosk.controller.js
//
// Pairing screens to a tenant, and telling a paired screen who it belongs to.
//
// Two audiences in one file, with opposite gates, which is worth being explicit
// about:
//
//   * `session` answers a DEVICE — no login at all, authenticated by the token
//     in the header (kiosk.middleware.js). It is rendered on a screen anybody
//     can walk up to, so what it returns is limited to what is already painted
//     on the shopfront: the shop's name, mark, colour, and a COUNT of who is
//     clocked in. Never a name, never a list — the kiosk page has refused to
//     show a staff directory since it was written, and this endpoint is not the
//     place that quietly starts.
//
//   * the device routes answer an ADMIN, behind the usual chain. Pairing hands
//     back the only plaintext copy of a token that will ever exist.

const asyncHandler = require('../utils/asyncHandler');

const Tenant = require('../models/Tenant');
const Attendance = require('../models/Attendance');

const {
  parseRosterRange,
  tenantOffsetMinutes,
  tenantToday,
} = require('../services/shift.helpers');
const {
  generateKioskSecret,
  formatKioskToken,
  hashKioskSecret,
  sanitizeKioskDeviceName,
  presentKioskDevice,
} = require('../services/kioskToken.helpers');

/** The shop's identity, for a screen that has no session to read it from. */
function brandOf(tenant) {
  return {
    name: tenant?.name || '',
    logo: tenant?.logo?.url || '',
    primaryColor: tenant?.primaryColor || '',
  };
}

/**
 * GET /api/kiosk/session — who is this screen, and whose shop is it in?
 *
 * This is the endpoint that makes items 2 and 3 the same piece of work. On a
 * logged-out kiosk there is no session to read a tenant name from, so the
 * device token is the ONLY thing that knows which shop the screen belongs to —
 * and it is already being resolved to authorise the clock. The branding falls
 * out of the same call rather than needing a second mechanism.
 *
 * `pinAccepted: false` is the pad's instruction, not a hint: a public kiosk
 * takes badge scans only (see resolveClockCredential), and the screen must not
 * offer a PIN fallback the server will refuse.
 */
const session = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const offsetMinutes = tenantOffsetMinutes(req.tenant);
  const today = tenantToday(offsetMinutes);
  const range = parseRosterRange({ from: today, to: today }, offsetMinutes);

  // A count, never names. Same reasoning as the kiosk page's own comment: a pad
  // that names the staff is a directory of who works here, mounted where anyone
  // walking past can read it.
  const onShift = await Attendance.countDocuments({
    tenant: tenantId,
    status: 'open',
    ...(range.ok ? { clockIn: { $gte: range.start, $lt: range.end } } : {}),
  });

  res.json({
    success: true,
    data: {
      tenant: brandOf(req.tenant),
      device: { name: req.kioskDevice?.name || 'Kiosk' },
      onShift,
      pinAccepted: false,
    },
  });
});

// ── Pairing (admin) ──────────────────────────────────────────────────────────

/** GET /api/kiosk/devices — the screens paired to this shop. */
const listDevices = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenant?._id).select('kioskDevices').lean();
  const devices = (tenant?.kioskDevices || []).map(presentKioskDevice);
  res.json({ success: true, data: { devices } });
});

/**
 * POST /api/kiosk/devices { name } — pair a new screen.
 *
 * The response carries the ONLY plaintext copy of the token there will ever be.
 * Nothing stores it, so a manager who loses it pairs the device again and
 * revokes the old row — which is the same operation as replacing a lost tablet,
 * and is why devices are named rather than there being one token per shop.
 */
const pairDevice = asyncHandler(async (req, res) => {
  const secret = generateKioskSecret();

  const device = {
    name: sanitizeKioskDeviceName(req.body?.name),
    tokenHash: hashKioskSecret(secret),
    // Enough to tell two tablets apart in a list, far too little to reconstruct
    // the secret from.
    tokenHint: secret.slice(-4),
    createdAt: new Date(),
    createdBy: req.user?._id ?? null,
    lastSeenAt: null,
    revokedAt: null,
  };

  const tenant = await Tenant.findByIdAndUpdate(
    req.tenant?._id,
    { $push: { kioskDevices: device } },
    { new: true }
  ).select('kioskDevices');

  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const saved = tenant.kioskDevices[tenant.kioskDevices.length - 1];

  res.status(201).json({
    success: true,
    data: {
      device: presentKioskDevice(saved),
      // Shown once. The client is expected to say so.
      token: formatKioskToken(saved._id, secret),
    },
  });
});

/**
 * DELETE /api/kiosk/devices/:deviceId — cut one screen off.
 *
 * Stamped rather than pulled: the row is how a manager sees afterwards that the
 * tablet existed and when it stopped being trusted. resolveKioskDevice is what
 * makes the stamp bite, so the token printed on that tablet stops working the
 * moment this returns.
 */
const revokeDevice = asyncHandler(async (req, res) => {
  // $elemMatch, NOT two dotted conditions. `kioskDevices._id: x` and
  // `kioskDevices.revokedAt: null` as siblings are satisfied by DIFFERENT
  // elements of the array — a shop with one revoked device and one live one
  // would match while revoking either, and the positional `$` would then land
  // on whichever element the first condition found.
  const result = await Tenant.updateOne(
    {
      _id: req.tenant?._id,
      kioskDevices: { $elemMatch: { _id: req.params.deviceId, revokedAt: null } },
    },
    { $set: { 'kioskDevices.$.revokedAt': new Date() } }
  );

  if (!result.matchedCount) {
    return res.status(404).json({
      success: false,
      message: 'That kiosk device is not paired to your shop, or was already revoked',
    });
  }

  res.json({ success: true, message: 'Kiosk device revoked' });
});

module.exports = { session, listDevices, pairDevice, revokeDevice };
