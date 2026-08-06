
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
const body = require('../services/mailBody.service');
const sender = require('../services/mailSend.service');
const context = require('../services/mailContext.service');

/**
 * Coerces one query-string value to a string, treating anything else as absent.
 *
 * Express's `qs` parser turns `?folder[]=a&folder[]=b` into an array and
 * `?folder[x]=y` into an object. Passing either straight through reaches
 * ImapFlow as a mailbox path, and `.trim()` on an array throws a TypeError that
 * surfaces as an opaque 500. Later tasks add more query params to this file —
 * route them through here too.
 */
const str = (value) => (typeof value === 'string' ? value : '');

/**
 * Parses a whole-number route parameter, or null.
 *
 * Not parseInt: it happily reads "12abc" as 12 and "-1" as -1, so a malformed
 * reference would silently address some *other* message instead of being
 * rejected. The length bound keeps the result inside the safe-integer range.
 */
const wholeNumber = (value) => (/^\d{1,15}$/.test(String(value ?? '')) ? Number(value) : null);

/**
 * Turns a mail-server failure into an HTTP error that names what broke.
 *
 * Every branch passes expose=true. Without it the global error handler masks
 * all 5xx messages as 'Internal server error' in production (NODE_ENV is unset
 * on the deployed backend), so "Could not reach the mail server" would reach
 * the operator as an opaque 500 — and because NODE_ENV *is* 'development'
 * locally, the masking is invisible in a local smoke test. These messages name
 * an upstream and carry no internal detail, which is exactly what expose is
 * for. The generic branch deliberately does not interpolate the raw server
 * text; an unrecognised IMAP/SMTP error can quote the command that failed.
 */

/**
 * Fixed responses for the failures imap.service tags with an err.code.
 *
 * The 5xx entries all name an upstream and carry no internal detail, so they
 * pass expose=true (see AppError). The mutation failures are 502 rather than
 * 200-with-a-warning on purpose: imapflow resolves a rejected STORE / MOVE /
 * EXPUNGE to `false` instead of throwing, so if these did not become errors the
 * client would be told the change succeeded when nothing happened.
 */
const MAIL_ERROR_CODES = {
  EMSGTOOLARGE: [413, 'That message is too large to open in the browser'],
  EBADFLAG: [400, 'That flag cannot be changed from here'],
  EBADUID: [400, 'Invalid message id'],
  ENOFOLDER: [404, 'That folder does not exist on this account'],
  ESTOREFAILED: [502, 'The mail server would not change those flags'],
  ESENDREJECTED: [502, 'The mail server refused every recipient, so nothing was sent'],
  EAPPENDFAILED: [502, 'The mail server would not file that message'],
  ENODRAFTS: [404, 'This account has no Drafts folder to save into'],
  EMOVEFAILED: [502, 'The mail server would not move those messages'],
  ECOPYFAILED: [502, 'The mail server would not copy those messages, so none were deleted'],
  EDELETEFAILED: [502, 'The mail server would not remove those messages from the old folder'],
};

function mailError(err) {
  const message = String(err?.message || '');
  const mapped = MAIL_ERROR_CODES[err?.code];
  if (mapped) {
    const appError = new AppError(mapped[1], mapped[0], true);
    // A send the server refused outright has to name the addresses it refused,
    // or the operator is told "nothing was sent" with no way to find out why.
    // The global handler passes `details` through verbatim.
    if (Array.isArray(err.rejected) && err.rejected.length) {
      appError.details = { rejected: err.rejected };
    }
    return appError;
  }
  // ImapFlow reports a refused login as the literal message "Command failed"
  // with the real reason in structured fields, so matching on the message
  // alone routes every wrong password to the "unexpected error" fallback.
  if (
    err?.authenticationFailed ||
    /auth|credential|login|AUTHENTICATIONFAILED/i.test(
      `${message} ${err?.responseText || ''}`
    )
  ) {
    return new AppError(
      'The mail server rejected the login — check the email address and password',
      502,
      true
    );
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|socket/i.test(message)) {
    return new AppError('Could not reach the mail server', 504, true);
  }
  return new AppError('The mail server returned an unexpected error', 502, true);
}

/**
 * Runs a mail operation, translating transport failures. Never swallows.
 *
 * The raw error is logged before translation: mailError() deliberately narrows
 * it to a safe sentence for the response, and that sentence is all the global
 * handler will have to log. Losing the underlying IMAP/SMTP text would leave an
 * outage undiagnosable from the server console.
 */
