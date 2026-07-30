# Support Inbox Mail Client — Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/support/inbox` in the admin app from Hydrogen demo data into a real mail client that reads and sends mail over the live cPanel IMAP/SMTP mailbox.

**Architecture:** A live IMAP proxy. The Express backend keeps one pooled `ImapFlow` connection per mail account and answers every request straight from Dovecot — **no mail is ever written to Mongo**. Credentials live only in server env and are read in exactly one module (`mailAccount.service.js`); the browser only ever sees an opaque `accountId`. The admin UI is a three-pane client (folders / envelope list / reading pane) plus a compose drawer.

**Tech Stack:** Node 22 + Express + Mongoose (server), Next.js App Router + React + rizzui + Tailwind + jotai (admin). New deps: `imapflow`, `mailparser`, `sanitize-html`. Existing: `nodemailer` ^8, `multer` ^2, `react-quill-new` ^3.4.6.

**Spec:** `docs/superpowers/specs/2026-07-30-support-inbox-mail-client-design.md`

## Global Constraints

- **No mail persisted.** No Mongo model, collection, or write may store message content, envelopes, or attachments. Caching is in-process memory only, TTL ≤ 30s.
- **Credentials never leave the server.** No endpoint returns a host, username, or password. No endpoint accepts one. There is no `?host=` / `?imapHost=` / `?user=` pivot parameter anywhere.
- **`accountId` is re-validated on every request** against the authenticated caller, inside `mailAccount.service.resolveAccount`. Cross-account access throws `ForbiddenError` before any connection opens. No super_admin bypass.
- **Never a silent failure.** IMAP/SMTP errors surface as a distinct error state. An unreachable mailbox must never render as an empty inbox, and a failed send must never show a success toast.
- **`DELETE` moves to Trash.** Hard expunge only when the message is already in the Trash folder.
- Outgoing attachments capped at **15 MB total**.
- Server tests: `node --test '__tests__/*.test.js'` run from `server/`. Baseline is **742/745** (3 known pre-existing failures: 1 pricelist populate, 2 SO-number). No new failures.
- Tests are `node:test` + `node:assert`, **not jest**. No test may open a network connection.
- Server responses use `utils/response.js` (`successResponse`/`errorResponse`); errors use the classes in `utils/errors.js` with `asyncHandler`.
- Admin client requests use `NEXT_PUBLIC_API_URL` + `Authorization: Bearer <session token>`. Bearer requests are CSRF-exempt (`middleware/csrf.middleware.js:89`) — do not add CSRF handling.
- IMAP folder hierarchy separator on this server is `.` — folders are `INBOX`, `INBOX.Sent`, `INBOX.Drafts`, `INBOX.Archive`, `INBOX.Junk`, `INBOX.spam`, `INBOX.Trash`. Never hardcode these names; resolve them from `specialUse` flags.

---

### Task 1: Mail account resolver

The security boundary. Everything else depends on it, and it is the only module that reads credentials.

**Files:**
- Create: `server/services/mailAccount.service.js`
- Test: `server/__tests__/mailAccounts.test.js`
- Modify: `server/package.json` (add deps)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `listAccounts(user) -> Array<{ id, address, displayName, scope }>` — never includes credentials.
  - `resolveAccount(user, accountId) -> { id, address, displayName, scope, imap: { host, port, secure, auth: { user, pass } }, smtp: { host, port, secure, auth: { user, pass } } }` — throws `ForbiddenError` if the account is not in `listAccounts(user)`.
  - `__resetCache()` — test hook that clears the parsed-env memo.

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/mac/Documents/drinksharbour/server
npm install imapflow mailparser sanitize-html
```

Expected: three packages added to `dependencies` in `server/package.json`.

- [ ] **Step 2: Write the failing test**

Create `server/__tests__/mailAccounts.test.js`:

```javascript
// The mail account resolver is the security boundary for /support/inbox.
// Credentials live only here, and `accountId` from the client is an opaque
// handle that must be re-validated against the caller on every request —
// the same rule requireOwnTenant enforces for the tenant-owned modules.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const svc = require('../services/mailAccount.service');

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
  svc.__resetCache();
}

const superAdmin = { _id: new mongoose.Types.ObjectId(), role: 'super_admin', tenant: TENANT_A };
const tenantOwner = { _id: new mongoose.Types.ObjectId(), role: 'tenant_owner', tenant: TENANT_A };

test('lists every configured platform account for a super admin', () => {
  setEnv();
  const accounts = svc.listAccounts(superAdmin);
  assert.strictEqual(accounts.length, 2);
  assert.deepStrictEqual(
    accounts.map((a) => a.address).sort(),
    ['orders@example.com', 'support@example.com']
  );
});

test('listed accounts never carry credentials', () => {
  setEnv();
  const serialized = JSON.stringify(svc.listAccounts(superAdmin));
  assert.ok(!serialized.includes('orders-secret'), 'password leaked in account list');
  assert.ok(!serialized.includes('support-secret'), 'password leaked in account list');
  assert.ok(!serialized.includes('mail.example.com'), 'host leaked in account list');
});

test('resolveAccount returns usable imap and smtp config', () => {
  setEnv();
  const [first] = svc.listAccounts(superAdmin);
  const resolved = svc.resolveAccount(superAdmin, first.id);
  assert.strictEqual(resolved.imap.host, 'mail.example.com');
  assert.strictEqual(resolved.imap.port, 993);
  assert.strictEqual(resolved.imap.secure, true);
  assert.strictEqual(resolved.smtp.port, 465);
  assert.strictEqual(typeof resolved.imap.auth.pass, 'string');
  assert.ok(resolved.imap.auth.pass.length > 0);
});

test('account 2 inherits host from the defaults but keeps its own credentials', () => {
  setEnv();
  const support = svc.listAccounts(superAdmin).find((a) => a.address === 'support@example.com');
  const resolved = svc.resolveAccount(superAdmin, support.id);
  assert.strictEqual(resolved.imap.host, 'mail.example.com');
  assert.strictEqual(resolved.imap.auth.user, 'support@example.com');
  assert.strictEqual(resolved.imap.auth.pass, 'support-secret');
  assert.strictEqual(resolved.displayName, 'Example Support');
});

test('an unknown accountId is refused, not guessed at', () => {
  setEnv();
  assert.throws(
    () => svc.resolveAccount(superAdmin, 'platform:nope@example.com'),
    /not available/i
  );
});

test('a tenant owner with no configured mailbox gets no accounts and no access', () => {
  setEnv();
  assert.deepStrictEqual(svc.listAccounts(tenantOwner), []);
  const [platformAccount] = svc.listAccounts(superAdmin);
  assert.throws(
    () => svc.resolveAccount(tenantOwner, platformAccount.id),
    /not available/i
  );
});

