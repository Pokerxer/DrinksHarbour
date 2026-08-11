// server/__tests__/kioskToken.helpers.test.js
//
// The kiosk token is what replaces a manager's login on a screen left on a
// shop counter. It has to do two jobs the JWT used to do — say WHICH TENANT
// the screen belongs to, and prove the screen is allowed to post punches —
// without a person being signed in.
//
// So it is a bearer credential printed into a URL that sits on a tablet all
// day, which sets every rule below: it must be unguessable, it must name the
// device it was issued to so ONE tablet can be revoked without re-pairing the
// rest, and the stored copy must be a hash so a leaked database dump is not a
// set of working kiosks.

const test = require('node:test');
const assert = require('node:assert');

const {
  KIOSK_SECRET_BYTES,
  generateKioskSecret,
  formatKioskToken,
  parseKioskToken,
  hashKioskSecret,
  kioskSecretMatches,
  isKioskDeviceActive,
  resolveKioskDevice,
  sanitizeKioskDeviceName,
  presentKioskDevice,
} = require('../services/kioskToken.helpers');

const DEVICE_ID = '64b7f3c2a1e4d5b6c7a8f9e0';
const OTHER_ID = '64b7f3c2a1e4d5b6c7a8f9e1';

// ── The secret ───────────────────────────────────────────────────────────────

test('a kiosk secret carries at least 128 bits of entropy', () => {
  // The endpoint it unlocks writes attendance for a whole tenant and is
  // reachable from the internet, so the secret is the only thing between a
  // script and somebody else's timesheets. 32 bytes, not "long enough".
  assert.ok(KIOSK_SECRET_BYTES >= 16);
  assert.ok(generateKioskSecret().length >= 22);
});

test('a kiosk secret is URL-safe', () => {
  // It is pasted into a browser bar as /kiosk/<token>. Base64 with + and /
  // would be mangled by the path, and a percent-encoded secret is one
  // copy-paste away from not matching what was stored.
  assert.match(generateKioskSecret(), /^[A-Za-z0-9_-]+$/);
});

test('two kiosk secrets are different', () => {
  assert.notStrictEqual(generateKioskSecret(), generateKioskSecret());
});

// ── The token: device id + secret ────────────────────────────────────────────

test('a token round-trips through format and parse', () => {
  const secret = generateKioskSecret();
  const parsed = parseKioskToken(formatKioskToken(DEVICE_ID, secret));
  assert.deepStrictEqual(parsed, { deviceId: DEVICE_ID, secret });
});

test('the token names the device, so the tenant can be found without a session', () => {
  // This is the whole reason the id is IN the token rather than the secret
  // standing alone. With no JWT there is no tenant, and scanning every
  // tenant's device list to find a matching hash is both slow and a way to
  // learn that a given secret exists somewhere.
  const token = formatKioskToken(DEVICE_ID, 'abc123');
  assert.strictEqual(parseKioskToken(token).deviceId, DEVICE_ID);
});

test('a token with no device id is refused', () => {
  assert.strictEqual(parseKioskToken('justasecret'), null);
});

test('a token whose device id is not an object id is refused', () => {
  // Refused HERE rather than at the database: a device id that is not an
  // ObjectId makes the lookup throw a cast error, which is a 500 for what is
  // really a malformed URL.
  assert.strictEqual(parseKioskToken('not-an-id.abc123'), null);
});

test('a token with an empty secret is refused', () => {
  // Otherwise a device whose hash is missing would be matched by a bare id.
  assert.strictEqual(parseKioskToken(`${DEVICE_ID}.`), null);
});

test('a token carrying anything but base64url in its secret is refused', () => {
  assert.strictEqual(parseKioskToken(`${DEVICE_ID}.abc.123`), null);
  assert.strictEqual(parseKioskToken(`${DEVICE_ID}.abc/123`), null);
});

test('a token that is not a string is refused', () => {
  assert.strictEqual(parseKioskToken(undefined), null);
  assert.strictEqual(parseKioskToken(null), null);
  assert.strictEqual(parseKioskToken({ deviceId: DEVICE_ID }), null);
});

// ── Storage ──────────────────────────────────────────────────────────────────

test('the stored hash is not the secret', () => {
  // A database dump of kiosk devices must not be a set of working kiosks.
  const secret = generateKioskSecret();
  const hash = hashKioskSecret(secret);
  assert.notStrictEqual(hash, secret);
  assert.ok(!hash.includes(secret));
});

