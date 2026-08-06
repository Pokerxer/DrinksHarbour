// The mail account resolver is the security boundary for /support/inbox.
// Credentials live only here, and `accountId` from the client is an opaque
// handle that must be re-validated against the caller on every request —
// the same rule requireOwnTenant enforces for the tenant-owned modules.
//
// These tests run WITHOUT a database on purpose: the service must serve the
// env-defined accounts (and refuse everything else cleanly) while mongoose is
// disconnected, because a mail outage must never follow a database outage.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const svc = require('../services/mailAccount.service');
const mailCrypto = require('../utils/mailCrypto');

const TENANT_A = new mongoose.Types.ObjectId();

/** Sets the platform mail env to two accounts and clears the memo. */
function setEnv() {
  process.env.MAIL_HOST = 'mail.example.com';
  process.env.MAIL_PORT = '465';
  process.env.SENDER_EMAIL_ADDRESS = 'orders@example.com';
  process.env.MAIL_PASSWORD = 'orders-secret';
  process.env.MAIL_ACCOUNT_2_ADDRESS = 'support@example.com';
  process.env.MAIL_ACCOUNT_2_PASSWORD = 'support-secret';
  process.env.MAIL_ACCOUNT_2_DISPLAY_NAME = 'Example Support';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  svc.__resetCache();
}

const superAdmin = { _id: new mongoose.Types.ObjectId(), role: 'super_admin', tenant: TENANT_A };
const admin = { _id: new mongoose.Types.ObjectId(), role: 'admin', tenant: TENANT_A };
const tenantOwner = { _id: new mongoose.Types.ObjectId(), role: 'tenant_owner', tenant: TENANT_A };

test('lists every configured platform account for a super admin', async () => {
  setEnv();
  const accounts = await svc.listAccounts(superAdmin);
  assert.strictEqual(accounts.length, 2);
  assert.deepStrictEqual(
    accounts.map((a) => a.address).sort(),
    ['orders@example.com', 'support@example.com']
  );
});

test('listed accounts never carry credentials', async () => {
  setEnv();
  const serialized = JSON.stringify(await svc.listAccounts(superAdmin));
  assert.ok(!serialized.includes('orders-secret'), 'password leaked in account list');
  assert.ok(!serialized.includes('support-secret'), 'password leaked in account list');
  assert.ok(!serialized.includes('mail.example.com'), 'host leaked in account list');
});

test('resolveAccount returns usable imap and smtp config', async () => {
  setEnv();
  const [first] = await svc.listAccounts(superAdmin);
  const resolved = await svc.resolveAccount(superAdmin, first.id);
  assert.strictEqual(resolved.imap.host, 'mail.example.com');
  assert.strictEqual(resolved.imap.port, 993);
  assert.strictEqual(resolved.imap.secure, true);
  assert.strictEqual(resolved.smtp.port, 465);
  assert.strictEqual(typeof resolved.imap.auth.pass, 'string');
  assert.ok(resolved.imap.auth.pass.length > 0);
});

test('account 2 inherits host from the defaults but keeps its own credentials', async () => {
  setEnv();
  const support = (await svc.listAccounts(superAdmin)).find(
    (a) => a.address === 'support@example.com'
  );
  const resolved = await svc.resolveAccount(superAdmin, support.id);
  assert.strictEqual(resolved.imap.host, 'mail.example.com');
  assert.strictEqual(resolved.imap.auth.user, 'support@example.com');
  assert.strictEqual(resolved.imap.auth.pass, 'support-secret');
  assert.strictEqual(resolved.displayName, 'Example Support');
});

test('an unknown accountId is refused, not guessed at', async () => {
  setEnv();
  await assert.rejects(
    () => svc.resolveAccount(superAdmin, 'platform:nope@example.com'),
    /not available/i
  );
});

test('a tenant owner with no configured mailbox gets no accounts and no access', async () => {
  setEnv();
  assert.deepStrictEqual(await svc.listAccounts(tenantOwner), []);
  const [platformAccount] = await svc.listAccounts(superAdmin);
  await assert.rejects(
    () => svc.resolveAccount(tenantOwner, platformAccount.id),
    /not available/i
  );
});

test('a crafted accountId cannot smuggle in a host', async () => {
  setEnv();
  await assert.rejects(
    () => svc.resolveAccount(superAdmin, 'platform:evil@attacker.com'),
    /not available/i
  );
});

// ───────────────────────── runtime-added accounts ─────────────────────────

test('mail passwords survive an encrypt/decrypt round trip and are not stored bare', () => {
  setEnv();
  const blob = mailCrypto.encrypt('s3cret-p@ss');
  assert.ok(!blob.includes('s3cret-p@ss'), 'ciphertext contains the plaintext');
  assert.strictEqual(mailCrypto.decrypt(blob), 's3cret-p@ss');
});

test('a tampered ciphertext fails authentication instead of decrypting', () => {
  setEnv();
  const blob = mailCrypto.encrypt('s3cret-p@ss');
  const parts = blob.split(':');
  const flipped = Buffer.from(parts[3], 'base64');
  flipped[0] ^= 0xff;
  parts[3] = flipped.toString('base64');
  assert.throws(() => mailCrypto.decrypt(parts.join(':')));
});

test('only a super admin may build a candidate account', () => {
  setEnv();
  const payload = { address: 'new@example.com', password: 'pw' };
  for (const user of [admin, tenantOwner, null]) {
    assert.throws(() => svc.buildCandidate(user, payload), /super admin/i);
  }
});

test('a candidate inherits the deployment mail host and implies TLS from the ports', () => {
  setEnv();
  const { account, fields } = svc.buildCandidate(superAdmin, {
    address: 'New@Example.com',
    password: 'pw',
  });
  assert.strictEqual(fields.address, 'new@example.com');
  assert.strictEqual(account.imap.host, 'mail.example.com');
  assert.strictEqual(account.imap.port, 993);
  assert.strictEqual(account.imap.secure, true);
  assert.strictEqual(account.smtp.port, 465);
  assert.strictEqual(account.smtp.secure, true);
  assert.strictEqual(account.imap.auth.user, 'new@example.com');
  assert.strictEqual(account.imap.auth.pass, 'pw');
});

test('a candidate refuses junk addresses, missing passwords and bad ports', () => {
  setEnv();
  assert.throws(() => svc.buildCandidate(superAdmin, { address: 'not-an-email', password: 'pw' }), /valid email/i);
  assert.throws(() => svc.buildCandidate(superAdmin, { address: 'a@b.co', password: '' }), /password/i);
  assert.throws(
    () => svc.buildCandidate(superAdmin, { address: 'a@b.co', password: 'pw', imapPort: '99999' }),
    /port/i
  );
});

test('deleting an env-defined account is refused with an explanation', async () => {
  setEnv();
  await assert.rejects(
    () => svc.deleteAccount(superAdmin, 'platform:orders@example.com'),
    /server environment/i
  );
  await assert.rejects(() => svc.deleteAccount(admin, 'db:whatever'), /super admin/i);
});

test('creating an account without a database connection fails loudly, not silently', async () => {
  setEnv();
  const candidate = svc.buildCandidate(superAdmin, { address: 'a@b.co', password: 'pw' });
  await assert.rejects(() => svc.createAccount(superAdmin, candidate), /database/i);
});