test('a crafted accountId cannot smuggle in a host', () => {
  setEnv();
  assert.throws(
    () => svc.resolveAccount(superAdmin, 'platform:evil@attacker.com'),
    /not available/i
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailAccounts.test.js`
Expected: FAIL — `Cannot find module '../services/mailAccount.service'`.

- [ ] **Step 4: Write the implementation**

Create `server/services/mailAccount.service.js`:

```javascript
// services/mailAccount.service.js
//
// The single place mail credentials are read. Every other module receives an
// already-resolved account object and never sees an env var.
//
// `accountId` is an opaque handle the client echoes back. It is re-validated
// against the caller on every request, so a client cannot pivot to a mailbox
// it was not offered — the same rule requireOwnTenant enforces for the
// tenant-owned modules. There is deliberately no way to pass a host, username
// or password in from the outside.

const { ForbiddenError } = require('../utils/errors');

// Stage 2 will add per-tenant accounts here. The resolver interface is already
// shaped for it: scope distinguishes a platform mailbox from a tenant's own.
const SCOPE_PLATFORM = 'platform';

let cache = null;

/** Test hook — drops the parsed-env memo so env changes take effect. */
function __resetCache() {
  cache = null;
}

const num = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** `secure` is explicit when set, otherwise implied by the port (465/993). */
function isSecure(explicit, port, implicitPort) {
  if (explicit != null && explicit !== '') return explicit === 'true';
  return port === implicitPort;
}

function buildAccount({ address, displayName, password, imapHost, imapPort, smtpHost, smtpPort, imapSecure, smtpSecure }) {
  const resolvedImapPort = num(imapPort, 993);
  const resolvedSmtpPort = num(smtpPort, 465);
  return {
    id: `${SCOPE_PLATFORM}:${address}`,
    address,
    displayName: displayName || address,
    scope: SCOPE_PLATFORM,
    imap: {
      host: imapHost,
      port: resolvedImapPort,
      secure: isSecure(imapSecure, resolvedImapPort, 993),
      auth: { user: address, pass: password },
    },
    smtp: {
      host: smtpHost,
      port: resolvedSmtpPort,
      secure: isSecure(smtpSecure, resolvedSmtpPort, 465),
      auth: { user: address, pass: password },
    },
  };
}

/**
 * Platform accounts come from env. Account 1 reuses the existing transactional
 * mail config so this works with no new env at all; accounts 2..N use indexed
 * vars and inherit host/port from the defaults when omitted.
 */
function platformAccounts() {
  if (cache) return cache;

  const defaultHost = process.env.MAIL_HOST;
  const defaultSmtpPort = process.env.MAIL_PORT;
  const accounts = [];

  if (defaultHost && process.env.SENDER_EMAIL_ADDRESS && process.env.MAIL_PASSWORD) {
    accounts.push(
      buildAccount({
        address: process.env.SENDER_EMAIL_ADDRESS,
        displayName: process.env.MAIL_DISPLAY_NAME,
        password: process.env.MAIL_PASSWORD,
        imapHost: process.env.MAIL_IMAP_HOST || defaultHost,
        imapPort: process.env.MAIL_IMAP_PORT,
        imapSecure: process.env.MAIL_IMAP_SECURE,
        smtpHost: defaultHost,
        smtpPort: defaultSmtpPort,
        smtpSecure: process.env.MAIL_SECURE,
      })
    );
  }

  for (let i = 2; i <= 10; i += 1) {
    const address = process.env[`MAIL_ACCOUNT_${i}_ADDRESS`];
    const password = process.env[`MAIL_ACCOUNT_${i}_PASSWORD`];
    if (!address || !password) continue;
    accounts.push(
      buildAccount({
        address,
        displayName: process.env[`MAIL_ACCOUNT_${i}_DISPLAY_NAME`],
        password,
        imapHost: process.env[`MAIL_ACCOUNT_${i}_IMAP_HOST`] || defaultHost,
        imapPort: process.env[`MAIL_ACCOUNT_${i}_IMAP_PORT`],
        imapSecure: process.env[`MAIL_ACCOUNT_${i}_IMAP_SECURE`],
        smtpHost: process.env[`MAIL_ACCOUNT_${i}_SMTP_HOST`] || defaultHost,
        smtpPort: process.env[`MAIL_ACCOUNT_${i}_SMTP_PORT`] || defaultSmtpPort,
        smtpSecure: process.env[`MAIL_ACCOUNT_${i}_SMTP_SECURE`],
      })
    );
  }

  cache = accounts;
  return cache;
}

/** Roles allowed to use the platform mailboxes. */
const PLATFORM_MAIL_ROLES = ['super_admin', 'admin'];

/** Every account the caller may use, with credentials stripped. */
function listAccounts(user) {
  if (!user) return [];
  const permitted = PLATFORM_MAIL_ROLES.includes(user.role) ? platformAccounts() : [];
  return permitted.map(({ id, address, displayName, scope }) => ({
    id,
    address,
    displayName,
    scope,
  }));
}

/**
 * Resolve an opaque accountId to full credentials, or refuse.
 *
 * The lookup runs against listAccounts(user) — the caller's own permitted set —
 * so an id belonging to someone else's mailbox is indistinguishable from one
 * that does not exist. Both are refused before any connection is opened.
 */
function resolveAccount(user, accountId) {
  const allowed = new Set(listAccounts(user).map((a) => a.id));
  if (!accountId || !allowed.has(accountId)) {
    throw new ForbiddenError('That mail account is not available to you');
  }
  const account = platformAccounts().find((a) => a.id === accountId);
  if (!account) {
    throw new ForbiddenError('That mail account is not available to you');
  }
  return account;
}

module.exports = { listAccounts, resolveAccount, __resetCache };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailAccounts.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the full suite for regressions**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: 749 pass / 3 fail (the 3 known pre-existing failures only).

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add server/services/mailAccount.service.js server/__tests__/mailAccounts.test.js server/package.json server/package-lock.json
git commit -m "feat(mail): add mail account resolver with per-caller authorization"
```

---

### Task 2: IMAP service — connections, folders, envelopes

**Files:**
- Create: `server/services/imap.service.js`
- Test: `server/__tests__/imapService.test.js`

**Interfaces:**
- Consumes: account objects from Task 1 (`account.imap`, `account.id`).
- Produces:
  - `listFolders(account) -> Array<{ path, name, specialUse, total, unseen }>`
  - `listMessages(account, { folder, page, limit, search }) -> { items: Envelope[], total, page, limit }`
  - `Envelope = { uid, folder, subject, from: {name,address}, to: [{name,address}], date, seen, flagged, answered, hasAttachments, preview, messageId, inReplyTo, references: string[] }`
  - `mapEnvelope(raw, folder) -> Envelope` — exported for testing without a connection.
  - `specialFolder(folders, use) -> string|null` — resolves `'\\Sent'`, `'\\Trash'`, `'\\Drafts'`, `'\\Junk'`, `'\\Archive'` to a path.
  - `invalidate(accountId)` — drops cached envelope pages for an account.
  - `withMailbox(account, folder, fn)` — runs `fn(client)` holding the mailbox lock.
  - `closeAll()` — closes every pooled connection (used on shutdown and in tests).

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/imapService.test.js`:

```javascript
// Envelope mapping and special-folder resolution are pure functions over data
// IMAP hands back. They are tested without a connection — no test in this repo
// may touch the network.
//
// Folder names are NOT hardcoded: this server uses the "." hierarchy separator
// (INBOX.Sent), others use "/" (INBOX/Sent) or a flat "Sent". Resolution goes
// through the SPECIAL-USE flags every time.

const test = require('node:test');
const assert = require('node:assert');

const { mapEnvelope, specialFolder } = require('../services/imap.service');

const rawMessage = {
  uid: 42,
  flags: new Set(['\\Seen', '\\Answered']),
  envelope: {
    subject: 'Re: Order #DH-1043',
    messageId: '<abc@example.com>',
    inReplyTo: '<parent@example.com>',
    date: new Date('2026-07-30T10:00:00Z'),
    from: [{ name: 'Jane Doe', address: 'jane@example.com' }],
    to: [{ name: '', address: 'orders@drinksharbour.com' }],
  },
  bodyStructure: {
    type: 'multipart/mixed',
    childNodes: [
      { type: 'text/plain' },
      { type: 'application/pdf', disposition: 'attachment' },
    ],
  },
};

test('maps an IMAP message to a flat envelope', () => {
  const e = mapEnvelope(rawMessage, 'INBOX');
  assert.strictEqual(e.uid, 42);
  assert.strictEqual(e.folder, 'INBOX');
  assert.strictEqual(e.subject, 'Re: Order #DH-1043');
  assert.strictEqual(e.from.address, 'jane@example.com');
  assert.strictEqual(e.from.name, 'Jane Doe');
  assert.strictEqual(e.messageId, '<abc@example.com>');
});

test('reads flags into booleans', () => {
  const e = mapEnvelope(rawMessage, 'INBOX');
  assert.strictEqual(e.seen, true);
  assert.strictEqual(e.answered, true);
  assert.strictEqual(e.flagged, false);
});

test('an unread message maps to seen:false', () => {
  const e = mapEnvelope({ ...rawMessage, flags: new Set() }, 'INBOX');
  assert.strictEqual(e.seen, false);
});

test('detects attachments from the body structure', () => {
  assert.strictEqual(mapEnvelope(rawMessage, 'INBOX').hasAttachments, true);
});

test('a plain text message has no attachments', () => {
  const plain = { ...rawMessage, bodyStructure: { type: 'text/plain' } };
  assert.strictEqual(mapEnvelope(plain, 'INBOX').hasAttachments, false);
});

test('an inline image is not counted as an attachment', () => {
  const inline = {
    ...rawMessage,
    bodyStructure: {
      type: 'multipart/related',
      childNodes: [
        { type: 'text/html' },
        { type: 'image/png', disposition: 'inline' },
      ],
    },
  };
  assert.strictEqual(mapEnvelope(inline, 'INBOX').hasAttachments, false);
});

test('a missing subject becomes an explicit placeholder, never undefined', () => {
  const noSubject = { ...rawMessage, envelope: { ...rawMessage.envelope, subject: undefined } };
  assert.strictEqual(mapEnvelope(noSubject, 'INBOX').subject, '(no subject)');
});

test('a missing from address does not throw', () => {
  const noFrom = { ...rawMessage, envelope: { ...rawMessage.envelope, from: undefined } };
  const e = mapEnvelope(noFrom, 'INBOX');
  assert.strictEqual(e.from.address, '');
});

test('references parse into an array', () => {
  const withRefs = {
    ...rawMessage,
    envelope: { ...rawMessage.envelope, references: '<a@x.com> <b@x.com>' },
  };
  assert.deepStrictEqual(mapEnvelope(withRefs, 'INBOX').references, ['<a@x.com>', '<b@x.com>']);
});

test('resolves special folders by flag, not by name', () => {
  const folders = [
    { path: 'INBOX', specialUse: undefined },
    { path: 'INBOX.Sent', specialUse: '\\Sent' },
    { path: 'INBOX.Trash', specialUse: '\\Trash' },
  ];
  assert.strictEqual(specialFolder(folders, '\\Sent'), 'INBOX.Sent');
  assert.strictEqual(specialFolder(folders, '\\Trash'), 'INBOX.Trash');
});

test('a server with a different separator resolves the same way', () => {
  const folders = [
    { path: 'INBOX', specialUse: undefined },
    { path: 'Sent Items', specialUse: '\\Sent' },
  ];
  assert.strictEqual(specialFolder(folders, '\\Sent'), 'Sent Items');
});

test('an absent special folder returns null rather than a guess', () => {
  assert.strictEqual(specialFolder([{ path: 'INBOX' }], '\\Archive'), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/imapService.test.js`
Expected: FAIL — `Cannot find module '../services/imap.service'`.

- [ ] **Step 3: Write the implementation**

Create `server/services/imap.service.js`:

```javascript
// services/imap.service.js
//
// Every IMAP verb the mail client needs, and nothing about HTTP or users.
//
// Two things drive the shape of this module:
//
//   1. IMAP is stateful. One command may be in flight per connection, and the
//      "currently selected mailbox" is connection-global. ImapFlow's
//      getMailboxLock() serializes both, so every folder operation goes
//      through withMailbox() and nothing touches client.* directly.
//
//   2. Nothing here persists. The envelope cache is in-process memory with a
//      30s TTL, dropped on any mutation. There is no Mongo model for mail and
//      there must never be one.

const { ImapFlow } = require('imapflow');

const ENVELOPE_CACHE_TTL_MS = 30_000;
const IDLE_CLOSE_MS = 5 * 60_000;

/** accountId -> { client, connecting, idleTimer } */
const pool = new Map();
/** cacheKey -> { at, value } */
const envelopeCache = new Map();

// ── connection pool ─────────────────────────────────────────────────────────

function scheduleIdleClose(accountId) {
  const entry = pool.get(accountId);
  if (!entry) return;
  clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => closeConnection(accountId), IDLE_CLOSE_MS);
  entry.idleTimer.unref?.();
}

async function closeConnection(accountId) {
  const entry = pool.get(accountId);
  if (!entry) return;
  pool.delete(accountId);
  clearTimeout(entry.idleTimer);
  try {
    await entry.client?.logout();
  } catch {
    // The connection is being discarded either way; a failure to log out
    // cleanly is not worth surfacing to the caller.
  }
}

async function getClient(account) {
  const existing = pool.get(account.id);
  if (existing?.connecting) return existing.connecting;
  if (existing?.client?.usable) {
    scheduleIdleClose(account.id);
    return existing.client;
  }
  if (existing) await closeConnection(account.id);

  const client = new ImapFlow({
    host: account.imap.host,
    port: account.imap.port,
    secure: account.imap.secure,
    auth: account.imap.auth,
    logger: false,
    // A hung mail server must fail fast and loudly rather than leaving the
    // inbox spinning — an empty inbox that is really an outage is the exact
    // failure mode this feature must not have.
    socketTimeout: 30_000,
    greetingTimeout: 15_000,
  });

  client.on('error', () => closeConnection(account.id));
  client.on('close', () => pool.delete(account.id));

  const connecting = client
    .connect()
    .then(() => {
      pool.set(account.id, { client, connecting: null, idleTimer: null });
      scheduleIdleClose(account.id);
      return client;
    })
    .catch((err) => {
      pool.delete(account.id);
      throw err;
    });

  pool.set(account.id, { client, connecting, idleTimer: null });
  return connecting;
}

/** Runs fn against a client with `folder` selected and locked. */
async function withMailbox(account, folder, fn) {
  const client = await getClient(account);
  const lock = await client.getMailboxLock(folder);
  try {
    return await fn(client);
  } finally {
    lock.release();
    scheduleIdleClose(account.id);
  }
}

async function closeAll() {
  await Promise.all([...pool.keys()].map(closeConnection));
  envelopeCache.clear();
}

// ── pure helpers (unit-tested without a connection) ─────────────────────────

/** Resolves a SPECIAL-USE flag to a folder path, or null. Names vary by server. */
function specialFolder(folders, use) {
  return folders.find((f) => f.specialUse === use)?.path ?? null;
}

const firstAddress = (list) => {
  const entry = Array.isArray(list) ? list[0] : null;
  return { name: entry?.name || '', address: entry?.address || '' };
};

const addressList = (list) =>
  (Array.isArray(list) ? list : []).map((a) => ({ name: a?.name || '', address: a?.address || '' }));

/**
 * True when the message carries a real attachment. Inline parts (the images a
 * newsletter references from its own HTML) are excluded — flagging those puts
 * a paperclip on nearly every marketing email and makes the icon meaningless.
 */
function hasAttachments(node) {
  if (!node) return false;
  if (node.disposition === 'attachment') return true;
  return (node.childNodes || []).some(hasAttachments);
}

/** Flattens one IMAP message into the envelope the UI consumes. */
function mapEnvelope(raw, folder) {
  const env = raw.envelope || {};
  const flags = raw.flags || new Set();
  return {
    uid: raw.uid,
    folder,
    subject: env.subject || '(no subject)',
    from: firstAddress(env.from),
    to: addressList(env.to),
    date: env.date || raw.internalDate || null,
    seen: flags.has('\\Seen'),
    flagged: flags.has('\\Flagged'),
    answered: flags.has('\\Answered'),
    hasAttachments: hasAttachments(raw.bodyStructure),
    preview: raw.preview || '',
    messageId: env.messageId || null,
    inReplyTo: env.inReplyTo || null,
    references: env.references ? String(env.references).trim().split(/\s+/) : [],
  };
}

// ── folder + envelope reads ─────────────────────────────────────────────────

async function listFolders(account) {
  const client = await getClient(account);
  const folders = await client.list();
  const withCounts = await Promise.all(
    folders
      .filter((f) => !f.flags?.has?.('\\Noselect'))
      .map(async (f) => {
        let status = { messages: 0, unseen: 0 };
        try {
          status = await client.status(f.path, { messages: true, unseen: true });
        } catch {
          // A folder we cannot STATUS still belongs in the list; showing it
          // with zero counts beats hiding a folder that holds mail.
        }
        return {
          path: f.path,
          name: f.name,
          specialUse: f.specialUse || null,
          total: status.messages || 0,
          unseen: status.unseen || 0,
        };
      })
  );
  scheduleIdleClose(account.id);
  return withCounts;
}

/** Builds an ESEARCH query matching from/subject/body for a free-text term. */
const searchQuery = (term) =>
  term ? { or: [{ from: term }, { subject: term }, { body: term }] } : { all: true };

function invalidate(accountId) {
  for (const key of envelopeCache.keys()) {
    if (key.startsWith(`${accountId}|`)) envelopeCache.delete(key);
  }
}

async function listMessages(account, { folder, page = 1, limit = 25, search = '' }) {
  const cacheKey = `${account.id}|${folder}|${page}|${limit}|${search}`;
  const hit = envelopeCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ENVELOPE_CACHE_TTL_MS) return hit.value;

  const value = await withMailbox(account, folder, async (client) => {
    const uids = await client.search(searchQuery(search), { uid: true });
    const newestFirst = [...uids].sort((a, b) => b - a);
    const start = (page - 1) * limit;
    const pageUids = newestFirst.slice(start, start + limit);

    const items = [];
    if (pageUids.length) {
      for await (const msg of client.fetch(
        pageUids.join(','),
        { uid: true, envelope: true, flags: true, bodyStructure: true },
        { uid: true }
      )) {
        items.push(mapEnvelope(msg, folder));
      }
      // fetch() returns in server order; restore newest-first for the UI.
      items.sort((a, b) => pageUids.indexOf(a.uid) - pageUids.indexOf(b.uid));
    }
    return { items, total: uids.length, page, limit };
  });

  envelopeCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

module.exports = {
  listFolders,
  listMessages,
  mapEnvelope,
  specialFolder,
  withMailbox,
  getClient,
  invalidate,
  closeAll,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/imapService.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add server/services/imap.service.js server/__tests__/imapService.test.js
git commit -m "feat(mail): add IMAP connection pool, folder listing and envelope paging"
```

---

### Task 3: Read routes — accounts, folders, message list

First end-to-end deliverable: real folder and envelope data over HTTP.

**Files:**
- Create: `server/controllers/mail.controller.js`
- Create: `server/routes/mail.routes.js`
- Modify: `server/server.js` (mount the router; exempt `/api/mail` from the global rate limit)

**Interfaces:**
- Consumes: `mailAccount.service.{listAccounts,resolveAccount}` (Task 1), `imap.service.{listFolders,listMessages}` (Task 2).
- Produces: `GET /api/mail/accounts`, `GET /api/mail/:accountId/folders`, `GET /api/mail/:accountId/messages`. Controller exports `getAccounts`, `getFolders`, `getMessages` — later tasks add exports to the same file.

- [ ] **Step 1: Write the controller**

Create `server/controllers/mail.controller.js`:

```javascript
// controllers/mail.controller.js
//
// The HTTP surface for /support/inbox. Every handler resolves the account
// through mailAccount.service first — the client's accountId is untrusted
// input until that call returns.
//
// Error translation matters here as much as the happy path. Prod SMTP silently
// rejecting every send for days is a failure this codebase has already lived
// through; an unreachable mailbox must reach the user as an error, never as an
// empty inbox.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { ValidationError, AppError } = require('../utils/errors');
const accounts = require('../services/mailAccount.service');
const imap = require('../services/imap.service');

/** Turns a mail-server failure into an HTTP error that names what broke. */
function mailError(err) {
  const message = String(err?.message || '');
  if (/auth|credential|login|AUTHENTICATIONFAILED/i.test(message)) {
    return new AppError('The mail server rejected the configured credentials', 502);
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|socket/i.test(message)) {
    return new AppError('Could not reach the mail server', 504);
  }
  return new AppError(`Mail server error: ${message}`, 502);
}

/** Runs a mail operation, translating transport failures. Never swallows. */
async function attempt(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mailError(err);
  }
}

const getAccounts = asyncHandler(async (req, res) => {
  successResponse(res, accounts.listAccounts(req.user), 'Mail accounts retrieved');
});

const getFolders = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const folders = await attempt(() => imap.listFolders(account));
  successResponse(res, folders, 'Folders retrieved');
});

const getMessages = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const folder = req.query.folder || 'INBOX';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const search = (req.query.search || '').trim();

  const result = await attempt(() =>
    imap.listMessages(account, { folder, page, limit, search })
  );
  successResponse(res, result, 'Messages retrieved');
});

module.exports = { getAccounts, getFolders, getMessages, attempt, mailError };
```

Note: `ValidationError` is imported for use by later tasks in this file; if your linter objects at this point, add the send handler (Task 6) before linting.

- [ ] **Step 2: Write the router**

Create `server/routes/mail.routes.js`:

```javascript
// routes/mail.routes.js
//
// Mail is read live from IMAP — nothing is stored. Authorization is not done
// with route middleware but inside mailAccount.service.resolveAccount, which
// re-checks the caller against the requested account on every single request.

const express = require('express');
const router = express.Router();
const c = require('../controllers/mail.controller');
const { protect, attachTenant } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router.get('/accounts', c.getAccounts);
router.get('/:accountId/folders', c.getFolders);
router.get('/:accountId/messages', c.getMessages);

module.exports = router;
```

- [ ] **Step 3: Mount the router**

In `server/server.js`, add after the `app.use('/api/banners', bannerRoutes);` line:

```javascript
app.use('/api/mail',               require('./routes/mail.routes'));
```

- [ ] **Step 4: Exempt mail from the global rate limit**

The global limiter allows 100 requests per 15 minutes in production. A mail client opening a folder and reading a handful of messages exceeds that in one sitting and would lock the user out of the whole API.

In `server/server.js`, change the limiter's `skip` (currently at line ~163) to:

```javascript
  // /api/mail is an interactive mail client: opening a folder and reading a
  // few messages easily exceeds 100 requests, and throttling it would lock the
  // user out of every other endpoint too. It has its own limiter below.
  skip: (req) => req.path === '/health' || req.path === '/api/ping' || req.path.startsWith('/api/mail'),
```

Then add immediately after the `app.use('/api', limiter);` line:

```javascript
const mailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { success: false, message: 'Too many mail requests, please slow down.' },
});
app.use('/api/mail', mailLimiter);
```

- [ ] **Step 5: Verify against the real mailbox**

Start the backend (`cd server && npm run dev`), then from a browser session logged into the admin, or with a valid token:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/mail/accounts | head -40
```

Expected: `{"success":true,...,"data":[{"id":"platform:orders@drinksharbour.com","address":"orders@drinksharbour.com",...}]}` with **no** `pass`, `auth`, or `host` key anywhere in the output.

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/mail/platform:orders@drinksharbour.com/folders" | head -40
```

Expected: the seven real folders (`INBOX`, `INBOX.Archive`, `INBOX.Junk`, `INBOX.Sent`, `INBOX.Drafts`, `INBOX.spam`, `INBOX.Trash`) with `total` and `unseen` counts.

- [ ] **Step 6: Run the full suite**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: 749 pass / 3 fail (known failures only).

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add server/controllers/mail.controller.js server/routes/mail.routes.js server/server.js
git commit -m "feat(mail): expose accounts, folders and message list over /api/mail"
```

---

### Task 4: Message body — parsing, sanitizing, attachments

**Files:**
- Create: `server/services/mailBody.service.js`
- Test: `server/__tests__/mailBody.test.js`
- Modify: `server/services/imap.service.js` (add `fetchMessage`, `fetchRaw`)
- Modify: `server/controllers/mail.controller.js` (add `getMessage`, `getAttachment`)
- Modify: `server/routes/mail.routes.js` (add two routes)

**Interfaces:**
- Consumes: `imap.withMailbox` (Task 2), `attempt` (Task 3).
- Produces:
  - `sanitizeBody(html, { allowRemoteImages }) -> { html, blockedRemoteImages: number }`
  - `parseMessage(source) -> { subject, from, to, cc, date, messageId, inReplyTo, references, html, text, attachments: [{ index, filename, contentType, size, isInline }] }`
  - `imap.fetchRaw(account, folder, uid) -> Buffer`
  - `imap.fetchMessage(account, folder, uid, { markSeen }) -> parsed message`
  - Routes `GET /:accountId/messages/:uid` and `GET /:accountId/messages/:uid/attachments/:index`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/mailBody.test.js`:

```javascript
// Message bodies are attacker-controlled HTML from strangers. Two independent
// layers keep them contained: this sanitizer, and a sandboxed iframe on the
// client. These tests pin the server layer.
//
// Remote images are stripped by default as well — loading them on open fires
// the sender's tracking pixel and leaks the reader's IP address.

const test = require('node:test');
const assert = require('node:assert');

const { sanitizeBody, parseMessage } = require('../services/mailBody.service');

test('strips script tags', () => {
  const { html } = sanitizeBody('<p>hi</p><script>alert(1)</script>', {});
  assert.ok(!html.includes('<script'), 'script tag survived');
  assert.ok(html.includes('hi'));
});

test('strips inline event handlers', () => {
  const { html } = sanitizeBody('<div onclick="steal()">click</div>', {});
  assert.ok(!/onclick/i.test(html), 'event handler survived');
});

test('strips javascript: URLs', () => {
  const { html } = sanitizeBody('<a href="javascript:alert(1)">x</a>', {});
  assert.ok(!/javascript:/i.test(html), 'javascript: URL survived');
});

test('strips iframes', () => {
  const { html } = sanitizeBody('<iframe src="https://evil.test"></iframe>', {});
  assert.ok(!html.includes('<iframe'), 'iframe survived');
});

test('strips form elements', () => {
  const { html } = sanitizeBody('<form action="https://evil.test"><input name="pw"></form>', {});
  assert.ok(!html.includes('<form'), 'form survived');
  assert.ok(!html.includes('<input'), 'input survived');
});

test('blocks remote images by default and reports the count', () => {
  const { html, blockedRemoteImages } = sanitizeBody(
    '<img src="https://tracker.test/pixel.gif"><img src="https://tracker.test/2.gif">',
    {}
  );
  assert.strictEqual(blockedRemoteImages, 2);
  assert.ok(!html.includes('tracker.test'), 'remote image URL survived');
});

test('allows remote images when the reader opts in', () => {
  const { html } = sanitizeBody('<img src="https://cdn.test/a.png">', {
    allowRemoteImages: true,
  });
  assert.ok(html.includes('cdn.test/a.png'));
});

test('keeps embedded data: images regardless of the opt-in', () => {
  const src = 'data:image/png;base64,iVBORw0KGgo=';
  const { html, blockedRemoteImages } = sanitizeBody(`<img src="${src}">`, {});
  assert.ok(html.includes('data:image/png'), 'inline image was stripped');
  assert.strictEqual(blockedRemoteImages, 0);
});

test('preserves ordinary formatting', () => {
  const { html } = sanitizeBody('<p><strong>bold</strong> and <em>italic</em></p>', {});
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>italic</em>'));
});

test('links open in a new tab without leaking the opener', () => {
  const { html } = sanitizeBody('<a href="https://example.test">x</a>', {});
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test('parses an RFC822 message into headers, body and attachments', async () => {
  const source = [
    'From: Jane Doe <jane@example.com>',
    'To: orders@drinksharbour.com',
    'Subject: Test message',
    'Message-ID: <m1@example.com>',
    'In-Reply-To: <parent@example.com>',
    'References: <root@example.com> <parent@example.com>',
    'Date: Thu, 30 Jul 2026 10:00:00 +0000',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Hello there',
  ].join('\r\n');

  const parsed = await parseMessage(Buffer.from(source));
  assert.strictEqual(parsed.subject, 'Test message');
  assert.strictEqual(parsed.from.address, 'jane@example.com');
  assert.strictEqual(parsed.messageId, '<m1@example.com>');
  assert.strictEqual(parsed.inReplyTo, '<parent@example.com>');
  assert.deepStrictEqual(parsed.references, ['<root@example.com>', '<parent@example.com>']);
  assert.ok(parsed.text.includes('Hello there'));
  assert.deepStrictEqual(parsed.attachments, []);
});

test('a text-only message still yields renderable html', async () => {
  const source = [
    'From: a@example.com',
    'Subject: Plain',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'line one',
  ].join('\r\n');
  const parsed = await parseMessage(Buffer.from(source));
  assert.ok(parsed.html && parsed.html.includes('line one'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailBody.test.js`
Expected: FAIL — `Cannot find module '../services/mailBody.service'`.

- [ ] **Step 3: Write the body service**

Create `server/services/mailBody.service.js`:

```javascript
// services/mailBody.service.js
//
// Parsing and sanitizing message bodies. Everything in here treats its input
// as hostile: an email body is HTML written by a stranger, delivered into a
// page that holds an authenticated admin session.
//
// The client renders the output inside a sandboxed iframe as well. Two layers,
// because either one alone has been enough to burn people.

const sanitizeHtml = require('sanitize-html');
const { simpleParser } = require('mailparser');

const ALLOWED_TAGS = [
  'p', 'div', 'span', 'br', 'hr', 'a', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'img', 'font', 'center', 'small', 'sub', 'sup',
];

/**
 * Sanitizes a message body.
 *
 * Remote images are removed unless the reader explicitly asks for them: an
 * <img> pointing at the sender's server is a read receipt that also hands over
 * the reader's IP address. Embedded data: and cid: images are always kept —
 * they cannot phone home.
 */
function sanitizeBody(html, { allowRemoteImages = false } = {}) {
  let blockedRemoteImages = 0;

  const clean = sanitizeHtml(String(html || ''), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'name', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style'],
      '*': ['style', 'align', 'valign', 'bgcolor', 'colspan', 'rowspan', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data', 'cid'] },
    allowProtocolRelative: false,
    // style is allowed for layout fidelity but positioning is not: a fixed or
    // absolutely-positioned element inside the frame can cover the whole body.
    allowedStyles: {
      '*': {
        color: [/^.*$/],
        'background-color': [/^.*$/],
        'text-align': [/^.*$/],
        'font-size': [/^.*$/],
        'font-weight': [/^.*$/],
        'font-family': [/^.*$/],
        'text-decoration': [/^.*$/],
        margin: [/^.*$/],
        padding: [/^.*$/],
        border: [/^.*$/],
        width: [/^.*$/],
        'max-width': [/^.*$/],
      },
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
      img: (tagName, attribs) => {
        const src = attribs.src || '';
        const isEmbedded = src.startsWith('data:') || src.startsWith('cid:');
        if (!isEmbedded && !allowRemoteImages) {
          blockedRemoteImages += 1;
          const { src: _dropped, ...rest } = attribs;
          return { tagName: 'img', attribs: { ...rest, 'data-blocked-remote': 'true' } };
        }
        return { tagName: 'img', attribs };
      },
    },
  });

  return { html: clean, blockedRemoteImages };
}

const addr = (obj) => ({
  name: obj?.value?.[0]?.name || '',
  address: obj?.value?.[0]?.address || '',
});

const addrList = (obj) =>
  (obj?.value || []).map((a) => ({ name: a.name || '', address: a.address || '' }));

/** Parses raw RFC822 into headers, body and an attachment manifest. */
async function parseMessage(source) {
  const parsed = await simpleParser(source);

  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? String(parsed.references).trim().split(/\s+/)
      : [];

  return {
    subject: parsed.subject || '(no subject)',
    from: addr(parsed.from),
    to: addrList(parsed.to),
    cc: addrList(parsed.cc),
    date: parsed.date || null,
    messageId: parsed.messageId || null,
    inReplyTo: parsed.inReplyTo || null,
    references,
    // textAsHtml is the fallback for text-only mail; without it a plain
    // message renders as a single unbroken paragraph.
    html: parsed.html || parsed.textAsHtml || '',
    text: parsed.text || '',
    attachments: (parsed.attachments || []).map((a, index) => ({
      index,
      filename: a.filename || `attachment-${index + 1}`,
      contentType: a.contentType || 'application/octet-stream',
      size: a.size || 0,
      isInline: a.contentDisposition === 'inline',
    })),
  };
}

/** Returns one attachment's raw buffer by manifest index, or null. */
async function extractAttachment(source, index) {
  const parsed = await simpleParser(source);
  const attachment = (parsed.attachments || [])[index];
  if (!attachment) return null;
  return {
    filename: attachment.filename || `attachment-${index + 1}`,
    contentType: attachment.contentType || 'application/octet-stream',
    content: attachment.content,
  };
}

module.exports = { sanitizeBody, parseMessage, extractAttachment };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailBody.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Add raw fetch to the IMAP service**

In `server/services/imap.service.js`, add before `module.exports`:

```javascript
/** Fetches one message's raw RFC822 source. Returns null if the UID is gone. */
async function fetchRaw(account, folder, uid) {
  return withMailbox(account, folder, async (client) => {
    const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
    return message?.source || null;
  });
}

/** Marks a message \Seen. Safe to call when it already is. */
async function markSeen(account, folder, uid) {
  await withMailbox(account, folder, (client) =>
    client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
  );
  invalidate(account.id);
}
```

And extend the export list to `{ listFolders, listMessages, mapEnvelope, specialFolder, withMailbox, getClient, invalidate, closeAll, fetchRaw, markSeen }`.

- [ ] **Step 6: Add the controller handlers**

In `server/controllers/mail.controller.js`, add before `module.exports`:

```javascript
const body = require('../services/mailBody.service');

const getMessage = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const folder = req.query.folder || 'INBOX';
  const uid = parseInt(req.params.uid, 10);
  if (!Number.isFinite(uid)) throw new ValidationError('Invalid message id');

  const source = await attempt(() => imap.fetchRaw(account, folder, uid));
  if (!source) {
    // The message moved or was deleted from another client. Say so — a blank
    // reading pane would read as a bug.
    throw new AppError('That message is no longer in this folder', 404);
  }

  const parsed = await body.parseMessage(source);
  const { html, blockedRemoteImages } = body.sanitizeBody(parsed.html, {
    allowRemoteImages: req.query.images === 'true',
  });

  if (req.query.markSeen !== 'false') {
    await attempt(() => imap.markSeen(account, folder, uid));
  }

  successResponse(
    res,
    { ...parsed, uid, folder, html, blockedRemoteImages },
    'Message retrieved'
  );
});

const getAttachment = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const folder = req.query.folder || 'INBOX';
  const uid = parseInt(req.params.uid, 10);
  const index = parseInt(req.params.index, 10);
  if (!Number.isFinite(uid) || !Number.isFinite(index)) {
    throw new ValidationError('Invalid attachment reference');
  }

  const source = await attempt(() => imap.fetchRaw(account, folder, uid));
  if (!source) throw new AppError('That message is no longer in this folder', 404);

  const file = await body.extractAttachment(source, index);
  if (!file) throw new AppError('Attachment not found', 404);

  // Streamed straight through. Attachments are never written to disk or
  // uploaded to Cloudinary — nothing about this mailbox persists.
  res.setHeader('Content-Type', file.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.filename.replace(/["\r\n]/g, '')}"`
  );
  res.send(file.content);
});
```

Extend the export list to include `getMessage` and `getAttachment`.

- [ ] **Step 7: Add the routes**

In `server/routes/mail.routes.js`, add after the messages route:

```javascript
router.get('/:accountId/messages/:uid', c.getMessage);
router.get('/:accountId/messages/:uid/attachments/:index', c.getAttachment);
```

- [ ] **Step 8: Verify against the real mailbox**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/mail/platform:orders@drinksharbour.com/messages?folder=INBOX&limit=3" \
  | python3 -m json.tool | head -40
```

Expected: three envelopes with real subjects and senders. Note a `uid`, then:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5001/api/mail/platform:orders@drinksharbour.com/messages/<UID>?folder=INBOX" \
  | python3 -m json.tool | head -30
```

Expected: parsed headers plus a `html` field containing no `<script`, and a `blockedRemoteImages` count.

- [ ] **Step 9: Run the full suite and commit**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: 761 pass / 3 fail (known failures only).

```bash
cd /Users/mac/Documents/drinksharbour
git add server/services/mailBody.service.js server/services/imap.service.js \
        server/controllers/mail.controller.js server/routes/mail.routes.js \
        server/__tests__/mailBody.test.js
git commit -m "feat(mail): parse, sanitize and serve message bodies and attachments"
```

---

### Task 5: Mutations — flags, move, delete

**Files:**
- Modify: `server/services/imap.service.js` (add `setFlags`, `moveMessages`, `deleteMessages`)
- Modify: `server/controllers/mail.controller.js` (add `setFlags`, `moveMessages`, `deleteMessages`)
- Modify: `server/routes/mail.routes.js`
- Test: `server/__tests__/mailMutations.test.js`

**Interfaces:**
- Consumes: `imap.withMailbox`, `imap.listFolders`, `imap.specialFolder`, `imap.invalidate`.
- Produces:
  - `imap.setFlags(account, folder, uids, { add, remove })`
  - `imap.moveMessages(account, folder, uids, target)`
  - `imap.deleteMessages(account, folder, uids) -> { expunged: boolean, movedTo: string|null }`
  - `resolveDeleteTarget(folders, folder) -> { expunge: boolean, trash: string|null }` — exported from `imap.service` for testing.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/mailMutations.test.js`:

```javascript
// Delete must not destroy mail on the first click. Anywhere but Trash, delete
// is a move to Trash; only a message already in Trash is expunged. This is the
// difference between "undo it in the mail client" and "it is gone".

const test = require('node:test');
const assert = require('node:assert');

const { resolveDeleteTarget } = require('../services/imap.service');

const FOLDERS = [
  { path: 'INBOX', specialUse: null },
  { path: 'INBOX.Archive', specialUse: '\\Archive' },
  { path: 'INBOX.Trash', specialUse: '\\Trash' },
];

test('deleting from the inbox moves to trash rather than expunging', () => {
  const target = resolveDeleteTarget(FOLDERS, 'INBOX');
  assert.strictEqual(target.expunge, false);
  assert.strictEqual(target.trash, 'INBOX.Trash');
});

test('deleting from archive also moves to trash', () => {
  const target = resolveDeleteTarget(FOLDERS, 'INBOX.Archive');
  assert.strictEqual(target.expunge, false);
  assert.strictEqual(target.trash, 'INBOX.Trash');
});

test('deleting from trash expunges', () => {
  const target = resolveDeleteTarget(FOLDERS, 'INBOX.Trash');
  assert.strictEqual(target.expunge, true);
});

test('with no trash folder it expunges, because there is nowhere to move to', () => {
  const target = resolveDeleteTarget([{ path: 'INBOX', specialUse: null }], 'INBOX');
  assert.strictEqual(target.expunge, true);
  assert.strictEqual(target.trash, null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailMutations.test.js`
Expected: FAIL — `resolveDeleteTarget is not a function`.

- [ ] **Step 3: Implement the IMAP mutations**

In `server/services/imap.service.js`, add before `module.exports`:

```javascript
/**
 * Where a delete should send a message.
 *
 * Delete is a move to Trash everywhere except Trash itself, so one click can
 * never destroy mail irrecoverably. If the account has no Trash folder there
 * is nowhere to move to and the expunge is the honest outcome.
 */
function resolveDeleteTarget(folders, folder) {
  const trash = specialFolder(folders, '\\Trash');
  if (!trash || folder === trash) return { expunge: true, trash };
  return { expunge: false, trash };
}

async function setFlags(account, folder, uids, { add = [], remove = [] }) {
  const range = uids.join(',');
  await withMailbox(account, folder, async (client) => {
    if (add.length) await client.messageFlagsAdd(range, add, { uid: true });
    if (remove.length) await client.messageFlagsRemove(range, remove, { uid: true });
  });
  invalidate(account.id);
}

async function moveMessages(account, folder, uids, target) {
  await withMailbox(account, folder, (client) =>
    client.messageMove(uids.join(','), target, { uid: true })
  );
  invalidate(account.id);
}

async function deleteMessages(account, folder, uids) {
  const folders = await listFolders(account);
  const { expunge, trash } = resolveDeleteTarget(folders, folder);

  if (expunge) {
    await withMailbox(account, folder, (client) =>
      client.messageDelete(uids.join(','), { uid: true })
    );
    invalidate(account.id);
    return { expunged: true, movedTo: null };
  }

  await moveMessages(account, folder, uids, trash);
  return { expunged: false, movedTo: trash };
}
```

Extend the export list with `resolveDeleteTarget, setFlags, moveMessages, deleteMessages`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailMutations.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the controller handlers**

In `server/controllers/mail.controller.js`, add before `module.exports`:

```javascript
/** Parses and validates a uid list from a request. Throws if empty or bad. */
function parseUids(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(',');
  const uids = raw.map((v) => parseInt(v, 10)).filter(Number.isFinite);
  if (!uids.length) throw new ValidationError('No messages selected');
  return uids;
}

const setFlags = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const { folder = 'INBOX', add = [], remove = [] } = req.body;
  const uids = parseUids(req.body.uids);
  await attempt(() => imap.setFlags(account, folder, uids, { add, remove }));
  successResponse(res, { uids }, 'Flags updated');
});

const moveMessages = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const { folder = 'INBOX', to } = req.body;
  if (!to) throw new ValidationError('A destination folder is required');
  const uids = parseUids(req.body.uids);
  await attempt(() => imap.moveMessages(account, folder, uids, to));
  successResponse(res, { uids, to }, 'Messages moved');
});

const deleteMessages = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const folder = req.query.folder || 'INBOX';
  const uids = parseUids(req.query.uids);
  const result = await attempt(() => imap.deleteMessages(account, folder, uids));
  successResponse(res, result, result.expunged ? 'Messages deleted' : 'Messages moved to trash');
});
```

Extend the export list with `setFlags, moveMessages, deleteMessages`.

- [ ] **Step 6: Add the routes**

In `server/routes/mail.routes.js`:

```javascript
router.post('/:accountId/messages/flags', c.setFlags);
router.post('/:accountId/messages/move', c.moveMessages);
router.delete('/:accountId/messages', c.deleteMessages);
```

**These must be registered before `router.get('/:accountId/messages/:uid', ...)`** — otherwise `/messages/flags` matches the `:uid` route. Place the three lines immediately after `router.get('/:accountId/messages', c.getMessages);`.

- [ ] **Step 7: Run the full suite and commit**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: 765 pass / 3 fail.

```bash
cd /Users/mac/Documents/drinksharbour
git add server/services/imap.service.js server/controllers/mail.controller.js \
        server/routes/mail.routes.js server/__tests__/mailMutations.test.js
git commit -m "feat(mail): add flag, move and trash-safe delete operations"
```

---

### Task 6: Sending — SMTP, reply headers, Sent append

**Files:**
- Create: `server/services/mailSend.service.js`
- Test: `server/__tests__/mailSend.test.js`
- Modify: `server/controllers/mail.controller.js` (add `sendMessage`, `saveDraft`)
- Modify: `server/routes/mail.routes.js`

**Interfaces:**
- Consumes: `mailAccount.resolveAccount`, `imap.{listFolders, specialFolder, withMailbox, getClient, invalidate}`.
- Produces:
  - `buildReplyHeaders({ messageId, references }) -> { inReplyTo, references }` — pure, exported for testing.
  - `normalizeRecipients(input) -> string[]` — pure, exported for testing.
  - `totalAttachmentSize(files) -> number` and `MAX_ATTACHMENT_BYTES` — pure, exported.
  - `send(account, { to, cc, bcc, subject, html, inReplyTo, references, attachments }) -> { messageId, appendedTo }`
  - `saveDraft(account, draft) -> { appendedTo }`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/mailSend.test.js`:

```javascript
// Reply threading is the detail homegrown mail UIs get wrong. A reply must set
// In-Reply-To to the parent's Message-ID and append that id to References, or
// the recipient's client shows it as an unrelated new message.

const test = require('node:test');
const assert = require('node:assert');

const {
  buildReplyHeaders,
  normalizeRecipients,
  totalAttachmentSize,
  MAX_ATTACHMENT_BYTES,
} = require('../services/mailSend.service');

test('a reply to a root message starts the references chain', () => {
  const h = buildReplyHeaders({ messageId: '<root@x.com>', references: [] });
  assert.strictEqual(h.inReplyTo, '<root@x.com>');
  assert.deepStrictEqual(h.references, ['<root@x.com>']);
});

test('a reply mid-thread appends to the existing chain', () => {
  const h = buildReplyHeaders({
    messageId: '<third@x.com>',
    references: ['<root@x.com>', '<second@x.com>'],
  });
  assert.strictEqual(h.inReplyTo, '<third@x.com>');
  assert.deepStrictEqual(h.references, ['<root@x.com>', '<second@x.com>', '<third@x.com>']);
});

test('an already-present message id is not duplicated', () => {
  const h = buildReplyHeaders({
    messageId: '<second@x.com>',
    references: ['<root@x.com>', '<second@x.com>'],
  });
  assert.deepStrictEqual(h.references, ['<root@x.com>', '<second@x.com>']);
});

test('composing fresh yields no threading headers', () => {
  const h = buildReplyHeaders({ messageId: null, references: [] });
  assert.strictEqual(h.inReplyTo, null);
  assert.deepStrictEqual(h.references, []);
});

test('recipients accept a comma-separated string', () => {
  assert.deepStrictEqual(
    normalizeRecipients('a@x.com, b@x.com ,c@x.com'),
    ['a@x.com', 'b@x.com', 'c@x.com']
  );
});

test('recipients accept an array and drop blanks', () => {
  assert.deepStrictEqual(normalizeRecipients(['a@x.com', '', '  ']), ['a@x.com']);
});

test('an absent recipient field is an empty list, not a crash', () => {
  assert.deepStrictEqual(normalizeRecipients(undefined), []);
  assert.deepStrictEqual(normalizeRecipients(null), []);
});

test('attachment size is summed across every file', () => {
  const files = [{ size: 1000 }, { size: 2500 }];
  assert.strictEqual(totalAttachmentSize(files), 3500);
  assert.strictEqual(totalAttachmentSize([]), 0);
  assert.strictEqual(totalAttachmentSize(undefined), 0);
});

test('the attachment cap is 15 MB', () => {
  assert.strictEqual(MAX_ATTACHMENT_BYTES, 15 * 1024 * 1024);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailSend.test.js`
Expected: FAIL — `Cannot find module '../services/mailSend.service'`.

- [ ] **Step 3: Write the send service**

Create `server/services/mailSend.service.js`:

```javascript
// services/mailSend.service.js
//
// Outbound mail for the support inbox. Kept separate from email.service.js,
// which is the transactional path (order confirmations) with a single
// env-bound transporter — coupling the two would put customer support mail and
// order receipts on the same failure.
//
// A send that fails must throw. This codebase has already shipped a silent
// mail outage that logged success for days; nothing here may swallow an error.

const nodemailer = require('nodemailer');
const imap = require('./imap.service');

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** accountId -> transporter */
const transports = new Map();

function getTransport(account) {
  const existing = transports.get(account.id);
  if (existing) return existing;
  const transport = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: account.smtp.auth,
  });
  transports.set(account.id, transport);
  return transport;
}

/** Accepts "a@x, b@y" or ["a@x","b@y"] and returns a clean list. */
function normalizeRecipients(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  return list.map((v) => String(v).trim()).filter(Boolean);
}

/**
 * Threading headers for a reply.
 *
 * In-Reply-To names the immediate parent; References carries the whole chain
 * with the parent appended. Get this wrong and the recipient's mail client
 * files the reply as an unrelated message.
 */
function buildReplyHeaders({ messageId, references = [] }) {
  if (!messageId) return { inReplyTo: null, references: [] };
  const chain = references.includes(messageId) ? [...references] : [...references, messageId];
  return { inReplyTo: messageId, references: chain };
}

function totalAttachmentSize(files) {
  return (files || []).reduce((sum, f) => sum + (f.size || 0), 0);
}

/** Appends a raw message to a special-use folder. Returns the path, or null. */
async function appendTo(account, specialUse, raw, flags) {
  const folders = await imap.listFolders(account);
  const path = imap.specialFolder(folders, specialUse);
  if (!path) return null;
  const client = await imap.getClient(account);
  await client.append(path, raw, flags, new Date());
  imap.invalidate(account.id);
  return path;
}

/**
 * Sends a message, then files a copy in the account's Sent folder.
 *
 * The Sent append is deliberately non-fatal: the mail has already left, and
 * reporting a send failure at that point would be a lie. It is reported back
 * as appendedTo:null so the caller can say so.
 */
async function send(account, { to, cc, bcc, subject, html, inReplyTo, references, attachments }) {
  const message = {
    from: { name: account.displayName, address: account.address },
    to: normalizeRecipients(to),
    cc: normalizeRecipients(cc),
    bcc: normalizeRecipients(bcc),
    subject: subject || '(no subject)',
    html: html || '',
    attachments: (attachments || []).map((f) => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype,
    })),
  };

  if (inReplyTo) {
    message.inReplyTo = inReplyTo;
    message.references = references;
  }

  const info = await getTransport(account).sendMail(message);

  let appendedTo = null;
  try {
    appendedTo = await appendTo(account, '\\Sent', info.message || Buffer.from(''), ['\\Seen']);
  } catch {
    // Already delivered. A failed Sent-folder copy is worth reporting, not
    // worth turning a successful send into an error.
  }

  return { messageId: info.messageId, appendedTo };
}

/** Files a draft in the account's Drafts folder without sending it. */
async function saveDraft(account, { to, cc, bcc, subject, html }) {
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const built = await composer.sendMail({
    from: { name: account.displayName, address: account.address },
    to: normalizeRecipients(to),
    cc: normalizeRecipients(cc),
    bcc: normalizeRecipients(bcc),
    subject: subject || '(no subject)',
    html: html || '',
  });
  const appendedTo = await appendTo(account, '\\Drafts', built.message, ['\\Draft', '\\Seen']);
  return { appendedTo };
}

module.exports = {
  send,
  saveDraft,
  buildReplyHeaders,
  normalizeRecipients,
  totalAttachmentSize,
  MAX_ATTACHMENT_BYTES,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/mailSend.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Add the controller handlers**

In `server/controllers/mail.controller.js`, add before `module.exports`:

```javascript
const sender = require('../services/mailSend.service');

const sendMessage = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const { to, cc, bcc, subject, html, replyToMessageId, replyReferences } = req.body;

  if (!sender.normalizeRecipients(to).length) {
    throw new ValidationError('At least one recipient is required');
  }

  const files = req.files || [];
  if (sender.totalAttachmentSize(files) > sender.MAX_ATTACHMENT_BYTES) {
    throw new ValidationError('Attachments exceed the 15 MB limit');
  }

  const references = Array.isArray(replyReferences)
    ? replyReferences
    : String(replyReferences || '').trim().split(/\s+/).filter(Boolean);
  const threading = sender.buildReplyHeaders({
    messageId: replyToMessageId || null,
    references,
  });

  const result = await attempt(() =>
    sender.send(account, {
      to, cc, bcc, subject, html,
      inReplyTo: threading.inReplyTo,
      references: threading.references,
      attachments: files,
    })
  );
  successResponse(res, result, 'Message sent');
});

