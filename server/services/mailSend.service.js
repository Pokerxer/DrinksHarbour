// services/mailSend.service.js
//
// Outbound mail for the support inbox. Kept separate from email.service.js,
// which is the transactional path (order confirmations) with a single
// env-bound transporter — coupling the two would put customer support mail and
// order receipts on the same failure.
//
// A send that fails must throw. This codebase has already shipped a silent mail
// outage that logged success for days; nothing here may swallow an error, and
// nothing here may report success for a message the server did not accept.

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const imap = require('./imap.service');

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** accountId -> SMTP transporter */
const transports = new Map();

/**
 * Tags a failure with a code the controller maps to a status.
 *
 * Same convention imap.service uses: this module knows nothing about HTTP, so
 * mail.controller's MAIL_ERROR_CODES owns the translation.
 */
function taggedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function getTransport(account) {
  const existing = transports.get(account.id);
  if (existing) return existing;
  const transport = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    // `secure` is only true on port 465 (mailAccount.service infers it from the
    // port). On 587 the connection starts in the clear and nodemailer will
    // *opportunistically* STARTTLS — meaning a server that does not advertise
    // STARTTLS, or a downgrade injected between us and it, gets the mailbox
    // password in plaintext and the send still succeeds. requireTLS turns that
    // into a refused connection instead. It is a no-op when `secure` is true.
    requireTLS: true,
    // Defensive copy: `account.smtp.auth` is a live reference into the
    // module-level cache mailAccount.service shares with every caller in the
    // process, and that object is read-only for all of them. Handing the
    // original to a third-party library would let it mutate the singleton for
    // everyone afterwards. imap.service does the same for account.imap.auth.
    auth: { ...account.smtp.auth },
  });
  transports.set(account.id, transport);
  return transport;
}

/**
 * The composer used for the Sent and Drafts copies.
 *
 * streamTransport opens no socket — it is nodemailer's MIME builder with a
 * buffer on the end. It is deliberately NOT the thing that sends: it sets
 * `mail.message.keepBcc = true` (stream-transport/index.js:41), so the bytes it
 * produces contain a literal `Bcc:` header. That is exactly what a Sent copy
 * should have and exactly what must never go on the wire.
 *
 * `buffer: true` makes info.message a Buffer rather than a stream, which is
 * what IMAP APPEND wants. Line endings are already CRLF (mime-node joins
 * headers with \r\n regardless of transport), as RFC 822 requires.
 */
const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });

/**
 * Accepts "a@x, b@y" or ["a@x","b@y"] (or a mix) and returns a clean list.
 *
 * Array entries are split on commas too, because multipart form-data gives a
 * repeated field as an array and a single field as one comma-joined string, and
 * the caller should not have to care which it got.
 */
