// server/__tests__/badgeNumber.helpers.test.js
//
// Badge numbers exist so the badge card can carry a 1-D barcode. That is the
// whole constraint: the QR payload defaults to a 24-character ObjectId, which
// at CR80 card width works out at roughly a 0.15mm bar — well under the ~0.19mm
// an entry-level laser scanner can read. Every rule here is about staying
// scannable and staying unguessable.

const test = require('node:test');
const assert = require('node:assert');

const {
  BADGE_NUMBER_LENGTH,
  BADGE_NUMBER_PATH,
  generateBadgeNumber,
  isBadgeNumber,
  formatBadgeNumber,
  isDuplicateBadgeNumberError,
  needsBadgeNumber,
  withBadgeNumber,
  carryOverBadgeNumber,
  assignBadgeNumber,
} = require('../services/badgeNumber.helpers');

// A duplicate-key error shaped the way the driver reports one. Built here
// rather than mocked at the module boundary so the predicate is tested against
// the real shape (code + keyPattern), not against our idea of it.
function duplicateKeyError(keyPath) {
  const err = new Error(
    `E11000 duplicate key error collection: test.users index: ${keyPath}_1 dup key`
  );
  err.code = 11000;
  err.keyPattern = { tenant: 1, [keyPath]: 1 };
  err.keyValue = { tenant: 't1', [keyPath]: '12345678' };
  return err;
}

test('a badge number is all digits', () => {
  // NOT decoration. CODE_128 encodes a pair of digits in one symbol (Code Set
  // C) but only one letter per symbol, so an alphanumeric code of the same
  // length is twice as wide on the card. Digits are what makes it fit.
  const code = generateBadgeNumber();
  assert.match(code, /^[0-9]+$/);
});

test('a badge number is a fixed length', () => {
  for (let i = 0; i < 50; i += 1) {
    assert.strictEqual(generateBadgeNumber().length, BADGE_NUMBER_LENGTH);
  }
});

test('a badge number never starts with a zero', () => {
  // A leading zero does not survive a round trip through a spreadsheet, and a
  // code that silently loses a character stops matching the card.
  const rand = () => 0; // the lowest value the generator can be handed
  assert.strictEqual(generateBadgeNumber(rand)[0] !== '0', true);
});

test('a badge number is drawn from the whole space, not a sequence', () => {
  // Sequential numbering would make every colleague's badge guessable from
  // your own, and the kiosk accepts a typed badge number — physical possession
  // is only the credential if the number cannot be worked out.
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) seen.add(generateBadgeNumber());
  assert.ok(seen.size > 190, `expected near-unique draws, got ${seen.size}`);
});

test('generateBadgeNumber takes its randomness from the caller', () => {
  // Injected so the collision-retry loop can be tested without waiting for a
  // one-in-ten-million coincidence.
  const scripted = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let i = 0;
  const rand = (max) => scripted[i++ % scripted.length] % max;
  const code = generateBadgeNumber(rand);
  assert.strictEqual(code.length, BADGE_NUMBER_LENGTH);
  assert.match(code, /^[0-9]+$/);
});

test('isBadgeNumber accepts what the generator produces', () => {
  for (let i = 0; i < 20; i += 1) {
    assert.strictEqual(isBadgeNumber(generateBadgeNumber()), true);
  }
});

test('isBadgeNumber refuses anything that is not a plain fixed-length number', () => {
  assert.strictEqual(isBadgeNumber(''), false);
  assert.strictEqual(isBadgeNumber('1234567'), false); // too short
  assert.strictEqual(isBadgeNumber('123456789'), false); // too long
  assert.strictEqual(isBadgeNumber('0123456'), false); // leading zero
  assert.strictEqual(isBadgeNumber('12 34567'), false);
  assert.strictEqual(isBadgeNumber('ABCDEFGH'), false);
  assert.strictEqual(isBadgeNumber(null), false);
  assert.strictEqual(isBadgeNumber(12345678), false); // a string, not a number
});

test('isBadgeNumber says nothing about a hand-entered badge', () => {
  // rfidBadge stays free text: a business with pre-printed cards puts THEIR
  // number in it, and that must keep working. This predicate only answers
  // "did we generate this", which is what the backfill needs to know.
  assert.strictEqual(isBadgeNumber('STAFF-0042'), false);
});

test('formatBadgeNumber groups the digits for a human to read aloud', () => {
  assert.strictEqual(formatBadgeNumber('12345678'), '1234 5678');
});

