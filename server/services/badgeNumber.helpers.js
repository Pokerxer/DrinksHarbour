// server/services/badgeNumber.helpers.js
//
// The short number printed on an employee's badge card, and the thing its 1-D
// barcode encodes.
//
// WHY THIS EXISTS AT ALL
// ----------------------
// The badge already carried a QR, whose payload falls back to the employee's
// 24-character ObjectId. A QR does not care how long that is; a 1-D barcode
// does. A CR80 card is 53.98mm wide with 5mm margins, so ~44mm of printable
// width, and 24 alphanumeric characters in CODE_128 come to ~299 modules —
// a bar of roughly 0.15mm. Entry-level laser scanners need about 0.19mm and are
// usually specified at 0.25mm, so that barcode is simply unreadable.
//
// Hence a SHORT code. Two properties do the work:
//
//   DIGITS ONLY — CODE_128 packs a PAIR of digits into one symbol (Code Set C)
//   but only one letter per symbol, so an 8-character alphanumeric code is
//   twice as wide on the card as an 8-digit one. 8 digits comes to ~79 modules,
//   about a 0.55mm bar: comfortable for the cheapest scanner in the shop.
//
//   RANDOM, NOT SEQUENTIAL — the kiosk accepts a badge number TYPED as well as
//   scanned, so the number is the credential. Sequential numbering would let
//   anybody work out a colleague's badge from their own and clock in as them.
//
// It is stored in `employeeProfile.attendance.rfidBadge`, which the clock
// already matches BEFORE falling back to `_id` — so nothing about the lookup
// changes. That field stays free text on purpose: a business that already has
// pre-printed cards puts its own numbering in it and that must keep working.

const crypto = require('crypto');

/**
 * Eight digits: a hundred million codes, which makes a collision across one
 * tenant's staff a non-event, and four CODE_128 symbols, which keeps the bars
 * wide. Changing this changes how wide the barcode prints — check it still
 * fits the card before you do.
 */
const BADGE_NUMBER_LENGTH = 8;

const BADGE_NUMBER_RE = new RegExp(`^[1-9][0-9]{${BADGE_NUMBER_LENGTH - 1}}$`);

/**
 * A uniformly random integer in [0, max), from the CSPRNG.
 *
 * `crypto.randomInt` rather than `Math.random`: the number is a credential
 * somebody can type, and Math.random is both predictable from prior output and
 * seeded per process.
 */
function defaultRandom(max) {
  return crypto.randomInt(0, max);
}

/**
 * A fresh badge number.
 *
 * The first digit is drawn from 1–9 so the code can never acquire a leading
 * zero: a zero does not survive a round trip through a spreadsheet, and a code
 * that quietly loses a character stops matching the card in somebody's pocket.
 *
 * @param {(max: number) => number} [random] injected so the collision-retry
 *   loop can be tested without waiting for a one-in-ten-million coincidence.
 * @returns {string}
 */
function generateBadgeNumber(random = defaultRandom) {
  let out = String(1 + (random(9) % 9));
  for (let i = 1; i < BADGE_NUMBER_LENGTH; i += 1) {
    out += String(random(10) % 10);
  }
  return out;
}

/**
 * Did WE generate this badge number?
 *
 * Deliberately narrow: it answers "is this one of ours", which is the question
 * the backfill asks before overwriting nothing. A hand-entered `STAFF-0042` is
 * a perfectly good badge and returns false — that is not a rejection, it is the
 * point of the field being free text.
 */
function isBadgeNumber(value) {
  return typeof value === 'string' && BADGE_NUMBER_RE.test(value);
}

/**
 * Grouped for a human to read off the card or say down a phone.
 *
 * Only ever applied to a code we generated. Somebody else's numbering scheme is
 * returned untouched — regrouping it would print something that does not match
 * their own records.
 */
function formatBadgeNumber(value) {
  if (!isBadgeNumber(value)) return typeof value === 'string' ? value : '';
  return `${value.slice(0, 4)} ${value.slice(4)}`;
}

// ── Assignment ───────────────────────────────────────────────────────────────
//
// Uniqueness is per tenant, and it is enforced by a compound partial index on
// {tenant, employeeProfile.attendance.rfidBadge} — NOT by a field-level
// `unique: true`, which would make the number globally unique across every
// tenant sharing this collection. (Mongoose also never drops a de-declared
// index nor re-options an existing one, so a field-level unique here would
// outlive the line of code that asked for it.)
//
// Because the index is the arbiter, the only honest way to learn that a number
// is free is to try to write it: a read-then-write check still loses the race
// between two managers adding staff at the same moment. So we generate,
// attempt, and retry only when the DATABASE says it clashed.