const saveDraft = asyncHandler(async (req, res) => {
  const account = accounts.resolveAccount(req.user, req.params.accountId);
  const result = await attempt(() => sender.saveDraft(account, req.body));
  successResponse(res, result, 'Draft saved');
});
```

Extend the export list with `sendMessage, saveDraft`.

- [ ] **Step 6: Add the routes with multipart handling**

In `server/routes/mail.routes.js`, add near the top:

```javascript
const multer = require('multer');

// Attachments are held in memory and streamed to SMTP. Nothing is written to
// disk or uploaded anywhere — this mailbox leaves no trace on our side.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
});
```

And add the routes:

```javascript
router.post('/:accountId/send', upload.array('attachments', 10), c.sendMessage);
router.post('/:accountId/drafts', c.saveDraft);
```

- [ ] **Step 7: Verify a real send**

With the backend running, send a message to your own address:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "to=<your-address>" -F "subject=Inbox smoke test" \
  -F "html=<p>Sent from the new support inbox.</p>" \
  "http://localhost:5001/api/mail/platform:orders@drinksharbour.com/send" | python3 -m json.tool
```

Expected: `{"success":true,...,"data":{"messageId":"<...>","appendedTo":"INBOX.Sent"}}`, the message arrives in your inbox, and a copy appears in `INBOX.Sent` when you list that folder.

