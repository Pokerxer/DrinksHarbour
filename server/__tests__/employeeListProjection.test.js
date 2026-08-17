// server/__tests__/employeeListProjection.test.js
//
// What the employees LIST endpoint actually puts on the wire.
//
// This is a projection test, not a helper test, because the bug it exists to
// stop is invisible to helper tests. `listEmployees` selects an allowlist of
// fields; the badge number lives at `employeeProfile.attendance.rfidBadge` and
// was not on it. Nothing threw. `present()` faithfully passed along the
// truncated profile, the client's `badgePayload()` found no badge and fell
// back to the employee's 24-character _id, and the screen offered "Issue badge
// number" to a manager whose staff had been carrying printed cards for weeks.
// Every unit on both sides behaved correctly on the data it was handed.
//
// A `.select()` narrower than its consumers degrades to a fallback instead of
// failing, so the only place to catch it is here: drive the real handler and
// assert on the response body. This is the third instance of the class in this
// repo (the POS select that dropped `imagesOverride`, the planner projection
// that dropped `templatePosition`).
//
// The pair of tests below are two halves of one decision. The list ships an
// ALLOWLIST of employeeProfile subtrees: widening it to the whole profile
// would fix the badge and start bulk-shipping bank accounts, passport and SSN
// numbers, home addresses and hourly pay to every client that opens the
// employees screen. So one test asserts what must be there, and one asserts
// what must not — a future fix that reaches for `employeeProfile` wholesale
// turns the second one red.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { makeHarness } = require('./helpers/appraisalHarness');
const employees = require('../controllers/employee.controller');
const { BADGE_NUMBER_PATH } = require('../services/badgeNumber.helpers');

const oid = () => new mongoose.Types.ObjectId();
const fail = (err) => { throw err; };

const BADGE = '81234567';

/**
 * One tenant, two employees: Ada holds a badge number, Bem does not. Both
 * carry the sensitive HR fields a real profile accumulates, so a projection
 * that is too wide shows up as loudly as one that is too narrow.
 */
function scenario() {
  const tenant = oid();
  const ada = {
    _id: oid(),
    tenant,
    role: 'tenant_staff',
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@x.io',
    posPinHash: '$2a$10$notarealhash',
    employeeProfile: {
      attendance: { rfidBadge: BADGE },
      work: { jobTitle: 'Floor supervisor' },
      appSettings: { hourlyCost: 4200 },
      citizenship: { ssnNo: '123-45-6789', passportNo: 'A01234567' },
      privateContact: {
        bankAccounts: [{ bankName: 'GTB', accountNumber: '0123456789' }],
      },
      documents: { idCardUrl: 'https://files.example/id/ada.png' },
    },
  };
  const bem = {
    _id: oid(),
    tenant,
    role: 'tenant_staff',
    firstName: 'Bem',
    lastName: 'Tor',
    email: 'bem@x.io',
    employeeProfile: { work: { jobTitle: 'Cashier' } },
  };
  return { tenant, ada, bem, h: makeHarness({ users: [ada, bem] }) };
}

/** Run the real handler and return the employees it responded with. */
async function listEmployees(tenant) {
  const res = {};
  res.status = function status(code) { res.status = code; return res; };
  res.json = function json(payload) {
    res.body = payload;
    if (typeof res.status === 'function') res.status = 200;
    return res;
  };
  await employees.listEmployees({ tenant: { _id: tenant }, query: {} }, res, fail);
  assert.strictEqual(res.status, 200);
  return res.body.data.employees;
}

const byName = (rows, firstName) => rows.find((e) => e.firstName === firstName);

test('the employees list carries the badge number of an employee who has one', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const rows = await listEmployees(s.tenant);
  const ada = byName(rows, 'Ada');

  // The assertion is on the RESPONSE, deliberately: the number was in the
  // database throughout, and reading it back off the model would have passed
  // for the whole time the screen was broken.
  assert.strictEqual(
    ada.employeeProfile?.attendance?.rfidBadge,
    BADGE,
    `the list response does not carry ${BADGE_NUMBER_PATH} — the client reads that as "no badge issued" and offers to issue one over a card already in somebody's pocket`
  );

  // What the client then derives from it. `badgePayload()` falls back to the
  // employee's _id, which is a legal payload and prints an unreadable barcode,
  // so "we returned SOMETHING" is not the property under test.
  assert.notStrictEqual(String(ada.employeeProfile.attendance.rfidBadge), String(ada._id));

  // Nobody has issued Bem one. Absent, not invented.
  assert.strictEqual(byName(rows, 'Bem').employeeProfile?.attendance?.rfidBadge, undefined);
});

test('the employees list still carries work, and hasPin, from the same select', async (t) => {
  // The other consumers of this one projection string, kept honest here so
  // that widening it for the badge cannot quietly cost the org chart its
  // manager/title fields or the "PIN set" badge its hash-derived flag.
  const s = scenario();
  t.after(s.h.restore);

  const ada = byName(await listEmployees(s.tenant), 'Ada');
  assert.strictEqual(ada.employeeProfile?.work?.jobTitle, 'Floor supervisor');
  assert.strictEqual(ada.hasPin, true);
});

test('the employees list ships no HR field beyond the allowlist', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const ada = byName(await listEmployees(s.tenant), 'Ada');

  // Not "these particular fields are absent" — the whole subtree set is
  // asserted, so a profile subtree added to the model later is absent from the
  // list until somebody puts it on the allowlist on purpose.
  assert.deepStrictEqual(Object.keys(ada.employeeProfile).sort(), ['attendance', 'work']);

  // And never the hash itself, whatever the projection does.
  assert.strictEqual(ada.posPinHash, undefined);
});
