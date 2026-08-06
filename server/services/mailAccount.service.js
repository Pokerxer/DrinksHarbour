// services/mailAccount.service.js
//
// The single place mail credentials are read. Every other module receives an
// already-resolved account object and never sees an env var or a database row.
//
// `accountId` is an opaque handle the client echoes back. It is re-validated
// against the caller on every request, so a client cannot pivot to a mailbox
// it was not offered — the same rule requireOwnTenant enforces for the
// tenant-owned modules. There is deliberately no way to pass a host, username
// or password in from the outside of this module.
//
// Accounts come from two sources merged into one list:
//   - env:  SENDER_EMAIL_ADDRESS / MAIL_ACCOUNT_2..10_* — read-only from the
//           app's point of view, managed by whoever owns the deployment.
//   - db:   MailAccount documents added through the admin UI, passwords stored
//           encrypted (utils/mailCrypto).

const mongoose = require('mongoose');
const { ForbiddenError, ValidationError, NotFoundError } = require('../utils/errors');
const { encrypt, decrypt } = require('../utils/mailCrypto');

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
  if (explicit != null && explicit !== '') return String(explicit) === 'true';
  return port === implicitPort;
}

function buildAccount({ id, source, address, displayName, user, password, imapHost, imapPort, smtpHost, smtpPort, imapSecure, smtpSecure }) {
  const resolvedImapPort = num(imapPort, 993);
  const resolvedSmtpPort = num(smtpPort, 465);
  return {
    id: id || `${SCOPE_PLATFORM}:${address}`,
    source: source || 'env',
    address,
    displayName: displayName || address,
    scope: SCOPE_PLATFORM,
    imap: {
      host: imapHost,
      port: resolvedImapPort,
      secure: isSecure(imapSecure, resolvedImapPort, 993),
      auth: { user: user || address, pass: password },
    },
    smtp: {
      host: smtpHost,
      port: resolvedSmtpPort,
      secure: isSecure(smtpSecure, resolvedSmtpPort, 465),
      auth: { user: user || address, pass: password },
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

/** Lazy so requiring this module never touches mongoose model registration order. */
const MailAccount = () => require('../models/MailAccount');

const dbReady = () => mongoose.connection && mongoose.connection.readyState === 1;

function fromDoc(doc, password) {
  return buildAccount({
    id: `db:${doc._id}`,
    source: 'db',
    address: doc.address,
    displayName: doc.displayName,
    user: doc.username,
    password,
    imapHost: doc.imapHost,
    imapPort: doc.imapPort,
    imapSecure: doc.imapSecure,
    smtpHost: doc.smtpHost,
    smtpPort: doc.smtpPort,
    smtpSecure: doc.smtpSecure,
  });
}

/**
 * Database-defined accounts, resolved to full credentials.
 *
 * No connection ⇒ empty list, not an error: the env accounts must keep working
 * while the database is down, and the tests exercise this module without a
 * database at all.
 */
async function dbAccounts() {
  if (!dbReady()) return [];
  const docs = await MailAccount().find().select('+passwordEnc').lean();
  return docs.map((doc) => fromDoc(doc, decrypt(doc.passwordEnc)));
}

/** Roles allowed to use the platform mailboxes. */
const PLATFORM_MAIL_ROLES = ['super_admin', 'admin'];
/** Managing credentials is tighter than using them. */
const MANAGE_ROLES = ['super_admin'];

async function allAccounts() {
  return [...platformAccounts(), ...(await dbAccounts())];
}

/** Every account the caller may use, with credentials stripped. */
async function listAccounts(user) {
  if (!user) return [];
  const permitted = PLATFORM_MAIL_ROLES.includes(user.role) ? await allAccounts() : [];
  return permitted.map(({ id, source, address, displayName, scope }) => ({
    id,
    source,
    address,
    displayName,
    scope,
  }));
}

/**
 * Resolve an opaque accountId to full credentials, or refuse.
 *
 * The lookup runs against the caller's own permitted set, so an id belonging
 * to someone else's mailbox is indistinguishable from one that does not
 * exist. Both are refused before any connection is opened.
 */
async function resolveAccount(user, accountId) {
  const permitted = PLATFORM_MAIL_ROLES.includes(user?.role) ? await allAccounts() : [];
  const account = accountId
    ? permitted.find((a) => a.id === accountId)
    : undefined;
  if (!account) {
    throw new ForbiddenError('That mail account is not available to you');
  }
  return account;
}

/**
 * The gate for everything the mail module exposes that is not itself an account.
 *
 * listAccounts answers an empty list for an unpermitted caller because "you have
 * no mailboxes" is the honest answer there. A lookup endpoint has no such
 * reading — an empty customer record would be a lie — so it refuses instead,
 * against the same role list, from the same module. Keeping the list in one
 * place is the point: a second copy is how the two drift apart.
 */
const assertMailReader = (user) => {
  if (!user || !PLATFORM_MAIL_ROLES.includes(user.role)) {
    throw new ForbiddenError('Mail is not available to you');
  }
};

const requireManager = (user) => {
  if (!user || !MANAGE_ROLES.includes(user.role)) {
    throw new ForbiddenError('Only a super admin can manage mail accounts');
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const portOrNull = (value, label) => {
  if (value == null || value === '') return null;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    throw new ValidationError(`${label} must be a port number between 1 and 65535`);
  }
  return parsed;
};

/**
 * Validates a create payload and shapes it into a *candidate* account the
 * caller can try to log in with BEFORE anything is persisted. Hosts default to
 * the deployment's own mail server so adding a second mailbox on the same host
 * only needs an address and a password.
 */
function buildCandidate(user, payload = {}) {
  requireManager(user);

  const address = String(payload.address || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!EMAIL_RE.test(address)) {
    throw new ValidationError('A valid email address is required');
  }
  if (!password) throw new ValidationError('A password is required');

  const defaults = {
    imapHost: process.env.MAIL_IMAP_HOST || process.env.MAIL_HOST,
    smtpHost: process.env.MAIL_HOST,
  };
  const imapHost = String(payload.imapHost || defaults.imapHost || '').trim();
  const smtpHost = String(payload.smtpHost || defaults.smtpHost || '').trim();
  if (!imapHost || !smtpHost) {
    throw new ValidationError(
      'IMAP and SMTP hosts are required (no server default is configured)'
    );
  }

  const fields = {
    address,
    displayName: String(payload.displayName || '').trim(),
    username: String(payload.username || '').trim(),
    imapHost,
    imapPort: portOrNull(payload.imapPort, 'IMAP port') ?? 993,
    smtpHost,
    smtpPort: portOrNull(payload.smtpPort, 'SMTP port') ?? 465,
    imapSecure: null,
    smtpSecure: null,
  };

  return {
    fields,
    password,
    // The id is a throwaway: it only namespaces the connection-pool slot the
    // verification login uses, and the caller invalidates it afterwards.
    account: buildAccount({
      id: `verify:${address}`,
      source: 'db',
      address,
      displayName: fields.displayName,
      user: fields.username,
      password,
      imapHost: fields.imapHost,
      imapPort: fields.imapPort,
      smtpHost: fields.smtpHost,
      smtpPort: fields.smtpPort,
    }),
  };
}

/**
 * Persists a candidate that already passed verification. Split from
 * buildCandidate so the IMAP login attempt stays in the controller — this
 * module never opens network connections.
 */
async function createAccount(user, candidate) {
  requireManager(user);
  if (!dbReady()) {
    throw new ValidationError('The database is not available, try again shortly');
  }

  const taken = (await allAccounts()).some(
    (a) => a.address.toLowerCase() === candidate.fields.address
  );
  if (taken) {
    throw new ValidationError('A mail account with that address already exists');
  }

  const doc = await MailAccount().create({
    ...candidate.fields,
    passwordEnc: encrypt(candidate.password),
    createdBy: user._id,
  });
  return { id: `db:${doc._id}`, source: 'db', address: doc.address, displayName: doc.displayName || doc.address, scope: SCOPE_PLATFORM };
}

/**
 * Removes a database-defined account. Env-defined accounts are refused with an
 * explanation — they live in the deployment config, not in this app.
 */
async function deleteAccount(user, accountId) {
  requireManager(user);
  const id = String(accountId || '');
  if (!id.startsWith('db:')) {
    throw new ValidationError(
      'That account comes from the server environment and cannot be removed here'
    );
  }
  if (!dbReady()) {
    throw new ValidationError('The database is not available, try again shortly');
  }
  const mongoId = id.slice(3);
  if (!mongoose.Types.ObjectId.isValid(mongoId)) {
    throw new NotFoundError('That mail account does not exist');
  }
  const doc = await MailAccount().findByIdAndDelete(mongoId);
  if (!doc) throw new NotFoundError('That mail account does not exist');
  return { id };
}

module.exports = {
  listAccounts,
  resolveAccount,
  // Full credentials with no caller to check, for the server acting on its own
  // behalf (the chatbot escalation, which has no authenticated user). Never
  // reachable from a request principal — every request path goes through
  // resolveAccount, which re-checks the caller against the requested account.
  allAccounts,
  assertMailReader,
  buildCandidate,
  createAccount,
  deleteAccount,
  __resetCache,
};
