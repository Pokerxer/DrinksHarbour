// server/services/kioskToken.helpers.js
//
// The credential that lets a screen on a shop counter clock people in without
// anybody logging in.
//
// WHY THIS EXISTS
// ---------------
// Every route in attendance.routes.js used to sit behind a manager's JWT, and
// the comment at the top of that file explains why: the JWT was doing TWO jobs.
// It said which tenant the punch belonged to, and it was the only thing
// authorising the write. Taking the login away takes both, so something has to
// replace them — a clock that cannot name a tenant cannot look anybody up, and
// a public /clock with nothing in front of it is an oracle for guessing badge
// numbers over the whole internet.
//
// This is that replacement, shaped after Odoo's kiosk: a long random token in
// the URL, issued to a named device, revocable on its own.
//
// THE TOKEN IS TWO PARTS: `<deviceId>.<secret>`
//
//   deviceId — the subdocument's ObjectId. PUBLIC, and deliberately so: with no
//   session there is no tenant, so the lookup has to start somewhere. It is an
//   indexed key into `tenant.kioskDevices`, which is what makes resolution one
//   query instead of a scan over every tenant's device list comparing hashes.
//
//   secret — 32 bytes from the CSPRNG. This is the part that authorises.
//
// Only the secret's HASH is stored. The token lives in a browser URL bar on a
// tablet that sits in a shop all day; the least we can do is make sure a dump
// of the tenants collection is not a set of working kiosks.

const crypto = require('crypto');

/**
 * 32 bytes. The token is a bearer credential on an internet-facing endpoint
 * with no second factor and no account to lock, so there is no budget for
 * "probably enough".
 */
const KIOSK_SECRET_BYTES = 32;

/** A device name is a label in a settings list, not prose. */
const KIOSK_DEVICE_NAME_MAX = 60;
const DEFAULT_KIOSK_DEVICE_NAME = 'Kiosk';

/** ObjectId, exactly — see parseKioskToken for why this is checked here. */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
/** base64url: the alphabet `generateKioskSecret` emits, and nothing else. */
const SECRET_RE = /^[A-Za-z0-9_-]+$/;

/**
 * A fresh kiosk secret, base64url.
 *
 * URL-safe on purpose: this ends up in a path as `/kiosk/<token>`, and standard
 * base64's `+` and `/` would either be mangled by the path or arrive
 * percent-encoded — one copy-paste away from not matching what was stored.
 */
function generateKioskSecret() {
  return crypto.randomBytes(KIOSK_SECRET_BYTES).toString('base64url');
}

/** The string a device is paired with. */
function formatKioskToken(deviceId, secret) {
  return `${deviceId}.${secret}`;
}

/**
 * Split a token into the device it names and the secret that proves it.
 *
 * Returns null for anything malformed rather than throwing. This runs on a
 * public endpoint, so every rejection here is a request somebody sent on
 * purpose: a cast error on a bad device id would be a 500 that a caller can
 * trigger at will, and the shape check is cheaper than the query it avoids.
 *
 * `split` is deliberately NOT limited to the first separator — a secret we
 * generated never contains a dot, so a token with two is not ours.
 */
function parseKioskToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [deviceId, secret] = parts;
  if (!OBJECT_ID_RE.test(deviceId)) return null;
  if (!secret || !SECRET_RE.test(secret)) return null;
  return { deviceId, secret };
}

/**
 * The stored form of a secret.
 *
 * A plain SHA-256, not bcrypt, and that is a considered choice rather than a
 * shortcut: bcrypt's cost exists to slow down guessing a HUMAN-CHOSEN secret
 * out of a small space. This secret is 256 bits from the CSPRNG, so there is
 * nothing to guess and no dictionary to precompute — and the comparison runs on
 * every single clock press, where a deliberately slow hash would be a lever for
 * anybody who wants to exhaust the shop's server.
 */
function hashKioskSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

/**
 * Does this secret hash to what we stored?
 *
 * Constant-time, because the comparison runs against a value the caller
 * controls and a short-circuiting `===` leaks the length of the shared prefix.
 * Both false cases below are real: a device row that lost its hash must be
 * unusable rather than universally usable, and `timingSafeEqual` THROWS on a
 * length mismatch — which on a public endpoint is a 500 anybody can trigger.
 */
function kioskSecretMatches(secret, storedHash) {
  if (typeof storedHash !== 'string' || storedHash === '') return false;
  const computed = Buffer.from(hashKioskSecret(secret), 'utf8');
  const stored = Buffer.from(storedHash, 'utf8');
  if (computed.length !== stored.length) return false;
  return crypto.timingSafeEqual(computed, stored);
}

/**
 * Revocation, checked at the point of use.
 *
 * The row is kept rather than pulled so the settings list can still show that
 * the tablet in the taxi existed and when it was cut off — but the token is
 * already printed on that tablet, so the check that matters is this one.
 */
function isKioskDeviceActive(device) {
  return !device?.revokedAt;
}

/**
 * The device a parsed token refers to, or null.
 *
 * One place, so the clock and the branding endpoint cannot come to different
 * conclusions about whether a screen is still paired.
 */
function resolveKioskDevice(devices, parsed) {
  if (!Array.isArray(devices) || !parsed) return null;
  const device = devices.find((d) => String(d?._id) === String(parsed.deviceId));
  if (!device) return null;
  if (!isKioskDeviceActive(device)) return null;
  if (!kioskSecretMatches(parsed.secret, device.tokenHash)) return null;
  return device;
}

/**
 * A device name a human can pick out of a list.
 *
 * Never blank: the name is the only thing an admin has to decide which row to
 * revoke, and a blank row is a choice nobody can make correctly.
 */
function sanitizeKioskDeviceName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return DEFAULT_KIOSK_DEVICE_NAME;
  return trimmed.slice(0, KIOSK_DEVICE_NAME_MAX);
}

/**
 * What the settings screen is allowed to see.
 *
 * Field-by-field rather than a delete of `tokenHash`, so a field added to the
 * schema later is absent here until somebody decides it should be shown.
 */
function presentKioskDevice(device) {
  return {
    _id: device?._id,
    name: device?.name || DEFAULT_KIOSK_DEVICE_NAME,
    tokenHint: device?.tokenHint || '',
    createdAt: device?.createdAt || null,
    lastSeenAt: device?.lastSeenAt || null,
    revokedAt: device?.revokedAt || null,
    active: isKioskDeviceActive(device),
  };
}

module.exports = {
  KIOSK_SECRET_BYTES,
  KIOSK_DEVICE_NAME_MAX,
  DEFAULT_KIOSK_DEVICE_NAME,
  generateKioskSecret,
  formatKioskToken,
  parseKioskToken,
  hashKioskSecret,
  kioskSecretMatches,
  isKioskDeviceActive,
  resolveKioskDevice,
  sanitizeKioskDeviceName,
  presentKioskDevice,
};