- [ ] **Step 8: Run the full suite and commit**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: 774 pass / 3 fail.

```bash
cd /Users/mac/Documents/drinksharbour
git add server/services/mailSend.service.js server/controllers/mail.controller.js \
        server/routes/mail.routes.js server/__tests__/mailSend.test.js
git commit -m "feat(mail): send mail over SMTP with reply threading and Sent append"
```

---

### Task 7: Client data layer and types

**Files:**
- Create: `client/apps/admin/src/app/shared/support/inbox/types.ts`
- Create: `client/apps/admin/src/app/shared/support/inbox/api.ts`
- Create: `client/apps/admin/src/app/shared/support/inbox/use-mail.ts`

**Interfaces:**
- Consumes: the `/api/mail` endpoints from Tasks 3–6.
- Produces:
  - Types: `MailAccount`, `MailFolder`, `MailEnvelope`, `MailMessage`, `MailAttachment`, `ComposeDraft`.
  - `api.ts`: `fetchAccounts`, `fetchFolders`, `fetchMessages`, `fetchMessage`, `setFlags`, `moveMessages`, `deleteMessages`, `sendMessage`, `attachmentUrl`.
  - `use-mail.ts`: `useMailAccounts()`, `useMailFolders(accountId)`, `useMailMessages(accountId, params)`, `useMailMessage(accountId, folder, uid, showImages)` — each returns `{ data, loading, error, reload }`.

