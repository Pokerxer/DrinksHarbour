'use strict';

// Outbound email must reach real customers but never the seeded, fabricated
// ones. Production carries 400 migrated customers whose addresses are real
// consumer inboxes (gmail/yahoo) attached to orders that never happened;
// mailing them is both a nuisance to strangers and a deliverability risk for
// drinksharbour.com.
//
// Two independent controls, tested here:
//   * OUTBOUND_EMAIL=off      blunt kill switch, silences everything
//   * email-suppression.json  per-recipient list, silences only the fabricated
//
// A regression in either one is the kind that stays invisible until a stranger
// replies asking why they received an order confirmation.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SUPPRESSION_FILE = path.join(__dirname, '..', 'config', 'email-suppression.json');

/** Load email.service with a clean module registry and controlled env. */
function loadService(env = {}) {
  const saved = {
    OUTBOUND_EMAIL: process.env.OUTBOUND_EMAIL,
    DISABLE_OUTBOUND_EMAIL: process.env.DISABLE_OUTBOUND_EMAIL,
    MAIL_PASSWORD: process.env.MAIL_PASSWORD,
  };
  delete process.env.OUTBOUND_EMAIL;
  delete process.env.DISABLE_OUTBOUND_EMAIL;
  // Empty password forces the dev-mode branch, so no test can reach SMTP.
  process.env.MAIL_PASSWORD = '';
  Object.assign(process.env, env);

  const resolved = require.resolve('../services/email.service');
  delete require.cache[resolved];
  const svc = require('../services/email.service');
  return { svc, restore: () => Object.assign(process.env, saved) };
}

test('email suppression list is present and well-formed', () => {
  assert.ok(fs.existsSync(SUPPRESSION_FILE), 'config/email-suppression.json must exist');
  const parsed = JSON.parse(fs.readFileSync(SUPPRESSION_FILE, 'utf8'));
  assert.ok(Array.isArray(parsed.addresses), 'addresses must be an array');
  assert.equal(parsed.addresses.length, parsed.count, 'count must match addresses length');
  assert.ok(parsed.addresses.every((a) => typeof a === 'string' && a.includes('@')),
    'every entry must be an email address');
  assert.ok(parsed.addresses.every((a) => a === a.toLowerCase()),
    'entries must be lower-cased so lookups are case-insensitive');
});

test('suppressed recipients never reach the transport', async () => {
  const { svc, restore } = loadService();
  try {
    const list = JSON.parse(fs.readFileSync(SUPPRESSION_FILE, 'utf8')).addresses;
    const victim = list[0];

    for (const to of [victim, victim.toUpperCase(), `"Someone" <${victim}>`]) {
      const res = await svc.sendEmail({ to, subject: 's', html: '<p>x</p>' });
      assert.equal(res.messageId, 'suppressed', `must suppress ${to}`);
    }
  } finally {
    restore();
  }
});

test('real recipients are not suppressed', async () => {
  const { svc, restore } = loadService();
  try {
    for (const to of ['a.real.customer@example.com', 'someone.new@outlook.com']) {
      const res = await svc.sendEmail({ to, subject: 's', html: '<p>x</p>' });
      assert.notEqual(res.messageId, 'suppressed', `must not suppress ${to}`);
    }
  } finally {
    restore();
  }
});

test('a mixed recipient list is still delivered', async () => {
  // Only an all-suppressed message is dropped: a message addressed to a real
  // customer must not be lost because a seeded address was cc'd alongside.
  const { svc, restore } = loadService();
  try {
    const victim = JSON.parse(fs.readFileSync(SUPPRESSION_FILE, 'utf8')).addresses[0];
    const res = await svc.sendEmail({
      to: `${victim}, real.person@example.com`, subject: 's', html: '<p>x</p>',
    });
    assert.notEqual(res.messageId, 'suppressed');
  } finally {
    restore();
  }
});

test('OUTBOUND_EMAIL=off suppresses everyone, including real recipients', async () => {
  const { svc, restore } = loadService({ OUTBOUND_EMAIL: 'off' });
  try {
    const res = await svc.sendEmail({
      to: 'definitely.real@example.com', subject: 's', html: '<p>x</p>',
    });
    assert.equal(res.messageId, 'suppressed');
  } finally {
    restore();
  }
});

test('DISABLE_OUTBOUND_EMAIL=true is honoured as an alias', async () => {
  const { svc, restore } = loadService({ DISABLE_OUTBOUND_EMAIL: 'true' });
  try {
    const res = await svc.sendEmail({
      to: 'definitely.real@example.com', subject: 's', html: '<p>x</p>',
    });
    assert.equal(res.messageId, 'suppressed');
  } finally {
    restore();
  }
});

test('with no kill switch set, mail is not globally suppressed', async () => {
  // Guards the re-enable: if this fails, production has gone silent again.
  const { svc, restore } = loadService();
  try {
    const res = await svc.sendEmail({
      to: 'definitely.real@example.com', subject: 's', html: '<p>x</p>',
    });
    assert.notEqual(res.messageId, 'suppressed');
  } finally {
    restore();
  }
});
