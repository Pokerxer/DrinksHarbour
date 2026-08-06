// services/chatEscalation.service.js
//
// The bridge from the storefront chatbot to the support inbox: when the bot
// cannot help, the visitor's message becomes real mail in the support mailbox
// with Reply-To set to them, so an operator answers by hitting Reply.
//
// Everything reaching this module is unauthenticated visitor input, so the
// rules are stricter than anywhere else in the mail code:
//
//   - The recipient is NEVER taken from the request. It is the platform's own
//     mailbox, always. An endpoint whose `to` can be influenced from outside is
//     an open relay, and this one is public.
//   - The message is treated as plain text and escaped into the HTML part. It
//     is displayed in an operator's mail client, and mailBody's sanitizer is
//     for *incoming* mail we are rendering, not for text we are composing.
//   - Nothing here reports success for a message SMTP did not accept. Telling a
//     visitor "a human will get back to you" over a send that failed is the
//     worst outcome available.

const sender = require('./mailSend.service');
const accounts = require('./mailAccount.service');
const { ValidationError, AppError } = require('../utils/errors');

/** Long enough for a real complaint, short enough not to be a payload vector. */
const MAX_MESSAGE_LENGTH = 4000;
/** Subject lines beyond this are truncated by clients anyway. */
const MAX_SUBJECT_LENGTH = 120;
const MAX_NAME_LENGTH = 80;

const SUBJECT_PREFIX = '[Chat escalation]';
/** Used when the message has no words worth quoting (punctuation, emoji only). */
const FALLBACK_SUBJECT = 'New chat escalation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Escapes text for insertion into an HTML body.
 *
 * Both quote characters are escaped as well as the angle brackets. This value
 * only ever lands in element content today, but escaping attribute-unsafe
 * characters too means a future change that moves it into an attribute cannot
 * quietly turn into an injection.
 */
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Strips characters that would break out of a header line or corrupt the body. */
const stripControl = (value) =>
  String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('A valid email address is required');
  }
  const email = value.trim().toLowerCase();
  // The newline check is explicit rather than left to the pattern: this value
  // becomes a Reply-To header, and a CR or LF in it is how a header injection
  // grafts an extra Bcc onto the outgoing message.
  if (/[\r\n]/.test(email) || !EMAIL_RE.test(email) || email.length > 254) {
    throw new ValidationError('A valid email address is required');
  }
  return email;
}

function normalizeMessage(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('A message is required');
  }
  // Newlines are kept — a chat transcript is mostly newlines, and collapsing
  // them turns a readable complaint into one unbroken paragraph.
  const message = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!message) throw new ValidationError('A message is required');
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(
      `That message is too long — please keep it under ${MAX_MESSAGE_LENGTH} characters`
    );
  }
  return message;
}

function normalizeName(value) {
  if (typeof value !== 'string') return '';
  return stripControl(value.replace(/\s+/g, ' ')).slice(0, MAX_NAME_LENGTH);
}

/** A one-line, length-capped subject derived from the visitor's own words. */
function buildSubject(message) {
  const firstLine = message.split('\n').find((line) => line.trim()) || '';
  const words = firstLine.replace(/\s+/g, ' ').trim();
  const room = MAX_SUBJECT_LENGTH - SUBJECT_PREFIX.length - 1;
  const summary = words.length > room ? `${words.slice(0, room - 1).trimEnd()}…` : words;
  // A message of pure punctuation produces no usable summary, and a subject of
  // just the prefix tells the operator nothing about which mail is which.
  return `${SUBJECT_PREFIX} ${summary || FALLBACK_SUBJECT}`;
}

/**
 * Validates and shapes an escalation. Pure — no I/O, so the refusal rules can be
 * tested without a transport.
 */
function validateEscalation(input = {}) {
  const email = normalizeEmail(input.email);
  const message = normalizeMessage(input.message);
  const name = normalizeName(input.name);
  const from = name ? `${name} <${email}>` : email;

  const html = [
    '<p><strong>A visitor asked to speak to a human.</strong></p>',
    `<p>From: ${escapeHtml(from)}<br>`,
    `Reply to this message and it will go straight to them.</p>`,
    '<hr>',
    `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
  ].join('');

  const text = [
    'A visitor asked to speak to a human.',
    `From: ${from}`,
    'Reply to this message and it will go straight to them.',
    '',
    message,
  ].join('\n');

  return { email, name, message, subject: buildSubject(message), html, text };
}

/**
 * The mailbox escalations are filed into.
 *
 * Takes no user because there is no user: the caller is the server acting on
 * its own behalf for an anonymous visitor. That is exactly why the destination
 * is fixed here rather than resolved from anything in the request.
 */
async function supportMailbox() {
  const [first] = await accounts.allAccounts();
  return first || null;
}

/**
 * Sends the escalation.
 *
 * `deps` exists so the tests can drive this without a mailbox or a socket; the
 * production path uses the defaults and no caller passes it.
 */
async function escalate(input, deps = {}) {
  const fields = validateEscalation(input);
  const resolve = deps.firstAccount || supportMailbox;
  const send = deps.send || sender.send;

  const account = await resolve();
  if (!account) {
    throw new AppError(
      'There is no support mailbox configured to receive this right now',
      503,
      true
    );
  }

  // `to` is the mailbox's own address and nothing else. cc/bcc are not passed
  // at all, so no request field can become a recipient.
  const result = await send(account, {
    to: account.address,
    replyTo: fields.email,
    subject: fields.subject,
    html: fields.html,
    text: fields.text,
  });

  return { messageId: result?.messageId || null };
}

module.exports = {
  escalate,
  validateEscalation,
  supportMailbox,
  escapeHtml,
  MAX_MESSAGE_LENGTH,
  MAX_SUBJECT_LENGTH,
  MAX_NAME_LENGTH,
};