function normalizeRecipients(input) {
  const entries = Array.isArray(input) ? input : [input];
  return entries
    .flatMap((entry) => String(entry ?? '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);
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

/**
 * Generates the one Message-ID both compositions share.
 *
 * The message is composed twice — once for SMTP (Bcc stripped) and once for the
 * Sent copy (Bcc kept) — and nodemailer mints a fresh Message-ID per
 * composition when the caller does not supply one. Letting it do that would put
 * a different Message-ID in the Sent folder than recipients received, so a
 * reply composed from the Sent copy would carry an In-Reply-To nobody's client
 * recognises and the thread would silently split. Generating it here, once, is
 * the fix. Shape mirrors nodemailer's own _generateMessageId.
 */
function generateMessageId(address) {
  const domain = String(address || '').split('@').pop() || 'localhost';
  const random = [2, 2, 2, 6].reduce(
    (acc, len) => `${acc}-${crypto.randomBytes(len).toString('hex')}`,
    crypto.randomBytes(4).toString('hex')
  );
  return `<${random}@${domain}>`;
}

/**
 * Builds the nodemailer message object.
 *
 * Called once and handed to BOTH compositions unchanged, so the Sent copy
 * cannot drift from what was delivered. `messageId` and `date` are pinned by
 * the caller for the same reason — nodemailer would otherwise generate a fresh
 * one of each per composition.
 */
function buildMessage(account, fields) {
  const { subject, html, text, inReplyTo, references, messageId, date } = fields;
  const message = {
    from: { name: account.displayName, address: account.address },
    to: fields.to,
    cc: fields.cc,
    bcc: fields.bcc,
    subject: subject || '(no subject)',
    html: html || '',
    messageId,
    date,
    attachments: fields.attachments,
  };
  if (text) message.text = text;
  // Only set when the caller asked for it. An operator's own compose never
  // does — the chatbot escalation is the one caller, where the mailbox is both
  // sender and recipient and Reply has to reach the visitor instead.
  if (fields.replyTo) message.replyTo = fields.replyTo;
  if (inReplyTo) {
    message.inReplyTo = inReplyTo;
    message.references = references;
  }
  return message;
}

/** Turns multer files into nodemailer attachments. Built once, reused by both. */
function toAttachments(files) {
  return (files || []).map((f) => ({
    filename: f.originalname,
    content: f.buffer,
    contentType: f.mimetype,
  }));
}

/** Compiles a message to raw RFC822 bytes, Bcc header included. */
async function composeRaw(message) {
  const built = await composer.sendMail(message);
  return built.message;
}

/**
 * nodemailer reports accepted/rejected as addresses, but a DSN-enabled send can
 * report objects. Flatten to plain strings so the client always gets one shape.
 */
function addressStrings(list) {
  return []
    .concat(list || [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.address))
    .filter(Boolean);
}

/**
 * Appends raw bytes to a special-use folder. Returns the path, or null when the
 * account has no such folder.
 *
 * listMailboxes, not listFolders: listFolders issues one STATUS round trip per
 * folder to build the unread badges the rail needs, and a send needs none of
 * those counts — only the paths and the `\Sent` flag.
 */
async function appendToSpecial(account, specialUse, raw, flags) {
  const folders = await imap.listMailboxes(account);
  const path = imap.specialFolder(folders, specialUse);
  if (!path) return null;
  return imap.appendMessage(account, path, raw, flags);
}

/**
 * Sends a message, then files a copy in the account's Sent folder.
 *
 * Delivery policy — the whole reason this function is not three lines:
 *
 *   - nodemailer's SMTP transport RESOLVES when the server accepted only *some*
 *     of the recipients; `info.rejected` names the rest. Ignoring it is how a
 *     send to three people with two addresses refused shows a green toast and
 *     nobody is told. So accepted/rejected are always returned, and `partial`
 *     says which case it is.
 *   - Zero accepted is not a partial success, it is a failed send, and it
 *     throws. Nothing was delivered, so no Sent copy is filed either.
 *
 * Sent-copy policy: non-fatal but never silent. Once SMTP has accepted the
 * message the mail has left, and failing the request at that point would tell
 * the operator their send failed when it did not. It is reported instead, and
 * the three outcomes are kept distinct — `filed`, `no-folder` (this account has
 * no Sent mailbox) and `failed` (the APPEND was refused) mean different things
 * and only one of them is a problem to chase.
 */
async function send(account, input) {
  const messageId = generateMessageId(account.address);
  const message = buildMessage(account, {
    ...input,
    to: normalizeRecipients(input.to),
    cc: normalizeRecipients(input.cc),
    bcc: normalizeRecipients(input.bcc),
    attachments: toAttachments(input.attachments),
    messageId,
    date: new Date(),
  });

  // The normal SMTP path, with a normal message object. nodemailer strips the
  // Bcc header here (mime-node/index.js:580-585, keepBcc falsy) while still
  // delivering to those addresses through the envelope — sending a
  // streamTransport-built raw instead would transmit the Bcc header to every
  // recipient.
  const info = await getTransport(account).sendMail(message);

  const accepted = addressStrings(info?.accepted);
  const rejected = addressStrings(info?.rejected);

  if (!accepted.length) {
    const err = taggedError(
      'ESENDREJECTED',
      `SMTP accepted no recipients (rejected: ${rejected.join(', ') || 'none reported'})`
    );
    err.rejected = rejected;
    throw err;
  }

  let sentCopy = { status: 'no-folder', path: null, error: null };
  try {
    const raw = await composeRaw(message);
    const path = await appendToSpecial(account, '\\Sent', raw, ['\\Seen']);
    if (path) sentCopy = { status: 'filed', path, error: null };
  } catch (err) {
    // Logged, not swallowed. A Sent folder that quietly stops filling is the
    // shape of the last mail outage this codebase shipped.
    console.error('[mail] message sent but the Sent-folder copy failed:', err?.message || err);
    sentCopy = {
      status: 'failed',
      path: null,
      error: 'The message was sent but a copy could not be filed in Sent',
    };
  }

  return {
    messageId: info?.messageId || messageId,
    accepted,
    rejected,
    partial: rejected.length > 0,
    appendedTo: sentCopy.path,
    sentCopy,
  };
}

/**
 * Files a draft in the account's Drafts folder without sending it.
 *
 * Unlike the Sent copy, a failure here IS fatal: nothing was sent, so an
 * unfiled draft is simply a lost draft and reporting success would lose the
 * operator's text. No Drafts folder is the same outcome by a different route.
 */
async function saveDraft(account, input) {
  const messageId = generateMessageId(account.address);
  const message = buildMessage(account, {
    ...input,
    to: normalizeRecipients(input.to),
    cc: normalizeRecipients(input.cc),
    bcc: normalizeRecipients(input.bcc),
    attachments: toAttachments(input.attachments),
    messageId,
    date: new Date(),
  });

  const raw = await composeRaw(message);
  const appendedTo = await appendToSpecial(account, '\\Drafts', raw, ['\\Draft', '\\Seen']);
  if (!appendedTo) {
    throw taggedError('ENODRAFTS', 'This account has no Drafts folder to save into');
  }
  return { appendedTo, messageId };
}

module.exports = {
  send,
  saveDraft,
  buildReplyHeaders,
  normalizeRecipients,
  totalAttachmentSize,
  MAX_ATTACHMENT_BYTES,
};