- [ ] **Step 1: Write the types**

Create `client/apps/admin/src/app/shared/support/inbox/types.ts`:

```typescript
export interface MailAccount {
  id: string;
  address: string;
  displayName: string;
  scope: 'platform' | 'tenant';
}

export interface MailFolder {
  path: string;
  name: string;
  specialUse: string | null;
  total: number;
  unseen: number;
}

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailEnvelope {
  uid: number;
  folder: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  hasAttachments: boolean;
  preview: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
}

export interface MailAttachment {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

export interface MailMessage {
  uid: number;
  folder: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  date: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  html: string;
  text: string;
  attachments: MailAttachment[];
  blockedRemoteImages: number;
}

export interface MessagePage {
  items: MailEnvelope[];
  total: number;
  page: number;
  limit: number;
}

export interface ComposeDraft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
  files: File[];
  replyToMessageId?: string | null;
  replyReferences?: string[];
}
```

- [ ] **Step 2: Write the API layer**

Create `client/apps/admin/src/app/shared/support/inbox/api.ts`:

```typescript
import type {
  MailAccount,
  MailFolder,
  MailMessage,
  MessagePage,
  ComposeDraft,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Every failure here becomes a thrown Error carrying the server's own message.
 * The mail server being unreachable must never surface as an empty inbox.
 */
async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}/api/mail${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Mail request failed (${res.status})`);
  }
  if (!res.ok || !body.success) {
    throw new Error(body.message || `Mail request failed (${res.status})`);
  }
  return body.data;
}

export const fetchAccounts = (token: string) =>
  request<MailAccount[]>('/accounts', token);

export const fetchFolders = (token: string, accountId: string) =>
  request<MailFolder[]>(`/${encodeURIComponent(accountId)}/folders`, token);

export function fetchMessages(
  token: string,
  accountId: string,
  params: { folder: string; page?: number; limit?: number; search?: string }
) {
  const query = new URLSearchParams({
    folder: params.folder,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 25),
    ...(params.search ? { search: params.search } : {}),
  });
  return request<MessagePage>(
    `/${encodeURIComponent(accountId)}/messages?${query}`,
    token
  );
}