async function attempt(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('[mail] transport failure:', err?.message || err);
    throw mailError(err);
  }
}

const getAccounts = asyncHandler(async (req, res) => {
  successResponse(res, await accounts.listAccounts(req.user), 'Mail accounts retrieved');
});

const createAccount = asyncHandler(async (req, res) => {
  const candidate = accounts.buildCandidate(req.user, req.body || {});
  // Prove the credentials before persisting them. A mailbox that cannot be
  // logged into must be refused at creation with the server's own error, not
  // saved and discovered broken on first use. The throwaway pool slot the
  // verification login occupies is dropped either way.
  try {
    await attempt(() => imap.listFolders(candidate.account));
  } finally {
    imap.invalidate(candidate.account.id);
  }
  const created = await accounts.createAccount(req.user, candidate);
  successResponse(res, created, 'Mail account added', 201);
});

const removeAccount = asyncHandler(async (req, res) => {
  const removed = await accounts.deleteAccount(req.user, req.params.accountId);
  // Close any pooled connection so the credentials leave memory too.
  imap.invalidate(req.params.accountId);
  successResponse(res, removed, 'Mail account removed');
});

/**
 * Who a sender is, as a customer. Not scoped to a mailbox — it answers about an
 * address, so there is no accountId to resolve and therefore no resolveAccount
 * call to carry the authorization. The role gate is made explicit instead,
 * against the same list listAccounts uses.
 */
const getCustomerContext = asyncHandler(async (req, res) => {
  accounts.assertMailReader(req.user);
  const result = await context.getCustomerContext(str(req.query.email), req.user?.tenant);
  successResponse(res, result, 'Customer context retrieved');
});

const getFolders = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const folders = await attempt(() => imap.listFolders(account));
  successResponse(res, folders, 'Folders retrieved');
});

/**
 * Reads the triage flags off a query string.
 *
 * Strictly `=== 'true'`. A query string carries no booleans, so `unread=false`
 * arrives as the *non-empty, therefore truthy* string "false" — anything looser
 * than an exact match would pin the inbox to a filter nobody asked for and make
 * the "All" tab unreachable. Express also hands back an array when a param is
 * repeated (`?unread=true&unread=x`), which fails the same check.
 */
const filtersFrom = (query = {}) => ({
  unread: query.unread === 'true',
  unanswered: query.unanswered === 'true',
});

const getMessages = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const folder = str(req.query.folder) || 'INBOX';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const search = str(req.query.search).trim();
  const { unread, unanswered } = filtersFrom(req.query);

  const result = await attempt(() =>
    imap.listMessages(account, { folder, page, limit, search, unread, unanswered })
  );
  successResponse(res, result, 'Messages retrieved');
});

const getMessage = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const folder = str(req.query.folder) || 'INBOX';
  const uid = wholeNumber(req.params.uid);
  if (!uid) throw new ValidationError('Invalid message id');

  const source = await attempt(() => imap.fetchRaw(account, folder, uid));
  if (!source) {
    // The message moved or was deleted from another client. Say so — a blank
    // reading pane would read as a bug.
    throw new AppError('That message is no longer in this folder', 404);
  }

  const parsed = await body.parseMessage(source);
  const { html, blockedRemoteImages } = body.sanitizeBody(parsed.html, {
    allowRemoteImages: str(req.query.images) === 'true',
  });

  // Marking \Seen is a side effect of opening a message, not the read itself,
  // so it deliberately does NOT go through attempt(): a STORE that fails would
  // otherwise turn a message we have already fetched, parsed and sanitized into
  // a 502, and the reader would be shown nothing at all over a flag they never
  // asked about. Swallowing it silently is equally wrong — the list would keep
  // showing the message unread and the next open would look broken — so the
  // outcome is reported to the client as `markedSeen`.
  //
  // imap.markSeen returns false rather than throwing when the server declines
  // the STORE, and logs that case itself; this catch is only for a connect or
  // SELECT failure on the way there. `markedSeen: false` means the flag is not
  // set, and deliberately does not distinguish why — the client's only sensible
  // reaction either way is to leave the message showing as unread.
  let markedSeen = false;
  if (str(req.query.markSeen) !== 'false') {
    try {
      markedSeen = await imap.markSeen(account, folder, uid);
    } catch (err) {
      console.error('[mail] could not flag message as seen:', err?.message || err);
    }
  }

  successResponse(
    res,
    { ...parsed, uid, folder, html, blockedRemoteImages, markedSeen },
    'Message retrieved'
  );
});

