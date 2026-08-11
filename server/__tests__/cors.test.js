// The CORS allowlist has to name every custom header this API authenticates
// with, or the browser refuses to send it and the caller sees a bare
// "Failed to fetch" with no status at all.
//
// This exists because `x-kiosk-token` shipped without being added to
// `allowedHeaders`. Every server test passed, every curl passed, and the public
// kiosk was still completely dead in a browser: curl does not implement CORS,
// and the suite has no browser, so the one component that enforces the rule was
// the only one not represented. The preflight even answered 204 — it is the
// BROWSER that compares the requested header against the returned list and
// blocks the real request, so nothing server-side looks wrong.
//
// A header used for AUTH is the dangerous case, which is why the assertion is
// driven off the middleware that defines it rather than a hand-copied string:
// rename the header there and this test fails instead of the kiosk.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert');

const { corsOptions } = require('../config/cors');
const { KIOSK_TOKEN_HEADER } = require('../middleware/kiosk.middleware');

/** Header names are case-insensitive; the allowlist is compared as such. */
const allowed = () => corsOptions.allowedHeaders.map((h) => h.toLowerCase());

test('CORS allows the kiosk device-token header', () => {
  assert.ok(
    allowed().includes(KIOSK_TOKEN_HEADER.toLowerCase()),
    `${KIOSK_TOKEN_HEADER} is missing from corsOptions.allowedHeaders, so a ` +
      'browser will block every kiosk request before it is sent'
  );
});

test('CORS still allows the headers the admin app authenticates with', () => {
  // Regression cover for the rest of the list: this is the file somebody edits
  // when adding a header, and dropping one of these logs the whole admin out.
  for (const header of ['authorization', 'content-type', 'x-mfa-token', 'x-tenant-slug']) {
    assert.ok(allowed().includes(header), `${header} must stay allowed`);
  }
});

/** The origin callback, as a plain predicate. */
function accepts(origin) {
  let ok = false;
  corsOptions.origin(origin, (err, allow) => {
    ok = !err && allow === true;
  });
  return ok;
}

test('the dev origins every local app runs on are allowed', () => {
  // Named individually because this list was once truncated while being moved
  // between files, and losing an entry only shows up as "Failed to fetch" in
  // whichever app happened to be on the dropped port.
  for (const origin of [
    'http://localhost:3000', // admin
    'http://localhost:3001',
    'http://localhost:3002', // platform
    'http://localhost:3003',
    'http://127.0.0.1:3000',
  ]) {
    assert.ok(accepts(origin), `${origin} must be an allowed origin`);
  }
});

test('production and tenant-subdomain origins are allowed, strangers are not', () => {
  assert.ok(accepts('https://www.drinksharbour.com'));
  assert.ok(accepts('https://admin.drinksharbour.com'));
  assert.ok(accepts('https://wyncity.drinksharbour.com'));
  assert.ok(accepts(undefined), 'no-origin (curl, server-to-server) is allowed');

  assert.ok(!accepts('https://drinksharbour.com.evil.test'), 'suffix attack refused');
  assert.ok(!accepts('http://drinksharbour.com'), 'plain http on the real domain refused');
  assert.ok(!accepts('https://example.test'), 'unrelated origin refused');
});

test('every allowed header is a plain token, not a comma-joined list', () => {
  // `allowedHeaders: ['a,b']` is silently wrong: the cors package joins the
  // array with commas, so a comma inside an entry still produces a valid-looking
  // header and hides a typo that only breaks in a browser.
  for (const header of corsOptions.allowedHeaders) {
    assert.ok(
      !header.includes(',') && header.trim() === header && header !== '',
      `"${header}" is not a single header name`
    );
  }
});