test('formatBadgeNumber leaves a hand-entered badge exactly as it is', () => {
  // Never reformat somebody else's numbering scheme.
  assert.strictEqual(formatBadgeNumber('STAFF-0042'), 'STAFF-0042');
  assert.strictEqual(formatBadgeNumber(''), '');
});

// ── Assignment: the index is the arbiter ─────────────────────────────────────
//
// Uniqueness is enforced by a compound partial index on
// {tenant, employeeProfile.attendance.rfidBadge}, so the only honest way to
// find out whether a number is free is to try to write it. A read-then-write
// check would still lose the race between two managers adding staff at once.
// Hence: generate, attempt, and retry only when the DATABASE says it clashed.

test('assignBadgeNumber hands the writer a fresh badge number and returns what it wrote', async () => {
  const seen = [];
  const saved = await assignBadgeNumber(async (code) => {
    seen.push(code);
    return { rfidBadge: code };
  });
  assert.strictEqual(seen.length, 1);
  assert.strictEqual(isBadgeNumber(seen[0]), true);
  assert.strictEqual(saved.rfidBadge, seen[0]);
});

test('assignBadgeNumber retries with a DIFFERENT number when the badge index rejects the write', async () => {
  // Not a re-submission of the same code: the point of retrying is to pick
  // another number, so the second attempt must differ from the first.
  const seen = [];
  const saved = await assignBadgeNumber(async (code) => {
    seen.push(code);
    if (seen.length < 3) throw duplicateKeyError(BADGE_NUMBER_PATH);
    return { rfidBadge: code };
  });
  assert.strictEqual(seen.length, 3);
  assert.strictEqual(new Set(seen).size, 3);
  assert.strictEqual(saved.rfidBadge, seen[2]);
});

test('assignBadgeNumber does NOT retry a clash on some other unique key', async () => {
  // An employee whose EMAIL is taken must fail as an email clash, immediately.
  // Retrying it would burn every attempt and then report the failure late,
  // dressed up as a badge problem.
  const seen = [];
  await assert.rejects(
    assignBadgeNumber(async (code) => {
      seen.push(code);
      throw duplicateKeyError('email');
    }),
    (err) => err.code === 11000 && 'email' in err.keyPattern
  );
  assert.strictEqual(seen.length, 1);
});

test('assignBadgeNumber lets an unrelated failure straight through', async () => {
  let calls = 0;
  await assert.rejects(
    assignBadgeNumber(async () => {
      calls += 1;
      throw new Error('connection lost');
    }),
    /connection lost/
  );
  assert.strictEqual(calls, 1);
});

test('assignBadgeNumber gives up rather than looping forever', async () => {
  // A permanently-clashing write means something is wrong that another random
  // draw will not fix — surface it instead of hammering the database.
  let calls = 0;
  await assert.rejects(
    assignBadgeNumber(
      async () => {
        calls += 1;
        throw duplicateKeyError(BADGE_NUMBER_PATH);
      },
      { attempts: 4 }
    ),
    (err) => err.code === 11000
  );
  assert.strictEqual(calls, 4);
});

test('assignBadgeNumber takes its generator from the caller', async () => {
  const codes = ['11111111', '22222222'];
  let i = 0;
  const seen = [];
  await assignBadgeNumber(
    async (code) => {
      seen.push(code);
      if (seen.length === 1) throw duplicateKeyError(BADGE_NUMBER_PATH);
      return code;
    },
    { generate: () => codes[i++] }
  );
  assert.deepStrictEqual(seen, ['11111111', '22222222']);
});

test('isDuplicateBadgeNumberError recognises a clash on the badge index only', () => {
  assert.strictEqual(isDuplicateBadgeNumberError(duplicateKeyError(BADGE_NUMBER_PATH)), true);
  assert.strictEqual(isDuplicateBadgeNumberError(duplicateKeyError('email')), false);
});

test('isDuplicateBadgeNumberError ignores anything that is not a duplicate key', () => {
  assert.strictEqual(isDuplicateBadgeNumberError(null), false);
  assert.strictEqual(isDuplicateBadgeNumberError(new Error('boom')), false);
  const validation = new Error('validation failed');
  validation.code = 121;
  assert.strictEqual(isDuplicateBadgeNumberError(validation), false);
});

test('isDuplicateBadgeNumberError falls back to the message when the driver sends no keyPattern', () => {
  // Some driver/version combinations report only the index NAME in the text.
  const err = new Error(
    'E11000 duplicate key error collection: db.users index: ' +
      'tenant_1_employeeProfile.attendance.rfidBadge_1 dup key: { : 1, : "12345678" }'
  );
  err.code = 11000;
  assert.strictEqual(isDuplicateBadgeNumberError(err), true);
});