const getAttachment = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const folder = str(req.query.folder) || 'INBOX';
  const uid = wholeNumber(req.params.uid);
  const index = wholeNumber(req.params.index);
  if (!uid || index === null) {
    throw new ValidationError('Invalid attachment reference');
  }

  const source = await attempt(() => imap.fetchRaw(account, folder, uid));
  if (!source) throw new AppError('That message is no longer in this folder', 404);

  const file = await body.extractAttachment(source, index);
  if (!file) throw new AppError('Attachment not found', 404);

  // Streamed straight through. Attachments are never written to disk or
  // uploaded to Cloudinary — nothing about this mailbox persists.
  //
  // Both the filename and the content type came from whoever sent the mail, so
  // the headers are rebuilt by attachmentHeaders() rather than echoed: raw ones
  // allow header injection through a CR/LF filename, a 500 from a non-ASCII
  // one, and active content typed back at this API's own origin.
  res.set(body.attachmentHeaders(file));
  res.send(file.content);
});

// ── mutations ───────────────────────────────────────────────────────────────

/**
 * The most messages one mutation may address.
 *
 * Unbounded, a single request could compile a uid list of any length into one
 * IMAP command — and on the delete path each entry is a message that gets
 * moved. A bound keeps one request from becoming an account-wide operation, and
 * 200 is well past what the list UI can select on a page.
 */
const MAX_UIDS = 200;

/** IMAP UIDs are 32-bit unsigned (RFC 3501 §2.3.1.1); above this is malformed. */
const MAX_UID = 4294967295;

/**
 * Reads a folder path from a request, defaulting only when it is absent.
 *
 * A present-but-non-string folder is rejected rather than defaulted. The read
 * handlers can afford `str()`'s silent fallback to INBOX; a mutation cannot,
 * because falling back would apply the change to a mailbox the caller never
 * named. `req.body` is JSON, so the value can be any type at all — an object, a
 * number, null — and Express's qs parser produces the same shapes from a query
 * string via `?folder[]=a` and `?folder[x]=y`.
 */
function folderFrom(value) {
  if (value === undefined || value === null || value === '') return 'INBOX';
  if (typeof value !== 'string') throw new ValidationError('Invalid folder');
  return value;
}

/**
 * Parses a uid list from a request body array or a comma-separated query value.
 *
 * A malformed entry fails the whole request; it is neither coerced nor skipped.
 * parseInt would read "12abc" as 12 and "-1" as -1, silently addressing some
 * *other* message — on a delete, a different message than the one the user
 * picked. Dropping the bad entry instead would quietly act on a subset of the
 * selection and still report success.
 */
function parseUids(input) {
  const raw = Array.isArray(input) ? input : str(input).split(',');
  const entries = raw
    .map((value) => (typeof value === 'string' ? value.trim() : value))
    .filter((value) => value !== '');

  if (!entries.length) throw new ValidationError('No messages selected');
  if (entries.length > MAX_UIDS) {
    throw new ValidationError(`Select at most ${MAX_UIDS} messages at a time`);
  }

  return entries.map((value) => {
    const uid = wholeNumber(value);
    // Rejects 0 as well: IMAP UIDs start at 1, so a 0 is malformed input, and
    // anything above 2^32-1 is not a UID at all (RFC 3501 §2.3.1.1). The
    // service re-checks both, but catching them here makes it a 400 the client
    // can act on rather than a 502 blamed on the mail server.
    if (!uid || uid > MAX_UID) throw new ValidationError('Invalid message id');
    return uid;
  });
}

/** Validates a flag list against the service's allowlist, as a 400. */
function parseFlags(input, label) {
  try {
    return imap.normalizeFlags(input, label);
  } catch (err) {
    // The service raises this on any flag outside SETTABLE_FLAGS — \Deleted
    // above all, which would otherwise let this endpoint mark mail for
    // destruction and bypass the trash-safe delete entirely.
    throw new ValidationError(err?.message || 'Unsupported flag');
  }
}

const setFlags = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const payload = req.body || {};
  const folder = folderFrom(payload.folder);
  const uids = parseUids(payload.uids);
  const add = parseFlags(payload.add, 'add');
  const remove = parseFlags(payload.remove, 'remove');
  if (!add.length && !remove.length) throw new ValidationError('No flag changes requested');

  await attempt(() => imap.setFlags(account, folder, uids, { add, remove }));
  successResponse(res, { uids, folder, add, remove }, 'Flags updated');
});