/** The document path the badge number lives at, and half of the index key. */
const BADGE_NUMBER_PATH = 'employeeProfile.attendance.rfidBadge';

/**
 * How many numbers we are willing to draw before concluding the clash is not
 * bad luck. At 8 digits over one tenant's staff, needing even a second draw is
 * already remarkable; a fifth means something else is wrong.
 */
const BADGE_NUMBER_ATTEMPTS = 5;

/**
 * Is this a duplicate-key error caused by OUR badge number, specifically?
 *
 * The narrowness matters. An employee whose email is already taken also raises
 * E11000, and retrying that would burn every attempt and then report an email
 * clash late, dressed up as a badge problem.
 */
function isDuplicateBadgeNumberError(err) {
  if (!err || err.code !== 11000) return false;
  const keys = Object.keys(err.keyPattern || err.keyValue || {});
  if (keys.length) return keys.includes(BADGE_NUMBER_PATH);
  // Some driver/version combinations report only the index NAME in the text.
  return typeof err.message === 'string' && err.message.includes(BADGE_NUMBER_PATH);
}

/**
 * Persist something that carries a freshly generated badge number, redrawing
 * the number if the index rejects it.
 *
 * @param {(code: string) => Promise<T>} persist called with the number to
 *   write. It must build its payload FRESH from the code each time: it may be
 *   called more than once, and a document mutated in place on the first attempt
 *   would carry the rejected number into the second.
 * @param {object} [opts]
 * @param {() => string} [opts.generate]
 * @param {number} [opts.attempts]
 * @returns {Promise<T>} whatever `persist` returned
 * @template T
 */
async function assignBadgeNumber(persist, opts = {}) {
  const generate = opts.generate || generateBadgeNumber;
  const attempts = opts.attempts || BADGE_NUMBER_ATTEMPTS;

  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await persist(generate());
    } catch (err) {
      if (!isDuplicateBadgeNumberError(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Does this employee still need a number issued?
 *
 * "Already has one" includes somebody else's numbering scheme. The field is
 * free text precisely so a business with pre-printed cards can put its own
 * numbers in it, and issuing ours on top would print a card that does not match
 * the one already in their drawer.
 */
function needsBadgeNumber(employeeProfile) {
  const stored = employeeProfile?.attendance?.rfidBadge;
  return !(typeof stored === 'string' && stored.trim() !== '');
}

/**
 * A COPY of the profile carrying `code`, with everything else left as it was.
 *
 * The copy is load-bearing, not politeness: `assignBadgeNumber` may call its
 * writer more than once, and a profile mutated in place would carry the number
 * the index just rejected into the next attempt, which would then clash on the
 * same number for ever.
 */
function withBadgeNumber(employeeProfile, code) {
  return {
    ...employeeProfile,
    attendance: { ...employeeProfile?.attendance, rfidBadge: code },
  };
}

/**
 * Fold an employee's stored badge number into an incoming profile that does not
 * carry one.
 *
 * The edit form full-replaces the HR profile, so a field the submission omits
 * is deleted. That is right for most of the profile and wrong for this: the
 * number is printed on a card in somebody's pocket and is what the kiosk
 * matches, so losing it off a form silently stops that card working. An
 * explicit value still wins — overwriting is how you move an employee onto a
 * pre-printed card.
 */
function carryOverBadgeNumber(nextProfile, previousProfile) {
  if (!needsBadgeNumber(nextProfile)) return nextProfile;
  const stored = previousProfile?.attendance?.rfidBadge;
  if (needsBadgeNumber(previousProfile)) return nextProfile;
  return withBadgeNumber(nextProfile, stored);
}

module.exports = {
  BADGE_NUMBER_LENGTH,
  BADGE_NUMBER_PATH,
  BADGE_NUMBER_ATTEMPTS,
  generateBadgeNumber,
  isBadgeNumber,
  formatBadgeNumber,
  isDuplicateBadgeNumberError,
  needsBadgeNumber,
  withBadgeNumber,
  carryOverBadgeNumber,
  assignBadgeNumber,
};
