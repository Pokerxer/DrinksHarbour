// server/__tests__/badgeNumber.index.test.js
//
// The badge number is a credential you can type into the kiosk, so two people
// in the same shop must never hold the same one. This asserts the SHAPE of the
// guarantee, not just its existence — the two ways of getting it wrong here
// have both bitten this repo before:
//
//   * a field-level `unique: true` makes the number unique GLOBALLY, across
//     every tenant in the shared collection, so tenant B cannot be issued a
//     number tenant A happens to hold. Mongoose also never re-options or drops
//     an index once created, so that mistake outlives the line that made it.
//
//   * a plain (non-partial) unique index treats "no badge" as a value, so the
//     SECOND employee without one collides on null.

const test = require('node:test');
const assert = require('node:assert');

const User = require('../models/User');
const { BADGE_NUMBER_PATH } = require('../services/badgeNumber.helpers');

/** The declared index whose key is exactly {tenant, <badge path>}. */
function badgeIndex() {
  return User.schema
    .indexes()
    .find(([key]) => key.tenant === 1 && key[BADGE_NUMBER_PATH] === 1);
}

test('the badge number is unique per tenant, by compound index', () => {
  const found = badgeIndex();
  assert.ok(found, `User declares no {tenant, ${BADGE_NUMBER_PATH}} index`);
  const [key, options] = found;
  assert.deepStrictEqual(Object.keys(key), ['tenant', BADGE_NUMBER_PATH]);
  assert.strictEqual(options.unique, true);
});

test('the badge index covers only employees who actually have a badge', () => {
  // Most Users — every customer, and staff before the backfill — have no badge
  // at all. Without a partial filter the second such document collides on the
  // missing value and cannot be saved.
  const [, options] = badgeIndex();
  const filter = options.partialFilterExpression;
  assert.ok(filter, 'badge index is not partial');
  assert.deepStrictEqual(Object.keys(filter), [BADGE_NUMBER_PATH]);
});

test('rfidBadge does not declare a field-level unique', () => {
  // The one that enforces GLOBAL uniqueness. Isolation in this repo is
  // shared-DB row-level `tenant`, so uniqueness must be compound.
  const path = User.schema.path(BADGE_NUMBER_PATH);
  assert.ok(path, `${BADGE_NUMBER_PATH} is not a declared schema path`);
  assert.notStrictEqual(path.options?.unique, true);
});

test('rfidBadge is still free text', () => {
  // A business with pre-printed cards puts its own numbering in this field.
  // Constraining it to our 8 digits would lock them out of their own scheme.
  const path = User.schema.path(BADGE_NUMBER_PATH);
  assert.strictEqual(path.instance, 'String');
  assert.strictEqual(path.options?.enum, undefined);
  assert.strictEqual(path.options?.match, undefined);
});