const moveMessages = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const payload = req.body || {};
  const folder = folderFrom(payload.folder);
  if (typeof payload.to !== 'string' || !payload.to) {
    throw new ValidationError('A destination folder is required');
  }
  const uids = parseUids(payload.uids);

  // The service returns the canonical path it actually selected, which is what
  // the client should hear back — not the string it happened to send.
  const to = await attempt(() => imap.moveMessages(account, folder, uids, payload.to));
  successResponse(res, { uids, folder, to }, 'Messages moved');
});

const deleteMessages = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const folder = folderFrom(req.query.folder);
  const uids = parseUids(req.query.uids);

  // Trash-safe: everywhere but Trash this is a move, and the message stays
  // recoverable. `expunged` says which of the two happened, so the client can
  // word the confirmation honestly instead of guessing.
  const result = await attempt(() => imap.deleteMessages(account, folder, uids));
  successResponse(
    res,
    { ...result, uids, folder },
    result.expunged ? 'Messages deleted' : 'Messages moved to trash'
  );
});

// ── composing ───────────────────────────────────────────────────────────────

/**
 * Reads a text field from a request body, or ''. A present non-string is a 400.
 *
 * The plan's version did `String(replyReferences || '')`, which turns an object
 * into the literal "[object Object]" and an array into "a,b". A JSON body can
 * carry any type, and Express's qs parser produces both shapes from a query
 * string (`?x[]=a` / `?x[a]=b`), so a coerced value would reach the composer as
 * a real header value rather than being refused.
 */
function textFrom(value, label) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(`Invalid ${label}`);
  return value;
}

/**
 * An address, with or without a display name.
 *
 * Recipients are split on commas before they get here (multipart sends them as
 * one joined string), so a display name containing a comma cannot survive the
 * round trip and is not accepted. CR/LF is excluded explicitly: nodemailer
 * folds those out of a header value, but an address is the one field where a
 * newline is never anything but an injection attempt, and it should be a 400
 * rather than something silently rewritten.
 */
const ADDRESS = /^(?:[^<>\r\n,]*<\s*[^\s<>@,]+@[^\s<>@,]+\s*>|[^\s<>@,]+@[^\s<>@,]+)$/;

/** Parses and validates a recipient field: a string, or an array of strings. */
function recipientsFrom(value, label) {
  if (value === undefined || value === null || value === '') return [];
  const entries = Array.isArray(value) ? value : [value];
  for (const entry of entries) {
    if (typeof entry !== 'string') throw new ValidationError(`Invalid ${label} address`);
  }
  const list = sender.normalizeRecipients(entries);
  for (const address of list) {
    if (!ADDRESS.test(address)) throw new ValidationError(`Invalid ${label} address: ${address}`);
  }
  return list;
}

/** Parses a References chain: an array of ids, or one separated string. */
function referencesFrom(value) {
  if (value === undefined || value === null || value === '') return [];
  const entries = Array.isArray(value) ? value : [value];
  for (const entry of entries) {
    if (typeof entry !== 'string') throw new ValidationError('Invalid reply references');
  }
  return entries.flatMap((entry) => entry.trim().split(/[\s,]+/)).filter(Boolean);
}

/**
 * A multer storage engine that caps the TOTAL bytes of one request.
 *
 * multer's own `limits.fileSize` is per file, so `{ fileSize: 15MB, files: 10 }`
 * lets 150 MB be buffered into this process before a handler-side "15 MB total"
 * check can even run — the check would be measuring the damage rather than
 * preventing it, on an endpoint whose whole job is to hold attachments in
 * memory. Counting as the bytes arrive is the only place the total can actually
 * be enforced.
 *
 * The stream is drained rather than destroyed on refusal: multer's
 * abortWithError waits for every pending write to settle before calling next(),
 * and a stalled busboy stream would hang the request instead of failing it.
 */
function cappedMemoryStorage(maxTotalBytes) {
  const TOTAL = Symbol.for('mail.attachmentBytes');
  return {
    _handleFile(req, file, cb) {
      const chunks = [];
      let size = 0;
      let settled = false;

      const finish = (err, info) => {
        if (settled) return;
        settled = true;
        cb(err, info);
      };

      file.stream.on('data', (chunk) => {
        if (settled) return;
        size += chunk.length;
        req[TOTAL] = (req[TOTAL] || 0) + chunk.length;
        if (req[TOTAL] > maxTotalBytes) {
          const err = new Error(
            `Attachments exceed the ${Math.round(maxTotalBytes / (1024 * 1024))} MB limit`
          );
          err.code = 'LIMIT_TOTAL_SIZE';
          finish(err);
          file.stream.resume();
          return;
        }
        chunks.push(chunk);
      });
      file.stream.on('error', (err) => finish(err));
      file.stream.on('end', () => finish(null, { buffer: Buffer.concat(chunks, size), size }));
    },
    _removeFile(req, file, cb) {
      delete file.buffer;
      cb(null);
    },
  };
}