// ── Where the number goes ────────────────────────────────────────────────────

test('needsBadgeNumber says yes for an employee with no badge at all', () => {
  assert.strictEqual(needsBadgeNumber(undefined), true);
  assert.strictEqual(needsBadgeNumber({}), true);
  assert.strictEqual(needsBadgeNumber({ attendance: {} }), true);
  assert.strictEqual(needsBadgeNumber({ attendance: { rfidBadge: '' } }), true);
  assert.strictEqual(needsBadgeNumber({ attendance: { rfidBadge: '   ' } }), true);
});

test('needsBadgeNumber says no when a badge is already on file', () => {
  assert.strictEqual(needsBadgeNumber({ attendance: { rfidBadge: '12345678' } }), false);
});

test('needsBadgeNumber leaves a hand-entered badge alone', () => {
  // The whole reason the field is free text: a business with pre-printed cards
  // has already written its own numbering here. Issuing ours on top would
  // print a card that does not match the one in their drawer.
  assert.strictEqual(needsBadgeNumber({ attendance: { rfidBadge: 'STAFF-0042' } }), false);
});

test('withBadgeNumber keeps the rest of the profile intact', () => {
  const profile = { work: { jobTitle: 'Cashier' }, attendance: { rfidBadge: '' } };
  const out = withBadgeNumber(profile, '12345678');
  assert.strictEqual(out.work.jobTitle, 'Cashier');
  assert.strictEqual(out.attendance.rfidBadge, '12345678');
});

test('withBadgeNumber builds the attendance branch when there is no profile yet', () => {
  // An employee can be created with no HR profile at all; they still need a
  // badge, because the card is printed from the account, not from the form.
  assert.strictEqual(withBadgeNumber(undefined, '12345678').attendance.rfidBadge, '12345678');
});

test('withBadgeNumber returns a NEW profile and mutates nothing', () => {
  // Load-bearing for the retry loop: a profile mutated in place on the first
  // attempt would carry the REJECTED number into the second, so every retry
  // would clash again on the number that already failed.
  const profile = { attendance: { rfidBadge: '', deviceId: 'kiosk-1' } };
  const first = withBadgeNumber(profile, '11111111');
  const second = withBadgeNumber(profile, '22222222');
  assert.strictEqual(profile.attendance.rfidBadge, '');
  assert.strictEqual(first.attendance.rfidBadge, '11111111');
  assert.strictEqual(second.attendance.rfidBadge, '22222222');
  assert.strictEqual(second.attendance.deviceId, 'kiosk-1');
});

// ── Editing an employee ──────────────────────────────────────────────────────
//
// The edit form full-replaces the HR profile, so anything the submitted profile
// omits is gone. For most fields that is the intent. For the badge number it is
// not: the number is on a card in somebody's pocket and on the shop's kiosk
// records, so dropping it off a form silently stops that card working.

test('carryOverBadgeNumber keeps the stored number when the edit omits it', () => {
  const next = carryOverBadgeNumber({ work: { jobTitle: 'Cashier' } }, {
    attendance: { rfidBadge: '12345678' },
  });
  assert.strictEqual(next.attendance.rfidBadge, '12345678');
  assert.strictEqual(next.work.jobTitle, 'Cashier');
});

test('carryOverBadgeNumber lets an edit REPLACE the number', () => {
  // Overwriting is the supported way to move to a pre-printed card, so an
  // explicit value always wins over the stored one.
  const next = carryOverBadgeNumber(
    { attendance: { rfidBadge: 'STAFF-0042' } },
    { attendance: { rfidBadge: '12345678' } }
  );
  assert.strictEqual(next.attendance.rfidBadge, 'STAFF-0042');
});

test('carryOverBadgeNumber has nothing to carry when there was no number', () => {
  const next = carryOverBadgeNumber({ work: {} }, undefined);
  assert.strictEqual(next.attendance?.rfidBadge, undefined);
  assert.deepStrictEqual(next.work, {});
});

test('carryOverBadgeNumber does not mutate either profile', () => {
  const incoming = { work: {} };
  const stored = { attendance: { rfidBadge: '12345678' } };
  carryOverBadgeNumber(incoming, stored);
  assert.strictEqual(incoming.attendance, undefined);
  assert.strictEqual(stored.attendance.rfidBadge, '12345678');
});