export function fetchMessage(
  token: string,
  accountId: string,
  folder: string,
  uid: number,
  showImages = false
) {
  const query = new URLSearchParams({ folder, images: String(showImages) });
  return request<MailMessage>(
    `/${encodeURIComponent(accountId)}/messages/${uid}?${query}`,
    token
  );
}

export const setFlags = (
  token: string,
  accountId: string,
  payload: { folder: string; uids: number[]; add?: string[]; remove?: string[] }
) =>
  request<{ uids: number[] }>(`/${encodeURIComponent(accountId)}/messages/flags`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const moveMessages = (
  token: string,
  accountId: string,
  payload: { folder: string; uids: number[]; to: string }
) =>
  request<{ uids: number[]; to: string }>(
    `/${encodeURIComponent(accountId)}/messages/move`,
    token,
    { method: 'POST', body: JSON.stringify(payload) }
  );

export function deleteMessages(
  token: string,
  accountId: string,
  folder: string,
  uids: number[]
) {
  const query = new URLSearchParams({ folder, uids: uids.join(',') });
  return request<{ expunged: boolean; movedTo: string | null }>(
    `/${encodeURIComponent(accountId)}/messages?${query}`,
    token,
    { method: 'DELETE' }
  );
}

export function sendMessage(token: string, accountId: string, draft: ComposeDraft) {
  const form = new FormData();
  form.append('to', draft.to);
  form.append('cc', draft.cc);
  form.append('bcc', draft.bcc);
  form.append('subject', draft.subject);
  form.append('html', draft.html);
  if (draft.replyToMessageId) {
    form.append('replyToMessageId', draft.replyToMessageId);
    form.append('replyReferences', (draft.replyReferences || []).join(' '));
  }
  draft.files.forEach((file) => form.append('attachments', file));

  return request<{ messageId: string; appendedTo: string | null }>(
    `/${encodeURIComponent(accountId)}/send`,
    token,
    { method: 'POST', body: form }
  );
}

/** Attachment downloads go through a plain link, so the token rides the query. */
export const attachmentUrl = (
  accountId: string,
  folder: string,
  uid: number,
  index: number
) =>
  `${API_URL}/api/mail/${encodeURIComponent(accountId)}/messages/${uid}/attachments/${index}?folder=${encodeURIComponent(folder)}`;
```

- [ ] **Step 3: Write the hooks**

Create `client/apps/admin/src/app/shared/support/inbox/use-mail.ts`:

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import * as api from './api';
import type { MailAccount, MailFolder, MailMessage, MessagePage } from './types';

/** The admin session carries the backend JWT the mail API expects. */
export function useMailToken(): string | null {
  const { data: session } = useSession();
  return (session?.user as { token?: string } | undefined)?.token ?? null;
}

interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * One loader for every mail resource.
 *
 * error and data are separate state: an error must never be represented as an
 * empty result, or an unreachable mail server renders as "no messages".
 */
function useResource<T>(
  loader: (token: string) => Promise<T>,
  deps: unknown[],
  enabled = true
): Resource<T> {
  const token = useMailToken();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!token || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setData(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

export const useMailAccounts = (): Resource<MailAccount[]> =>
  useResource((token) => api.fetchAccounts(token), []);

export const useMailFolders = (accountId: string | null): Resource<MailFolder[]> =>
  useResource(
    (token) => api.fetchFolders(token, accountId as string),
    [accountId],
    Boolean(accountId)
  );

export const useMailMessages = (
  accountId: string | null,
  params: { folder: string; page: number; search: string }
): Resource<MessagePage> =>
  useResource(
    (token) => api.fetchMessages(token, accountId as string, params),
    [accountId, params.folder, params.page, params.search],
    Boolean(accountId)
  );

export const useMailMessage = (
  accountId: string | null,
  folder: string | null,
  uid: number | null,
  showImages: boolean
): Resource<MailMessage> =>
  useResource(
    (token) =>
      api.fetchMessage(token, accountId as string, folder as string, uid as number, showImages),
    [accountId, folder, uid, showImages],
    Boolean(accountId && folder && uid)
  );
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit 2>&1 | grep -c "^src/"`
Expected: a count no higher than the ~546 baseline. If it rose, the added errors are yours — fix them and re-run.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/support/inbox/types.ts \
        client/apps/admin/src/app/shared/support/inbox/api.ts \
        client/apps/admin/src/app/shared/support/inbox/use-mail.ts
git commit -m "feat(inbox): add mail API client, types and data hooks"
```

---

### Task 8: Folder rail and message list

**Files:**
- Create: `client/apps/admin/src/app/shared/support/inbox/folder-rail.tsx`
- Create: `client/apps/admin/src/app/shared/support/inbox/mail-state.ts`
- Rewrite: `client/apps/admin/src/app/shared/support/inbox/message-list.tsx`

**Interfaces:**
- Consumes: `use-mail.ts` hooks and `types.ts` (Task 7).
- Produces:
  - `mail-state.ts`: jotai atoms `accountIdAtom`, `folderAtom`, `pageAtom`, `searchAtom`, `selectedUidAtom`, `checkedUidsAtom`, `showImagesAtom`.
  - `<FolderRail className? />`, `<MessageList className? />`.

- [ ] **Step 1: Write the shared state**

Create `client/apps/admin/src/app/shared/support/inbox/mail-state.ts`:

```typescript
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

/** The account survives reloads; everything else is per-visit. */
export const accountIdAtom = atomWithStorage<string | null>('dh_mail_account', null);
export const folderAtom = atom<string>('INBOX');
export const pageAtom = atom<number>(1);
export const searchAtom = atom<string>('');
export const selectedUidAtom = atom<number | null>(null);
export const checkedUidsAtom = atom<number[]>([]);
/** Remote images stay blocked until the reader asks, per message. */
export const showImagesAtom = atom<boolean>(false);
```

- [ ] **Step 2: Write the folder rail**

Create `client/apps/admin/src/app/shared/support/inbox/folder-rail.tsx`:

```tsx
'use client';

import cn from '@core/utils/class-names';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import {
  PiArchiveDuotone,
  PiFileDashedDuotone,
  PiPaperPlaneTiltDuotone,
  PiTrayDuotone,
  PiTrashDuotone,
  PiWarningOctagonDuotone,
} from 'react-icons/pi';
import { Badge, Select, Text } from 'rizzui';
import { accountIdAtom, checkedUidsAtom, folderAtom, pageAtom, selectedUidAtom } from './mail-state';
import { useMailAccounts, useMailFolders } from './use-mail';
import type { MailFolder } from './types';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '\\Sent': PiPaperPlaneTiltDuotone,
  '\\Drafts': PiFileDashedDuotone,
  '\\Archive': PiArchiveDuotone,
  '\\Junk': PiWarningOctagonDuotone,
  '\\Trash': PiTrashDuotone,
};