/**
 * The most addresses one message may carry, across To, Cc and Bcc together.
 *
 * The mutation endpoints bound their uid list at MAX_UIDS for the same reason
 * this exists: without a bound, one request is an unbounded operation. A single
 * `to` field holds tens of thousands of comma-separated addresses inside the
 * multipart field-size limit, so the 20/min composeLimiter — which is there
 * precisely so a stolen admin session cannot get the sending domain blacklisted
 * — bounds the number of *requests* while leaving the number of *recipients*
 * open. 100 is far past any real support reply and well under the per-message
 * recipient cap of every mainstream MTA.
 */
const MAX_RECIPIENTS = 100;

/**
 * Reads and validates everything a compose request carries.
 *
 * Shared by send and saveDraft so a draft cannot be saved with a payload the
 * send path would have refused — the plan passed `req.body` straight into
 * saveDraft with no validation at all.
 */
function composeFrom(req) {
  const payload = req.body || {};
  const to = recipientsFrom(payload.to, 'to');
  const cc = recipientsFrom(payload.cc, 'cc');
  const bcc = recipientsFrom(payload.bcc, 'bcc');
  if (to.length + cc.length + bcc.length > MAX_RECIPIENTS) {
    throw new ValidationError(`A message may address at most ${MAX_RECIPIENTS} recipients`);
  }
  return {
    to,
    cc,
    bcc,
    subject: textFrom(payload.subject, 'subject'),
    html: textFrom(payload.html, 'message body'),
    replyToMessageId: textFrom(payload.replyToMessageId, 'reply reference').trim(),
    references: referencesFrom(payload.replyReferences),
  };
}

/** Refuses an attachment set over the cap, in case multer's engine was bypassed. */
function attachmentsFrom(req) {
  const files = req.files || [];
  if (sender.totalAttachmentSize(files) > sender.MAX_ATTACHMENT_BYTES) {
    throw new ValidationError('Attachments exceed the 15 MB limit');
  }
  return files;
}

const sendMessage = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const draft = composeFrom(req);
  if (!draft.to.length) throw new ValidationError('At least one recipient is required');

  const threading = sender.buildReplyHeaders({
    messageId: draft.replyToMessageId || null,
    references: draft.references,
  });

  const result = await attempt(() =>
    sender.send(account, {
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      html: draft.html,
      inReplyTo: threading.inReplyTo,
      references: threading.references,
      attachments: attachmentsFrom(req),
    })
  );

  // Never flattened to "Message sent". A partly-accepted send and a send whose
  // Sent copy did not file are both outcomes the operator has to be able to see
  // — a success toast over a half-delivered message is the failure this whole
  // module is written against.
  let message = 'Message sent';
  if (result.partial) {
    message = `Sent, but the mail server refused ${result.rejected.length} recipient(s): ${result.rejected.join(', ')}`;
  } else if (result.sentCopy.status === 'failed') {
    message = 'Message sent, but a copy could not be filed in Sent';
  }
  successResponse(res, result, message);
});

const saveDraft = asyncHandler(async (req, res) => {
  const account = await accounts.resolveAccount(req.user, req.params.accountId);
  const draft = composeFrom(req);
  const threading = sender.buildReplyHeaders({
    messageId: draft.replyToMessageId || null,
    references: draft.references,
  });

  const result = await attempt(() =>
    sender.saveDraft(account, {
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      html: draft.html,
      inReplyTo: threading.inReplyTo,
      references: threading.references,
      attachments: attachmentsFrom(req),
    })
  );
  successResponse(res, result, 'Draft saved');
});

module.exports = {
  getAccounts,
  createAccount,
  removeAccount,
  getCustomerContext,
  getFolders,
  getMessages,
  getMessage,
  getAttachment,
  setFlags,
  moveMessages,
  deleteMessages,
  sendMessage,
  saveDraft,
  parseUids,
  filtersFrom,
  folderFrom,
  textFrom,
  recipientsFrom,
  referencesFrom,
  composeFrom,
  cappedMemoryStorage,
  attempt,
  mailError,
  MAIL_ERROR_CODES,
  MAX_RECIPIENTS,
};