test('hashing the same secret twice gives the same hash', () => {
  // No per-row salt on purpose: the secret is 32 random bytes we generated,
  // so there is no dictionary to precompute and a salt would only stop us
  // finding the row by id — which is exactly what the device id is for.
  const secret = generateKioskSecret();
  assert.strictEqual(hashKioskSecret(secret), hashKioskSecret(secret));
});

test('a secret matches its own hash', () => {
  const secret = generateKioskSecret();
  assert.strictEqual(kioskSecretMatches(secret, hashKioskSecret(secret)), true);
});

test('a different secret does not match', () => {
  assert.strictEqual(
    kioskSecretMatches(generateKioskSecret(), hashKioskSecret(generateKioskSecret())),
    false
  );
});

test('a missing stored hash never matches', () => {
  // A device row that somehow lost its hash must be unusable, not universally
  // usable. `timingSafeEqual` on undefined would throw; the answer is false.
  assert.strictEqual(kioskSecretMatches('abc', undefined), false);
  assert.strictEqual(kioskSecretMatches('abc', null), false);
  assert.strictEqual(kioskSecretMatches('abc', ''), false);
});

test('comparing against a hash of the wrong length answers false rather than throwing', () => {
  // crypto.timingSafeEqual throws on a length mismatch, and a throw here is a
  // 500 on a public endpoint that a caller can trigger at will.
  assert.strictEqual(kioskSecretMatches('abc', 'deadbeef'), false);
});

// ── Revocation ───────────────────────────────────────────────────────────────

test('a device is active until it is revoked', () => {
  assert.strictEqual(isKioskDeviceActive({ revokedAt: null }), true);
  assert.strictEqual(isKioskDeviceActive({}), true);
});

test('a revoked device is not active', () => {
  // The point of naming devices: a tablet left in a taxi is revoked on its own
  // and every other screen in the shop keeps working.
  assert.strictEqual(isKioskDeviceActive({ revokedAt: new Date() }), false);
});

// ── Resolution ───────────────────────────────────────────────────────────────

function deviceList() {
  return [
    { _id: DEVICE_ID, name: 'Front counter', tokenHash: hashKioskSecret('front-secret') },
    {
      _id: OTHER_ID,
      name: 'Warehouse door',
      tokenHash: hashKioskSecret('door-secret'),
      revokedAt: new Date(),
    },
  ];
}

test('resolution returns the device the token names', () => {
  const device = resolveKioskDevice(deviceList(), {
    deviceId: DEVICE_ID,
    secret: 'front-secret',
  });
  assert.strictEqual(device.name, 'Front counter');
});

test('resolution refuses a device id that is not in the list', () => {
  assert.strictEqual(
    resolveKioskDevice(deviceList(), { deviceId: '64b7f3c2a1e4d5b6c7a8f9ff', secret: 'front-secret' }),
    null
  );
});

test('resolution refuses the right device with the wrong secret', () => {
  // The whole point. A device id is public — it is in a URL on a counter.
  assert.strictEqual(
    resolveKioskDevice(deviceList(), { deviceId: DEVICE_ID, secret: 'door-secret' }),
    null
  );
});

test('resolution refuses a revoked device even with the right secret', () => {
  // Revocation has to bite at the point of use, not merely hide the row in a
  // settings list: the token is already printed on a tablet somewhere.
  assert.strictEqual(
    resolveKioskDevice(deviceList(), { deviceId: OTHER_ID, secret: 'door-secret' }),
    null
  );
});

test('resolution survives a tenant with no devices at all', () => {
  assert.strictEqual(resolveKioskDevice(undefined, { deviceId: DEVICE_ID, secret: 'x' }), null);
  assert.strictEqual(resolveKioskDevice([], { deviceId: DEVICE_ID, secret: 'x' }), null);
});

// ── Presentation ─────────────────────────────────────────────────────────────

test('a device is never presented with its hash', () => {
  // The settings screen lists paired devices. Shipping the hash there would
  // put it in a browser, in a log, and in whatever proxies the response.
  const shown = presentKioskDevice(deviceList()[0]);
  assert.strictEqual(shown.tokenHash, undefined);
  assert.strictEqual(shown.name, 'Front counter');
});

test('a device name is trimmed', () => {
  assert.strictEqual(sanitizeKioskDeviceName('  Front counter  '), 'Front counter');
});

test('a device with no name still gets one', () => {
  // The name is how an admin decides which row to revoke. A blank row is a
  // choice nobody can make correctly.
  assert.ok(sanitizeKioskDeviceName('').length > 0);
  assert.ok(sanitizeKioskDeviceName(undefined).length > 0);
});

test('a device name is capped', () => {
  assert.ok(sanitizeKioskDeviceName('x'.repeat(500)).length <= 60);
});
