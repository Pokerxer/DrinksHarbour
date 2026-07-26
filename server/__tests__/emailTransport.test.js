// Regression guard for the 2026-07-27 outage: prod SMTP creds were rejected
// (535 Incorrect authentication data), so every order confirmation silently
// took the "development mode" branch — which reported success, so the logs
// showed "✅ Order confirmation email → customer" for mail that never left.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SERVICE = path.join(__dirname, '../services/email.service.js');

/** Load a fresh copy of the service under a given env. */
const loadService = (env) => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  delete require.cache[require.resolve(SERVICE)];
  const svc = require(SERVICE);
  return {
    svc,
    restore: () => {
      process.env = saved;
      delete require.cache[require.resolve(SERVICE)];
    },
  };
};

// No credentials at all => no transport can be built, whatever the environment.
const NO_CREDENTIALS = {
  MAIL_PASSWORD: '',
  MAILING_SERVICE_CLIENT_ID: '',
  MAILING_SERVICE_CLIENT_SECRET: '',
  MAILING_REFRESH_TOKEN: '',
};

test('production: an unsendable email reports failure instead of fake success', async () => {
  const { svc, restore } = loadService({ ...NO_CREDENTIALS, NODE_ENV: 'production' });
  try {
    const result = await svc.sendEmail({
      to: 'customer@example.com',
      subject: 'Order Confirmed! #DH123',
      html: '<p>hi</p>',
    });
    assert.equal(result.success, false, 'production must not report success for unsent mail');
    assert.ok(result.error, 'failure result must carry a reason');
  } finally {
    restore();
  }
});

test('development: unsendable email still logs to console as a dev convenience', async () => {
  const { svc, restore } = loadService({ ...NO_CREDENTIALS, NODE_ENV: 'development', VERCEL: '' });
  try {
    const result = await svc.sendEmail({
      to: 'customer@example.com',
      subject: 'Order Confirmed! #DH123',
      html: '<p>hi</p>',
    });
    assert.equal(result.success, true, 'local dev keeps the log-only shortcut');
    assert.equal(result.messageId, 'dev-mode');
  } finally {
    restore();
  }
});

test('a failed transport init is retried, not cached forever', async () => {
  const { svc, restore } = loadService({ ...NO_CREDENTIALS, NODE_ENV: 'production' });
  try {
    // First send fails with no credentials configured.
    const first = await svc.sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' });
    assert.equal(first.success, false);

    // Credentials appear (as they would after an env fix + new instance) and a
    // forced re-init must pick them up rather than stay stuck in dev mode.
    assert.equal(typeof svc.initializeEmailService, 'function');
    assert.equal(svc.isEmailServiceReady(), false);
  } finally {
    restore();
  }
});