/** Inbox first, then the special-use folders, then everything else. */
function order(folders: MailFolder[]): MailFolder[] {
  const rank = (f: MailFolder) => {
    if (f.path === 'INBOX') return 0;
    const order = ['\\Sent', '\\Drafts', '\\Archive', '\\Junk', '\\Trash'];
    const index = f.specialUse ? order.indexOf(f.specialUse) : -1;
    return index === -1 ? 90 : 10 + index;
  };
  return [...folders].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export default function FolderRail({ className }: { className?: string }) {
  const [accountId, setAccountId] = useAtom(accountIdAtom);
  const [folder, setFolder] = useAtom(folderAtom);
  const [, setPage] = useAtom(pageAtom);
  const [, setSelectedUid] = useAtom(selectedUidAtom);
  const [, setChecked] = useAtom(checkedUidsAtom);

  const accounts = useMailAccounts();
  const folders = useMailFolders(accountId);

  // Pick the first available account once, rather than showing an empty rail.
  useEffect(() => {
    if (!accountId && accounts.data?.length) setAccountId(accounts.data[0].id);
  }, [accountId, accounts.data, setAccountId]);

  function openFolder(path: string) {
    setFolder(path);
    setPage(1);
    setSelectedUid(null);
    setChecked([]);
  }

  if (accounts.error) {
    return (
      <div className={cn(className, 'rounded-lg border border-red-200 bg-red-50 p-4')}>
        <Text className="text-sm text-red-700">{accounts.error}</Text>
      </div>
    );
  }

  const accountOptions = (accounts.data || []).map((a) => ({ value: a.id, label: a.address }));

  return (
    <div className={cn(className, 'flex flex-col gap-4')}>
      {accountOptions.length > 1 && (
        <Select
          size="sm"
          label="Mailbox"
          value={accountId ?? ''}
          options={accountOptions}
          onChange={(value: string) => {
            setAccountId(value);
            openFolder('INBOX');
          }}
          getOptionValue={(o) => o.value}
          displayValue={(v) => accountOptions.find((o) => o.value === v)?.label ?? ''}
        />
      )}

      {folders.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <Text className="text-sm text-red-700">{folders.error}</Text>
          <button className="mt-2 text-sm font-medium underline" onClick={folders.reload}>
            Retry
          </button>
        </div>
      )}

      <nav className="flex flex-col gap-0.5">
        {order(folders.data || []).map((f) => {
          const Icon = (f.specialUse && ICONS[f.specialUse]) || PiTrayDuotone;
          const active = f.path === folder;
          return (
            <button
              key={f.path}
              onClick={() => openFolder(f.path)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition',
                active ? 'bg-primary-lighter font-semibold text-primary-dark' : 'hover:bg-gray-100'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              {f.unseen > 0 && (
                <Badge size="sm" className="bg-primary text-white">
                  {f.unseen}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the message list**

Replace the entire contents of `client/apps/admin/src/app/shared/support/inbox/message-list.tsx`:

```tsx
'use client';

import { useMedia } from '@core/hooks/use-media';
import { LineGroup, Skeleton } from '@core/ui/skeleton';
import cn from '@core/utils/class-names';
import { getRelativeTime } from '@core/utils/get-relative-time';
import rangeMap from '@core/utils/range-map';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PiArchiveDuotone, PiMagnifyingGlass, PiPaperclipLight, PiTrashDuotone } from 'react-icons/pi';
import { ActionIcon, Badge, Button, Checkbox, Empty, Input, Text, Title } from 'rizzui';
import { routes } from '@/config/routes';
import * as api from './api';
import {
  accountIdAtom,
  checkedUidsAtom,
  folderAtom,
  pageAtom,
  searchAtom,
  selectedUidAtom,
} from './mail-state';
import { useMailFolders, useMailMessages, useMailToken } from './use-mail';
import type { MailEnvelope } from './types';

/** Mobile deep-link id: base64url("<folder>|<uid>"), decoded by the [id] page. */
export function encodeMessageId(folder: string, uid: number): string {
  return Buffer.from(`${folder}|${uid}`).toString('base64url');
}

export function decodeMessageId(id: string): { folder: string; uid: number } | null {
  try {
    const [folder, uid] = Buffer.from(id, 'base64url').toString('utf8').split('|');
    const parsed = parseInt(uid, 10);
    if (!folder || !Number.isFinite(parsed)) return null;
    return { folder, uid: parsed };
  } catch {
    return null;
  }
}

function MessageItem({ message }: { message: MailEnvelope }) {
  const router = useRouter();
  const isMobile = useMedia('(max-width: 1023px)', false);
  const [selectedUid, setSelectedUid] = useAtom(selectedUidAtom);
  const [checked, setChecked] = useAtom(checkedUidsAtom);

  const isActive = selectedUid === message.uid;
  const isChecked = checked.includes(message.uid);

  function toggleCheck() {
    setChecked(
      isChecked ? checked.filter((uid) => uid !== message.uid) : [...checked, message.uid]
    );
  }

  function open() {
    setSelectedUid(message.uid);
    if (isMobile) router.push(routes.support.messageDetails(encodeMessageId(message.folder, message.uid)));
  }

  return (
    <div
      className={cn(
        'grid cursor-pointer grid-cols-[24px_1fr] items-start gap-3 border-t border-muted p-4',
        isActive && 'border-t-2 border-t-primary dark:bg-gray-100/70',
        !message.seen && 'bg-primary-lighter/20'
      )}
    >
      <Checkbox checked={isChecked} onChange={toggleCheck} aria-label="Select message" />
      <div onClick={open}>
        <div className="flex items-baseline justify-between gap-2">
          <Text className={cn('truncate text-sm', !message.seen && 'font-semibold')}>
            {message.from.name || message.from.address || 'Unknown sender'}
          </Text>
          <span className="shrink-0 text-xs text-gray-500">
            {message.date ? getRelativeTime(new Date(message.date)) : ''}
          </span>
        </div>
        <Title as="h4" className="mt-0.5 flex items-center gap-2">
          <span className={cn('truncate text-sm', !message.seen && 'font-semibold')}>
            {message.subject}
          </span>
          {message.hasAttachments && <PiPaperclipLight className="h-4 w-4 shrink-0 text-gray-500" />}
          {!message.seen && <Badge renderAsDot className="h-2 w-2 shrink-0 bg-primary" />}
        </Title>
        {message.preview && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">{message.preview}</p>
        )}
      </div>
    </div>
  );
}

export default function MessageList({ className }: { className?: string }) {
  const token = useMailToken();
  const [accountId] = useAtom(accountIdAtom);
  const [folder] = useAtom(folderAtom);
  const [page, setPage] = useAtom(pageAtom);
  const [search, setSearch] = useAtom(searchAtom);
  const [checked, setChecked] = useAtom(checkedUidsAtom);
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);

  const messages = useMailMessages(accountId, { folder, page, search });
  const folders = useMailFolders(accountId);
  // Folder names vary by server (INBOX.Archive here, "Archive" elsewhere), so
  // the archive target is always resolved from its SPECIAL-USE flag.
  const archivePath = folders.data?.find((f) => f.specialUse === '\\Archive')?.path ?? null;

  const items = messages.data?.items ?? [];
  const total = messages.data?.total ?? 0;
  const limit = messages.data?.limit ?? 25;
  const pages = Math.max(1, Math.ceil(total / limit));

  async function runBulk(action: 'archive' | 'delete') {
    if (!token || !accountId || !checked.length) return;
    setBusy(true);
    try {
      if (action === 'delete') {
        await api.deleteMessages(token, accountId, folder, checked);
      } else {
        if (!archivePath) throw new Error('This mailbox has no Archive folder');
        await api.moveMessages(token, accountId, { folder, uids: checked, to: archivePath });
      }
      setChecked([]);
      messages.reload();
    } catch (err) {
      // Surfaced inline rather than swallowed: a failed bulk action that looks
      // like it worked is worse than one that says it did not.
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(className, 'flex flex-col gap-4')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(term.trim());
          setPage(1);
        }}
      >
        <Input
          type="search"
          placeholder="Search this folder"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          prefix={<PiMagnifyingGlass className="h-4 w-4" />}
          clearable
          onClear={() => {
            setTerm('');
            setSearch('');
            setPage(1);
          }}
        />
      </form>

      {checked.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
          <Text className="text-sm">{checked.length} selected</Text>
          <ActionIcon
            size="sm"
            variant="text"
            onClick={() => runBulk('archive')}
            disabled={busy || !archivePath}
            title="Archive"
          >
            <PiArchiveDuotone className="h-4 w-4" />
          </ActionIcon>
          <ActionIcon size="sm" variant="text" onClick={() => runBulk('delete')} disabled={busy}>
            <PiTrashDuotone className="h-4 w-4" />
          </ActionIcon>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-muted">
        <div className="custom-scrollbar max-h-[calc(100dvh-320px)] overflow-y-auto scroll-smooth">
          {messages.loading && (
            <div className="grid gap-4">
              {rangeMap(5, (i) => (
                <MessageLoader key={i} />
              ))}
            </div>
          )}

          {/* An error is its own state. It must never look like an empty folder. */}
          {!messages.loading && messages.error && (
            <div className="p-6 text-center">
              <Text className="text-sm font-medium text-red-700">{messages.error}</Text>
              <Button size="sm" variant="outline" className="mt-3" onClick={messages.reload}>
                Retry
              </Button>
            </div>
          )}

          {!messages.loading && !messages.error && items.length === 0 && (
            <Empty className="py-10" text={search ? 'No messages match that search' : 'This folder is empty'} />
          )}

          {!messages.loading &&
            !messages.error &&
            items.map((message) => <MessageItem key={message.uid} message={message} />)}
        </div>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Text className="text-sm text-gray-500">
            Page {page} of {pages}
          </Text>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export function MessageLoader() {
  return (
    <div className="grid gap-3 border-t border-muted p-5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="ml-auto h-3 w-16 rounded" />
      </div>
      <LineGroup columns={6} className="grid-cols-6 gap-1.5" skeletonClassName="h-2" />
      <LineGroup columns={4} className="grid-cols-4 gap-1.5" skeletonClassName="h-2" />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit 2>&1 | grep "support/inbox"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/support/inbox/
git commit -m "feat(inbox): real folder rail and IMAP-backed message list"
```

---

### Task 9: Reading pane

**Files:**
- Create: `client/apps/admin/src/app/shared/support/inbox/message-view.tsx`
- Delete: `client/apps/admin/src/app/shared/support/inbox/message-details.tsx`
- Delete: `client/apps/admin/src/app/shared/support/inbox/message-body.tsx`

**Interfaces:**
- Consumes: `useMailMessage` (Task 7), `mail-state` atoms (Task 8), `api.attachmentUrl`.
- Produces:
  - `type ReplyMode = 'reply' | 'replyAll' | 'forward'`
  - `<MessageView className?: string onCompose: (message: MailMessage, mode: ReplyMode) => void />` (default export)

- [ ] **Step 1: Write the reading pane**

Create `client/apps/admin/src/app/shared/support/inbox/message-view.tsx`:

```tsx
'use client';

import cn from '@core/utils/class-names';
import { useAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import {
  PiArrowBendDoubleUpLeftDuotone,
  PiArrowBendUpLeftDuotone,
  PiArrowBendUpRightDuotone,
  PiDownloadSimpleDuotone,
  PiImageDuotone,
} from 'react-icons/pi';
import { Button, Empty, Text, Title } from 'rizzui';
import * as api from './api';
import { accountIdAtom, folderAtom, selectedUidAtom, showImagesAtom } from './mail-state';
import { useMailMessage } from './use-mail';
import type { MailMessage } from './types';

export type ReplyMode = 'reply' | 'replyAll' | 'forward';

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Message bodies render inside a sandboxed iframe.
 *
 * The sandbox attribute omits allow-scripts and allow-same-origin, so a hostile
 * body cannot run JavaScript, read the admin session, or reach the parent DOM —
 * even if the server-side sanitizer were bypassed. Height is synced to content
 * so the frame does not scroll independently.
 */
function SandboxedBody({ html }: { html: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);

  const document = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin:0; padding:0; font-family: system-ui, -apple-system, sans-serif;
         font-size:14px; line-height:1.6; color:#111; word-break:break-word; }
  img { max-width:100%; height:auto; }
  img[data-blocked-remote] { display:inline-block; width:1px; height:1px; }
  table { max-width:100%; }
  blockquote { margin:0 0 0 12px; padding-left:12px; border-left:2px solid #ddd; color:#555; }
</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const sync = () => {
      const body = frame.contentDocument?.body;
      if (body) setHeight(Math.min(4000, body.scrollHeight + 24));
    };
    frame.addEventListener('load', sync);
    const timer = setTimeout(sync, 300);
    return () => {
      frame.removeEventListener('load', sync);
      clearTimeout(timer);
    };
  }, [html]);

  return (
    <iframe
      ref={frameRef}
      title="Message body"
      srcDoc={document}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      className="w-full border-0"
      style={{ height }}
    />
  );
}

interface Props {
  className?: string;
  onCompose: (message: MailMessage, mode: ReplyMode) => void;
}

export default function MessageView({ className, onCompose }: Props) {
  const [accountId] = useAtom(accountIdAtom);
  const [folder] = useAtom(folderAtom);
  const [uid] = useAtom(selectedUidAtom);
  const [showImages, setShowImages] = useAtom(showImagesAtom);

  const message = useMailMessage(accountId, folder, uid, showImages);

  // Each newly opened message re-blocks remote images. Consent is per message.
  useEffect(() => setShowImages(false), [uid, setShowImages]);

  if (!uid) {
    return (
      <div className={cn(className, 'rounded-lg border border-muted')}>
        <Empty className="py-20" text="Select a message to read it" />
      </div>
    );
  }

  if (message.error) {
    return (
      <div className={cn(className, 'rounded-lg border border-red-200 bg-red-50 p-6')}>
        <Text className="text-sm font-medium text-red-700">{message.error}</Text>
        <Button size="sm" variant="outline" className="mt-3" onClick={message.reload}>
          Retry
        </Button>
      </div>
    );
  }

  if (message.loading || !message.data) {
    return (
      <div className={cn(className, 'rounded-lg border border-muted p-6')}>
        <Text className="text-sm text-gray-500">Loading message…</Text>
      </div>
    );
  }

  const m = message.data;
  const attachments = m.attachments.filter((a) => !a.isInline);

  return (
    <div className={cn(className, 'rounded-lg border border-muted')}>
      <header className="border-b border-muted p-5">
        <Title as="h3" className="text-lg font-semibold">
          {m.subject}
        </Title>
        <Text className="mt-1 text-sm text-gray-500">
          {m.from.name ? `${m.from.name} <${m.from.address}>` : m.from.address}
          {' → '}
          {m.to.map((t) => t.address).join(', ')}
        </Text>
        {m.date && (
          <Text className="mt-0.5 text-xs text-gray-500">{new Date(m.date).toLocaleString()}</Text>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onCompose(m, 'reply')}>
            <PiArrowBendUpLeftDuotone className="me-1.5 h-4 w-4" /> Reply
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCompose(m, 'replyAll')}>
            <PiArrowBendDoubleUpLeftDuotone className="me-1.5 h-4 w-4" /> Reply all
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCompose(m, 'forward')}>
            <PiArrowBendUpRightDuotone className="me-1.5 h-4 w-4" /> Forward
          </Button>
        </div>
      </header>

      {/* Loading remote images fires the sender's tracking pixel and hands over
          the reader's IP, so it stays an explicit, per-message choice. */}
      {m.blockedRemoteImages > 0 && !showImages && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
          <Text className="text-sm text-amber-900">
            <PiImageDuotone className="me-1.5 inline h-4 w-4" />
            {m.blockedRemoteImages} remote image{m.blockedRemoteImages > 1 ? 's' : ''} blocked to
            stop the sender tracking that you opened this.
          </Text>
          <Button size="sm" variant="text" onClick={() => setShowImages(true)}>
            Show images
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-muted px-5 py-3">
          {attachments.map((a) => (
            <a
              key={a.index}
              href={api.attachmentUrl(accountId as string, folder, m.uid, a.index)}
              download={a.filename}
              className="flex items-center gap-2 rounded-md border border-muted px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <PiDownloadSimpleDuotone className="h-4 w-4" />
              <span className="max-w-[200px] truncate">{a.filename}</span>
              <span className="text-xs text-gray-500">{formatSize(a.size)}</span>
            </a>
          ))}
        </div>
      )}

      <div className="p-5">
        <SandboxedBody html={m.html} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the superseded components**

```bash
cd /Users/mac/Documents/drinksharbour
rm client/apps/admin/src/app/shared/support/inbox/message-details.tsx
rm client/apps/admin/src/app/shared/support/inbox/message-body.tsx
```

- [ ] **Step 3: Verify the sandbox in a browser**

With the admin dev server running, open `/support/inbox`, select a message, and in DevTools confirm the body renders inside an `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">` with **no** `allow-scripts` and **no** `allow-same-origin`.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add -A client/apps/admin/src/app/shared/support/inbox/
git commit -m "feat(inbox): reading pane with sandboxed body and attachment downloads"
```

---

### Task 10: Compose drawer

**Files:**
- Create: `client/apps/admin/src/app/shared/support/inbox/compose-drawer.tsx`

**Interfaces:**
- Consumes: `api.sendMessage` (Task 7), `MailMessage` and `ComposeDraft` types, `accountIdAtom`.
- Produces: `<ComposeDrawer open seed onClose onSent />` where `seed` is `{ mode: 'new' } | { mode: ReplyMode; message: MailMessage }`.
- Exports `buildSeedDraft(seed, selfAddress) -> ComposeDraft` (pure).

- [ ] **Step 1: Write the compose drawer**

Create `client/apps/admin/src/app/shared/support/inbox/compose-drawer.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { PiPaperclipLight, PiXBold } from 'react-icons/pi';
import { ActionIcon, Button, Drawer, Input, Text, Title } from 'rizzui';
import * as api from './api';
import { accountIdAtom } from './mail-state';
import { useMailToken } from './use-mail';
import type { ComposeDraft, MailMessage } from './types';
import type { ReplyMode } from './message-view';

import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export type ComposeSeed = { mode: 'new' } | { mode: ReplyMode; message: MailMessage };

const withPrefix = (subject: string, prefix: string) =>
  new RegExp(`^${prefix}`, 'i').test(subject) ? subject : `${prefix} ${subject}`;

const quote = (m: MailMessage) =>
  `<br><br><blockquote>On ${m.date ? new Date(m.date).toLocaleString() : 'an earlier date'}, ${
    m.from.name || m.from.address
  } wrote:<br>${m.html}</blockquote>`;

/**
 * Seeds a draft from the message being answered.
 *
 * Reply-all keeps every other recipient but drops our own address, so the
 * mailbox does not end up replying to itself. Threading headers ride along so
 * the reply lands in the right conversation in the recipient's client.
 */
export function buildSeedDraft(seed: ComposeSeed, selfAddress: string): ComposeDraft {
  const empty: ComposeDraft = { to: '', cc: '', bcc: '', subject: '', html: '', files: [] };
  if (seed.mode === 'new') return empty;

  const m = seed.message;
  const threading = {
    replyToMessageId: m.messageId,
    replyReferences: m.references,
  };

  if (seed.mode === 'forward') {
    return {
      ...empty,
      subject: withPrefix(m.subject, 'Fwd:'),
      html: quote(m),
    };
  }

  const others = [...m.to, ...m.cc]
    .map((a) => a.address)
    .filter((a) => a && a.toLowerCase() !== selfAddress.toLowerCase());

  return {
    ...empty,
    ...threading,
    to: m.from.address,
    cc: seed.mode === 'replyAll' ? Array.from(new Set(others)).join(', ') : '',
    subject: withPrefix(m.subject, 'Re:'),
    html: quote(m),
  };
}

interface Props {
  open: boolean;
  seed: ComposeSeed;
  selfAddress: string;
  onClose: () => void;
  onSent: () => void;
}

export default function ComposeDrawer({ open, seed, selfAddress, onClose, onSent }: Props) {
  const token = useMailToken();
  const [accountId] = useAtom(accountIdAtom);
  const initial = useMemo(() => buildSeedDraft(seed, selfAddress), [seed, selfAddress]);

  const [draft, setDraft] = useState<ComposeDraft>(initial);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  const totalBytes = draft.files.reduce((sum, f) => sum + f.size, 0);
  const overLimit = totalBytes > 15 * 1024 * 1024;

  async function submit() {
    if (!token || !accountId) return;
    setSending(true);
    setError(null);
    try {
      await api.sendMessage(token, accountId, draft);
      onSent();
      onClose();
    } catch (err) {
      // The drawer stays open with the draft intact. A send that failed must
      // never look like one that succeeded, and the text must not be lost.
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const set = (patch: Partial<ComposeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Drawer isOpen={open} onClose={onClose} size="lg" placement="right">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-muted p-5">
          <Title as="h3" className="text-lg font-semibold">
            {seed.mode === 'new' ? 'New message' : seed.mode === 'forward' ? 'Forward' : 'Reply'}
          </Title>
          <ActionIcon variant="text" onClick={onClose} aria-label="Close">
            <PiXBold className="h-4 w-4" />
          </ActionIcon>
        </header>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          <Input label="To" value={draft.to} onChange={(e) => set({ to: e.target.value })} placeholder="name@example.com, other@example.com" />
          <Input label="Cc" value={draft.cc} onChange={(e) => set({ cc: e.target.value })} />
          <Input label="Bcc" value={draft.bcc} onChange={(e) => set({ bcc: e.target.value })} />
          <Input label="Subject" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />

          <div>
            <Text className="mb-1.5 text-sm font-medium">Message</Text>
            <ReactQuill theme="snow" value={draft.html} onChange={(html: string) => set({ html })} />
          </div>

          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-muted px-3 py-2 text-sm hover:bg-gray-50">
              <PiPaperclipLight className="h-4 w-4" />
              Attach files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => set({ files: [...draft.files, ...Array.from(e.target.files || [])] })}
              />
            </label>

            {draft.files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {draft.files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded border border-muted px-3 py-1.5 text-sm">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="text-gray-500 hover:text-red-600"
                      onClick={() => set({ files: draft.files.filter((_, index) => index !== i) })}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {overLimit && (
              <Text className="mt-2 text-sm text-red-700">
                Attachments total {(totalBytes / 1024 / 1024).toFixed(1)} MB — the limit is 15 MB.
              </Text>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <Text className="text-sm font-medium text-red-700">Not sent: {error}</Text>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-muted p-5">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={sending} disabled={sending || overLimit || !draft.to.trim()}>
            Send
          </Button>
        </footer>
      </div>
    </Drawer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit 2>&1 | grep "support/inbox"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/support/inbox/compose-drawer.tsx
git commit -m "feat(inbox): compose drawer with rich text, attachments and reply threading"
```

---

### Task 11: Wire the pages, remove the demo data, smoke test

**Files:**
- Rewrite: `client/apps/admin/src/app/shared/support/inbox/index.tsx`
- Modify: `client/apps/admin/src/app/(hydrogen)/support/inbox/page.tsx`
- Modify: `client/apps/admin/src/app/(hydrogen)/support/inbox/[id]/page.tsx`
- Delete: `client/apps/admin/src/data/support-inbox.ts`
- Delete: `client/apps/admin/src/app/shared/support/inbox/inbox-tabs.tsx`
- Delete: `client/apps/admin/src/app/shared/support/inbox/action-dropdown.tsx`
- Delete: `client/apps/admin/src/app/shared/support/inbox/create-folder.tsx`

**Interfaces:**
- Consumes: every component from Tasks 8–10.
- Produces: the assembled `<SupportInbox />` three-pane view.

- [ ] **Step 1: Confirm nothing else depends on the demo data**

Run:

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin/src && \
  grep -rn "data/support-inbox\|inbox-tabs\|action-dropdown\|inbox/create-folder" . || echo "NO REMAINING IMPORTS"
```

Expected: hits only in the files this task rewrites or deletes. If any other file imports them, stop and report — the delete list is wrong.

- [ ] **Step 2: Rewrite the inbox shell**

Replace the entire contents of `client/apps/admin/src/app/shared/support/inbox/index.tsx`:

```tsx
'use client';

import { useAtom } from 'jotai';
import { useState } from 'react';
import { PiPlusBold } from 'react-icons/pi';
import { Button } from 'rizzui';
import ComposeDrawer, { type ComposeSeed } from './compose-drawer';
import FolderRail from './folder-rail';
import MessageList from './message-list';
import MessageView, { type ReplyMode } from './message-view';
import { accountIdAtom } from './mail-state';
import { useMailAccounts } from './use-mail';
import type { MailMessage } from './types';

export default function SupportInbox() {
  const [accountId] = useAtom(accountIdAtom);
  const accounts = useMailAccounts();
  const [composeOpen, setComposeOpen] = useState(false);
  const [seed, setSeed] = useState<ComposeSeed>({ mode: 'new' });
  const [listNonce, setListNonce] = useState(0);

  const selfAddress =
    accounts.data?.find((a) => a.id === accountId)?.address ?? '';

  function openCompose(message: MailMessage, mode: ReplyMode) {
    setSeed({ mode, message });
    setComposeOpen(true);
  }

  return (
    <div className="@container">
      <div className="mb-5 flex justify-end">
        <Button
          onClick={() => {
            setSeed({ mode: 'new' });
            setComposeOpen(true);
          }}
        >
          <PiPlusBold className="me-1.5 h-4 w-4" /> Compose
        </Button>
      </div>

      <div className="items-start gap-6 @4xl:grid @4xl:grid-cols-12">
        <FolderRail className="@4xl:col-span-2" />
        <MessageList key={listNonce} className="@4xl:col-span-4" />
        <MessageView className="hidden @4xl:col-span-6 @4xl:block" onCompose={openCompose} />
      </div>

      <ComposeDrawer
        open={composeOpen}
        seed={seed}
        selfAddress={selfAddress}
        onClose={() => setComposeOpen(false)}
        onSent={() => setListNonce((n) => n + 1)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update the inbox page**

Replace `client/apps/admin/src/app/(hydrogen)/support/inbox/page.tsx`:

```tsx
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import SupportInbox from '@/app/shared/support/inbox';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Support Inbox'),
};

const pageHeader = {
  title: 'Support Inbox',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'Home' },
    { href: routes.support.dashboard, name: 'Support' },
    { name: 'Inbox' },
  ],
};

export default function SupportInboxPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <SupportInbox />
    </>
  );
}
```

- [ ] **Step 4: Update the mobile detail page**

Replace `client/apps/admin/src/app/(hydrogen)/support/inbox/[id]/page.tsx`:

```tsx
import { Metadata } from 'next';
import { metaObject } from '@/config/site.config';
import BackButton from '@/app/shared/support/inbox/back-button';
import MessageDetailView from '@/app/shared/support/inbox/message-detail-page';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return metaObject('Message');
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <div className="mt-5 lg:mt-9">
      <BackButton />
      <MessageDetailView id={id} />
    </div>
  );
}
```

- [ ] **Step 5: Add the mobile detail client component**

Create `client/apps/admin/src/app/shared/support/inbox/message-detail-page.tsx`:

```tsx
'use client';

import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import ComposeDrawer, { type ComposeSeed } from './compose-drawer';
import MessageView, { type ReplyMode } from './message-view';
import { accountIdAtom, folderAtom, selectedUidAtom } from './mail-state';
import { decodeMessageId } from './message-list';
import { useMailAccounts } from './use-mail';
import type { MailMessage } from './types';

/** Restores folder + uid from the deep-link id so a shared URL opens the mail. */
export default function MessageDetailView({ id }: { id: string }) {
  const [accountId] = useAtom(accountIdAtom);
  const [, setFolder] = useAtom(folderAtom);
  const [, setUid] = useAtom(selectedUidAtom);
  const accounts = useMailAccounts();

  const [composeOpen, setComposeOpen] = useState(false);
  const [seed, setSeed] = useState<ComposeSeed>({ mode: 'new' });

  useEffect(() => {
    const decoded = decodeMessageId(id);
    if (decoded) {
      setFolder(decoded.folder);
      setUid(decoded.uid);
    }
  }, [id, setFolder, setUid]);

  function openCompose(message: MailMessage, mode: ReplyMode) {
    setSeed({ mode, message });
    setComposeOpen(true);
  }

  return (
    <>
      <MessageView className="mt-4" onCompose={openCompose} />
      <ComposeDrawer
        open={composeOpen}
        seed={seed}
        selfAddress={accounts.data?.find((a) => a.id === accountId)?.address ?? ''}
        onClose={() => setComposeOpen(false)}
        onSent={() => setComposeOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 6: Delete the demo data and dead components**

```bash
cd /Users/mac/Documents/drinksharbour
rm client/apps/admin/src/data/support-inbox.ts
rm client/apps/admin/src/app/shared/support/inbox/inbox-tabs.tsx
rm client/apps/admin/src/app/shared/support/inbox/action-dropdown.tsx
rm client/apps/admin/src/app/shared/support/inbox/create-folder.tsx
```

- [ ] **Step 7: Typecheck and build**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit 2>&1 | grep "support/inbox\|data/support-inbox"`
Expected: no output.

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit 2>&1 | grep -c "^src/"`
Expected: no higher than the ~546 baseline.

- [ ] **Step 8: Browser smoke test against the real mailbox**

Start the backend (`cd server && npm run dev`) and the admin (`cd client/apps/admin && npm run dev`), sign in as the super admin, and open `/support/inbox`. Verify each of these:

1. The folder rail lists the seven real folders with unread counts.
2. The message list shows real subjects and senders from `INBOX`.
3. Opening a message renders its body; DevTools shows the body inside an iframe **without** `allow-scripts` or `allow-same-origin`.
4. A message with remote images shows the "images blocked" banner; **Show images** loads them.
5. A message with an attachment offers a download link and the downloaded file opens correctly.
6. Search returns a narrower set, and clearing it restores the full list.
7. **Reply** to a message you control, send it, and confirm: it arrives, it appears in `INBOX.Sent`, and the recipient's client threads it under the original.
8. **Compose** a new message with an attachment to yourself; confirm it arrives with the file intact.
9. Archive a message and confirm it leaves `INBOX` and appears in `INBOX.Archive` in Roundcube.
10. Delete a message from `INBOX` and confirm it lands in `INBOX.Trash` — **not** destroyed.
11. Stop the backend, reload the inbox, and confirm you get a visible error with a Retry button — **not** an empty inbox.

- [ ] **Step 9: Run the full server suite**

Run: `cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: 774 pass / 3 fail (the known pre-existing failures only).

- [ ] **Step 10: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add -A client/apps/admin/src/app/shared/support/inbox/ \
           "client/apps/admin/src/app/(hydrogen)/support/inbox/" \
           client/apps/admin/src/data/
git commit -m "feat(inbox): wire the real mail client and remove the demo inbox data"
```

---

## Deferred to Stage 2

Not in this plan; spec'd in the design document:

- `tenant.mailSettings` subdoc and per-tenant account resolution (the `scope: 'tenant'` branch of `mailAccount.service.listAccounts`).
- `server/utils/crypto.js` — AES-256-GCM keyed by `MAIL_ENCRYPTION_KEY`.
- Tenant Settings "Mail" section with a Test Connection button that verifies IMAP login and SMTP `verify()` before saving.
- Draft editing (this plan appends new drafts but does not reopen them).
- Cross-account search (requires the Mongo envelope index the design deliberately declined).
