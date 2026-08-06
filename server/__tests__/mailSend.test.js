// Sending is the one mail operation that cannot be undone, so the properties
// pinned here are the ones that are invisible when they break:
//
//   1. The Sent-folder copy must be the message that was actually delivered.
//      nodemailer's SMTP transport does NOT put the composed bytes on `info`
//      (smtp-transport/index.js sets envelope/messageId/accepted/rejected/
//      response and nothing else), so anything reading `info.message` files a
//      zero-byte message and the operator gets a Sent folder full of blanks.
//
//   2. Bcc must reach the envelope but never the transmitted headers, while
//      the *Sent* copy keeps it — that copy is the sender's own record of who
//      was blind-copied. nodemailer only keeps the Bcc header when
//      `keepBcc` is set, which stream-transport/index.js:41 does and the SMTP
//      path does not. So the message is composed twice, and a single
//      self-generated Message-ID is shared between the two compositions —
//      otherwise the Sent copy carries a different Message-ID than recipients
//      received and replying from it silently breaks threading.
//
//   3. A partly-rejected send must not report plain success. nodemailer
//      RESOLVES when only some recipients are refused; `info.rejected` names
//      them. This codebase has already shipped a mail outage that logged "✅"
//      for days.
//
// The SMTP transport is a real nodemailer custom transport, not a hand-rolled
// mock: that is the only stub that compiles the message exactly as the SMTP
// path would (same MailComposer, same keepBcc-off behaviour) without opening a
// socket. No test here touches the network.

const test = require('node:test');
const assert = require('node:assert');

// ── stub IMAP transport ─────────────────────────────────────────────────────

/** Every IMAP call the service makes, in order. */
let commands = [];
/** Per-test overrides for what the fake server does. */
let imapBehaviour = {};

const DEFAULT_BOXES = [
  { path: 'INBOX', name: 'INBOX', specialUse: undefined, flags: new Set() },
  { path: 'INBOX.Drafts', name: 'Drafts', specialUse: '\\Drafts', flags: new Set() },
  { path: 'INBOX.Sent', name: 'Sent', specialUse: '\\Sent', flags: new Set() },
  { path: 'INBOX.Trash', name: 'Trash', specialUse: '\\Trash', flags: new Set() },
];

class FakeImapFlow {
  constructor(options) {
    this.options = options;
    this.usable = false;
    this.mailbox = false;
  }

  get capabilities() {
    return new Map([['MOVE', true]]);
  }

  on() {}
  async connect() {
    this.usable = true;
  }
  async logout() {
    this.usable = false;
  }
  async list() {
    commands.push(['list']);
    return imapBehaviour.boxes ?? DEFAULT_BOXES;
  }
  async getMailboxLock(path) {
    commands.push(['select', path]);
    this.mailbox = { path, permanentFlags: new Set(['\\*']) };
    const self = this;
    return {
      release() {
        self.mailbox = false;
      },
    };
  }
  async append(path, content, flags, idate) {
    commands.push(['append', path, content, flags, idate]);
    if (imapBehaviour.appendThrows) throw imapBehaviour.appendThrows;
    if (imapBehaviour.append !== undefined) return imapBehaviour.append;
    return { destination: path, uid: 7 };
  }
}

const imapflowPath = require.resolve('imapflow');
require.cache[imapflowPath] = {
  id: imapflowPath,
  filename: imapflowPath,
  loaded: true,
  exports: { ImapFlow: FakeImapFlow },
};

// ── stub SMTP transport ─────────────────────────────────────────────────────

const realNodemailer = require('nodemailer');

/** Every message handed to SMTP: { raw, envelope, messageId }. */
let smtpSends = [];
/** Per-test overrides for what the fake SMTP server answers. */
let smtpBehaviour = {};
/** The options mailSend.service passed to createTransport, for the auth test. */
let smtpTransportOptions = [];

/**
 * A real nodemailer transport plugin that records instead of connecting.
 *
 * Because nodemailer compiles the message itself before calling send(), the
 * bytes captured here are byte-for-byte what the SMTP path would have put on
 * the wire — including Bcc being absent from the headers but present in the
 * envelope, which is the whole point of the Bcc test below.
 */
function captureTransport() {
  return {
    name: 'capture',
    version: '1.0.0',
    send(mail, callback) {
      const envelope = mail.data.envelope || mail.message.getEnvelope();
      const messageId = mail.message.messageId();
      const chunks = [];
      const stream = mail.message.createReadStream();
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.once('error', callback);
      stream.on('end', () => {
        smtpSends.push({ raw: Buffer.concat(chunks), envelope, messageId });
        if (smtpBehaviour.error) return callback(smtpBehaviour.error);
        const recipients = [].concat(envelope.to || []);
        const rejected = smtpBehaviour.rejected ?? [];
        const accepted =
          smtpBehaviour.accepted ?? recipients.filter((address) => !rejected.includes(address));
        callback(null, { envelope, messageId, accepted, rejected, response: '250 2.0.0 Ok' });
      });
    },
  };
}

const nodemailerPath = require.resolve('nodemailer');
require.cache[nodemailerPath] = {
  id: nodemailerPath,
  filename: nodemailerPath,
  loaded: true,
  exports: {
    ...realNodemailer,
    createTransport(options) {
      // The Sent/Drafts composer is a real streamTransport — it never opens a
      // socket, and replacing it would mean testing a fake composer instead of
      // the bytes that actually get appended.
      if (options && options.streamTransport) return realNodemailer.createTransport(options);
      smtpTransportOptions.push(options);
      return realNodemailer.createTransport(captureTransport());
    },
  },
};

const sender = require('../services/mailSend.service');
const imap = require('../services/imap.service');
const controller = require('../controllers/mail.controller');

const {
  buildReplyHeaders,
  normalizeRecipients,
  totalAttachmentSize,
  MAX_ATTACHMENT_BYTES,
} = sender;

const ACCOUNT = {
  id: 'platform:support@example.com',
  address: 'support@example.com',
  displayName: 'Example Support',
  imap: { host: 'mail.test', port: 993, secure: true, auth: { user: 'u', pass: 'p' } },
  smtp: { host: 'mail.test', port: 465, secure: true, auth: { user: 'u', pass: 'p' } },
};

function reset() {
  commands = [];
  imapBehaviour = {};
  smtpSends = [];
  smtpBehaviour = {};
  // smtpTransportOptions is deliberately NOT cleared: the service memoises one
  // transporter per account, so createTransport runs on the first send only.
}

const issued = (verb) => commands.filter((c) => c[0] === verb);
const lastAppend = () => issued('append').at(-1);
/** The raw bytes of the one message handed to SMTP. */
const transmitted = () => smtpSends.at(-1).raw.toString('utf8');
/** Splits an RFC822 message into its header block and body. */
const headerBlock = (raw) => raw.split('\r\n\r\n')[0];
const headerValue = (raw, name) =>
  headerBlock(raw)
    .split('\r\n')
    .find((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`)) || null;

// ── pure helpers (the plan's nine) ───────────────────────────────────────────

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
  assert.deepStrictEqual(normalizeRecipients('a@x.com, b@x.com ,c@x.com'), [
    'a@x.com',
    'b@x.com',
    'c@x.com',
  ]);
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

// ── CRITICAL 1: the Sent copy is the real message ───────────────────────────

test('the Sent copy carries the real message, not an empty buffer', async () => {
  reset();
  await sender.send(ACCOUNT, {
    to: 'a@x.com',
    subject: 'Order 4821',
    html: '<p>Your order shipped.</p>',
  });

  const append = lastAppend();
  assert.ok(append, 'nothing was appended to Sent');
  assert.strictEqual(append[1], 'INBOX.Sent');

  const raw = append[2];
  assert.ok(Buffer.isBuffer(raw), 'the Sent copy must be raw RFC822 bytes');
  assert.ok(raw.length > 100, `the Sent copy is ${raw.length} bytes — that is an empty message`);

  const copy = raw.toString('utf8');
  assert.match(copy, /Subject: Order 4821/);
  assert.match(copy, /Your order shipped\./);
  assert.deepStrictEqual(append[3], ['\\Seen']);
});

// ── CRITICAL 2: Bcc, and one shared Message-ID ──────────────────────────────

test('Bcc reaches the envelope but never the transmitted headers', async () => {
  reset();
  await sender.send(ACCOUNT, {
    to: 'a@x.com',
    cc: 'c@x.com',
    bcc: 'secret@x.com',
    subject: 'Quiet copy',
    html: '<p>hello</p>',
  });

  const wire = transmitted();
  assert.ok(
    !/^bcc:/im.test(headerBlock(wire)),
    'the Bcc header was transmitted to every recipient'
  );
  assert.ok(!wire.includes('secret@x.com'), 'the blind-copied address leaked into the message');

  // It still has to be delivered — the envelope is how SMTP does that.
  assert.deepStrictEqual([].concat(smtpSends.at(-1).envelope.to).sort(), [
    'a@x.com',
    'c@x.com',
    'secret@x.com',
  ]);
});

test('the Sent copy keeps Bcc, because it is the sender\'s own record', async () => {
  reset();
  await sender.send(ACCOUNT, {
    to: 'a@x.com',
    bcc: 'secret@x.com',
    subject: 'Quiet copy',
    html: '<p>hello</p>',
  });

  const copy = lastAppend()[2].toString('utf8');
  assert.match(headerBlock(copy), /^Bcc: secret@x\.com$/im);
});

test('both compositions carry the identical Message-ID', async () => {
  reset();
  const result = await sender.send(ACCOUNT, {
    to: 'a@x.com',
    bcc: 'secret@x.com',
    subject: 'Threaded',
    html: '<p>hello</p>',
  });

  const wire = transmitted();
  const copy = lastAppend()[2].toString('utf8');

  const wireId = headerValue(wire, 'Message-ID');
  const copyId = headerValue(copy, 'Message-ID');
  assert.ok(wireId, 'the transmitted message has no Message-ID');
  assert.strictEqual(
    copyId,
    wireId,
    'the Sent copy has a different Message-ID than recipients received — replying from it would break threading'
  );
  assert.strictEqual(result.messageId, wireId.slice('Message-ID: '.length));
});

test('subject, threading headers and body are identical in both compositions', async () => {
  reset();
  await sender.send(ACCOUNT, {
    to: 'a@x.com',
    subject: 'Re: Order 4821',
    html: '<p>Thanks for confirming.</p>',
    inReplyTo: '<parent@x.com>',
    references: ['<root@x.com>', '<parent@x.com>'],
  });

  const wire = transmitted();
  const copy = lastAppend()[2].toString('utf8');

  for (const header of ['Subject', 'In-Reply-To', 'References', 'Date', 'From', 'To']) {
    assert.strictEqual(
      headerValue(copy, header),
      headerValue(wire, header),
      `${header} differs between the delivered message and the Sent copy`
    );
  }
  assert.match(wire, /References: <root@x\.com> <parent@x\.com>/);
  assert.ok(wire.includes('Thanks for confirming.'));
  assert.ok(copy.includes('Thanks for confirming.'));
});

test('attachments appear in both the delivered message and the Sent copy', async () => {
  reset();
  await sender.send(ACCOUNT, {
    to: 'a@x.com',
    subject: 'With a file',
    html: '<p>see attached</p>',
    attachments: [
      { originalname: 'invoice.txt', mimetype: 'text/plain', buffer: Buffer.from('TOTAL 100'), size: 9 },
    ],
  });

  const wire = transmitted();
  const copy = lastAppend()[2].toString('utf8');
  for (const [label, raw] of [['delivered', wire], ['sent copy', copy]]) {
    assert.ok(raw.includes('invoice.txt'), `attachment missing from the ${label}`);
    assert.ok(
      raw.includes(Buffer.from('TOTAL 100').toString('base64')) || raw.includes('TOTAL 100'),
      `attachment content missing from the ${label}`
    );
  }
});

// ── CRITICAL 3: accepted / rejected ─────────────────────────────────────────

test('a send every recipient refused is an error, not a success', async () => {
  reset();
  smtpBehaviour.accepted = [];
  smtpBehaviour.rejected = ['a@x.com', 'b@x.com'];

  await assert.rejects(
    () => sender.send(ACCOUNT, { to: 'a@x.com, b@x.com', subject: 'Nope', html: '<p>x</p>' }),
    (err) => err.code === 'ESENDREJECTED' && err.rejected.includes('a@x.com')
  );

  // Nothing was delivered, so nothing belongs in Sent.
  assert.deepStrictEqual(issued('append'), []);
});

test('a partly rejected send reports the refused addresses instead of plain success', async () => {
  reset();
  smtpBehaviour.rejected = ['b@x.com'];

  const result = await sender.send(ACCOUNT, {
    to: 'a@x.com, b@x.com, c@x.com',
    subject: 'Partial',
    html: '<p>x</p>',
  });

  assert.strictEqual(result.partial, true);
  assert.deepStrictEqual(result.rejected, ['b@x.com']);
  assert.deepStrictEqual(result.accepted.sort(), ['a@x.com', 'c@x.com']);
});

test('a fully accepted send is not reported as partial', async () => {
  reset();
  const result = await sender.send(ACCOUNT, {
    to: 'a@x.com',
    subject: 'Fine',
    html: '<p>x</p>',
  });
  assert.strictEqual(result.partial, false);
  assert.deepStrictEqual(result.rejected, []);
  assert.deepStrictEqual(result.accepted, ['a@x.com']);
  assert.strictEqual(result.sentCopy.status, 'filed');
  assert.strictEqual(result.appendedTo, 'INBOX.Sent');
});

test('an SMTP failure propagates — a send that did not happen never resolves', async () => {
  reset();
  smtpBehaviour.error = Object.assign(new Error('535 authentication failed'), {
    code: 'EAUTH',
  });
  await assert.rejects(
    () => sender.send(ACCOUNT, { to: 'a@x.com', subject: 'x', html: 'x' }),
    /authentication failed/
  );
});

// ── IMPORTANT 6: the Sent append must not fail silently ─────────────────────

test('a failed Sent append is reported, not swallowed, and does not fail the send', async () => {
  reset();
  imapBehaviour.appendThrows = new Error('APPEND rejected: over quota');
  const result = await sender.send(ACCOUNT, { to: 'a@x.com', subject: 'x', html: 'x' });

  assert.deepStrictEqual(result.accepted, ['a@x.com']);
  assert.strictEqual(result.sentCopy.status, 'failed');
  assert.strictEqual(result.appendedTo, null);
  assert.ok(result.sentCopy.error, 'the failure was swallowed with no explanation');
});

test('an account with no Sent folder is distinguishable from a failed append', async () => {
  reset();
  imapBehaviour.boxes = [{ path: 'INBOX', name: 'INBOX', specialUse: undefined, flags: new Set() }];
  const result = await sender.send(ACCOUNT, { to: 'a@x.com', subject: 'x', html: 'x' });

  assert.strictEqual(result.sentCopy.status, 'no-folder');
  assert.strictEqual(result.appendedTo, null);
  assert.deepStrictEqual(issued('append'), []);
});

test('an append the server answers falsy is a failure, not a silent success', async () => {
  reset();
  // imapflow's append() resolves to `false` when the connection is not in a
  // state to APPEND (imap-flow.js:3130 `|| false`); it never throws for that.
  imapBehaviour.append = false;
  await assert.rejects(
    () => imap.appendMessage(ACCOUNT, 'INBOX.Sent', Buffer.from('raw'), ['\\Seen']),
    (err) => err.code === 'EAPPENDFAILED'
  );
});

// ── IMPORTANT 4/5/7: connection discipline ──────────────────────────────────

test('SMTP credentials are copied, never handed over by reference', async () => {
  reset();
  await sender.send(ACCOUNT, { to: 'a@x.com', subject: 'x', html: 'x' });
  const options = smtpTransportOptions.at(-1);
  assert.ok(options, 'no SMTP transport was created');
  // `secure` is only true on 465. On 587 nodemailer STARTTLSes opportunistically
  // — a server that does not offer it gets the mailbox password in the clear
  // and the send still succeeds. requireTLS makes that a refused connection.
  assert.strictEqual(options.requireTLS, true, 'the SMTP session may be downgraded to plaintext');
  assert.deepStrictEqual(options.auth, ACCOUNT.smtp.auth);
  assert.notStrictEqual(
    options.auth,
    ACCOUNT.smtp.auth,
    'the shared account credentials object was handed to nodemailer by reference'
  );
});

test('getClient is not exported — APPEND goes through the module, under the mailbox lock', () => {
  assert.strictEqual(imap.getClient, undefined);
  assert.strictEqual(typeof imap.appendMessage, 'function');
});

test('filing a copy costs one cheap LIST, never listFolders\' per-folder STATUS', async () => {
  reset();
  await sender.send(ACCOUNT, { to: 'a@x.com', subject: 'x', html: 'x' });
  // FakeImapFlow has no status(); listFolders would have thrown. Assert the
  // shape directly so the cheap path stays the one taken.
  assert.strictEqual(issued('list').length, 1);
  assert.deepStrictEqual(issued('select'), [['select', 'INBOX.Sent']]);
});

// ── header injection ────────────────────────────────────────────────────────

test('a CRLF payload in the subject cannot inject a header', async () => {
  reset();
  await sender.send(ACCOUNT, {
    to: 'a@x.com',
    subject: 'Hello\r\nBcc: attacker@evil.com',
    html: '<p>x</p>',
  });

  const wire = transmitted();
  const block = headerBlock(wire);
  // nodemailer's mime-node collapses CR/LF in an unstructured header value to a
  // single space (_encodeHeaderValue's default branch), so the payload survives
  // as subject text and never becomes a header of its own.
  assert.ok(!/^bcc:/im.test(block), 'a CRLF subject injected a Bcc header');
  assert.match(block, /^Subject: Hello Bcc: attacker@evil\.com$/im);
  assert.deepStrictEqual(smtpSends.at(-1).envelope.to, ['a@x.com']);
});

// ── drafts ──────────────────────────────────────────────────────────────────

test('a draft is filed in Drafts with the \\Draft flag and is never sent', async () => {
  reset();
  const result = await sender.saveDraft(ACCOUNT, {
    to: 'a@x.com',
    subject: 'Half written',
    html: '<p>tbc</p>',
  });

  assert.strictEqual(result.appendedTo, 'INBOX.Drafts');
  const append = lastAppend();
  assert.strictEqual(append[1], 'INBOX.Drafts');
  assert.deepStrictEqual(append[3], ['\\Draft', '\\Seen']);
  assert.match(append[2].toString('utf8'), /Subject: Half written/);
  assert.deepStrictEqual(smtpSends, [], 'saving a draft must not send anything');
});

test('a draft that cannot be filed anywhere is an error, not a quiet no-op', async () => {
  reset();
  imapBehaviour.boxes = [{ path: 'INBOX', name: 'INBOX', specialUse: undefined, flags: new Set() }];
  await assert.rejects(
    () => sender.saveDraft(ACCOUNT, { to: 'a@x.com', subject: 'x', html: 'x' }),
    (err) => err.code === 'ENODRAFTS'
  );
});

// ── MINOR 8: request input is typed, not stringified ────────────────────────

test('a non-string recipient field is rejected rather than coerced', () => {
  // qs turns ?to[x]=y into an object and a JSON body can carry any type;
  // String({}) is "[object Object]", which would become a real recipient.
  for (const value of [{ x: 'y' }, 7, true, [{ x: 'y' }]]) {
    assert.throws(() => controller.recipientsFrom(value, 'to'), /Invalid/);
  }
  assert.deepStrictEqual(controller.recipientsFrom(undefined, 'to'), []);
  assert.deepStrictEqual(controller.recipientsFrom('a@x.com, b@x.com', 'to'), [
    'a@x.com',
    'b@x.com',
  ]);
  assert.deepStrictEqual(controller.recipientsFrom(['a@x.com', 'b@x.com'], 'to'), [
    'a@x.com',
    'b@x.com',
  ]);
});

test('an address that is not an address is refused before it reaches SMTP', () => {
  for (const value of ['not-an-address', 'a@x.com\r\nBcc: evil@x.com', '<>', 'a b@x.com']) {
    assert.throws(() => controller.recipientsFrom(value, 'to'), /Invalid/);
  }
  assert.deepStrictEqual(controller.recipientsFrom('Support <a@x.com>', 'to'), [
    'Support <a@x.com>',
  ]);
});

test('a non-string text field is rejected rather than stringified', () => {
  for (const value of [{ x: 'y' }, ['a'], 7]) {
    assert.throws(() => controller.textFrom(value, 'subject'), /Invalid/);
  }
  assert.strictEqual(controller.textFrom(undefined, 'subject'), '');
  assert.strictEqual(controller.textFrom(null, 'subject'), '');
  assert.strictEqual(controller.textFrom('hi', 'subject'), 'hi');
});

test('reply references accept an array or a separated string, and nothing else', () => {
  assert.deepStrictEqual(controller.referencesFrom('<a@x.com> <b@x.com>'), [
    '<a@x.com>',
    '<b@x.com>',
  ]);
  assert.deepStrictEqual(controller.referencesFrom(['<a@x.com>', '<b@x.com>']), [
    '<a@x.com>',
    '<b@x.com>',
  ]);
  assert.deepStrictEqual(controller.referencesFrom(undefined), []);
  // String({}) is "[object Object]" — a bogus References header, not an error.
  assert.throws(() => controller.referencesFrom({ a: 'b' }), /Invalid/);
  assert.throws(() => controller.referencesFrom([7]), /Invalid/);
});

// ── MINOR 9: the attachment cap is enforced while bytes arrive ──────────────

const { Readable } = require('node:stream');

/** Drives the multer storage engine directly — no HTTP, no sockets. */
function storeFile(storage, req, chunks) {
  const file = {};
  Object.defineProperty(file, 'stream', { value: Readable.from(chunks), enumerable: false });
  return new Promise((resolve) => storage._handleFile(req, file, (err, info) => resolve({ err, info })));
}

test('a file under the cap is buffered whole', async () => {
  const storage = controller.cappedMemoryStorage(100);
  const req = {};
  const { err, info } = await storeFile(storage, req, [Buffer.from('ab'), Buffer.from('cd')]);
  assert.strictEqual(err, null);
  assert.strictEqual(info.size, 4);
  assert.strictEqual(info.buffer.toString(), 'abcd');
});

test('the cap is a running TOTAL across files, refused mid-stream', async () => {
  // multer's own limits are per-file, so `fileSize: 15MB, files: 10` allows
  // 150 MB resident before any handler-side total check can run.
  const storage = controller.cappedMemoryStorage(10);
  const req = {};
  const first = await storeFile(storage, req, [Buffer.alloc(8)]);
  assert.strictEqual(first.err, null);

  const second = await storeFile(storage, req, [Buffer.alloc(4), Buffer.alloc(4)]);
  assert.ok(second.err, 'the second file pushed the total over the cap and was accepted anyway');
  assert.strictEqual(second.err.code, 'LIMIT_TOTAL_SIZE');
});

// ── the HTTP translation layer ──────────────────────────────────────────────
//
// Everything above tests the service. These test the controller, which is where
// a correct service result still turns into the wrong answer for the operator:
// a code the map does not know becomes an unexplained 502, a 5xx without
// `expose` is masked to 'Internal server error' by the global handler (the bug
// Task 3 shipped), and a partly-rejected send is exactly the "green toast over
// a half-delivered message" this module exists to prevent.

const { AppError } = require('../utils/errors');

test('every mail error code is mapped, and none of them is masked as a 500', () => {
  for (const [code, [status, text]] of Object.entries(controller.MAIL_ERROR_CODES)) {
    const mapped = controller.mailError(Object.assign(new Error('raw imap text'), { code }));
    assert.strictEqual(mapped.statusCode, status, `${code} mapped to the wrong status`);
    assert.strictEqual(mapped.message, text);
    // Without expose, server.js's handler replaces every 5xx message with
    // 'Internal server error' whenever NODE_ENV is unset — as it is in prod.
    assert.strictEqual(mapped.expose, true, `${code} would reach the operator as an opaque 500`);
  }
});

test('the send-specific codes are all in the map, not the generic branch', () => {
  const generic = controller.mailError(new Error('something else entirely'));
  for (const code of ['ESENDREJECTED', 'EAPPENDFAILED', 'ENODRAFTS']) {
    const mapped = controller.mailError(Object.assign(new Error('x'), { code }));
    assert.notStrictEqual(
      mapped.message,
      generic.message,
      `${code} falls through to the generic branch — the operator loses the diagnosis`
    );
  }
  assert.strictEqual(
    controller.mailError(Object.assign(new Error('x'), { code: 'ENODRAFTS' })).statusCode,
    404
  );
});

test('a refused send names the refused addresses in the error details', () => {
  const err = Object.assign(new Error('SMTP accepted no recipients'), {
    code: 'ESENDREJECTED',
    rejected: ['a@x.com', 'b@x.com'],
  });
  const mapped = controller.mailError(err);
  assert.ok(mapped instanceof AppError);
  assert.deepStrictEqual(mapped.details, { rejected: ['a@x.com', 'b@x.com'] });
});

// The controller resolves the account itself, so the handler tests need the
// same mailbox the service tests use to exist in env.
process.env.MAIL_HOST = 'mail.test';
process.env.MAIL_PORT = '465';
process.env.SENDER_EMAIL_ADDRESS = 'support@example.com';
process.env.MAIL_PASSWORD = 'p';
require('../services/mailAccount.service').__resetCache();

const SUPER_ADMIN = { role: 'super_admin' };

/** Drives a controller handler with no express, no socket. */
function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({ res, err: null });
        return this;
      },
    };
    handler(
      { user: SUPER_ADMIN, params: { accountId: ACCOUNT.id }, query: {}, ...req },
      res,
      (err) => (err ? resolve({ res, err }) : reject(new Error('next() called with no error')))
    );
  });
}

test('a partly rejected send does not reach the client as "Message sent"', async () => {
  reset();
  smtpBehaviour.rejected = ['b@x.com'];

  const { res, err } = await invoke(controller.sendMessage, {
    body: { to: 'a@x.com, b@x.com', subject: 'Partial', html: '<p>x</p>' },
  });

  assert.strictEqual(err, null);
  assert.strictEqual(res.statusCode, 200);
  assert.notStrictEqual(
    res.body.message,
    'Message sent',
    'a half-delivered message was reported as a plain success'
  );
  assert.match(res.body.message, /b@x\.com/);
  assert.strictEqual(res.body.data.partial, true);
});

test('a send whose Sent copy did not file says so, and still reports the send', async () => {
  reset();
  imapBehaviour.appendThrows = new Error('APPEND rejected: over quota');

  const { res } = await invoke(controller.sendMessage, {
    body: { to: 'a@x.com', subject: 'x', html: 'x' },
  });
  assert.match(res.body.message, /copy could not be filed/i);
  assert.strictEqual(res.body.data.sentCopy.status, 'failed');
});

test('a send with no recipient is refused before SMTP is touched', async () => {
  reset();
  const { err } = await invoke(controller.sendMessage, { body: { subject: 'x', html: 'x' } });
  assert.strictEqual(err?.statusCode, 400);
  assert.match(err.message, /recipient/i);
  assert.deepStrictEqual(smtpSends, [], 'a recipientless message was handed to SMTP anyway');
});

test('a compose is bounded in recipients, not just in requests per minute', () => {
  const many = Array.from({ length: controller.MAX_RECIPIENTS + 1 }, (_, i) => `r${i}@x.com`);
  assert.throws(
    () => controller.composeFrom({ body: { to: many.join(',') } }),
    /at most 100 recipients/
  );
  // Split across the three fields it is still one message and still bounded.
  assert.throws(
    () =>
      controller.composeFrom({
        body: { to: many.slice(0, 50), cc: many.slice(50, 100), bcc: many.slice(100) },
      }),
    /at most 100 recipients/
  );
  assert.strictEqual(controller.composeFrom({ body: { to: many.slice(0, 100) } }).to.length, 100);
});

// ── the route wiring ────────────────────────────────────────────────────────
//
// The two compose routes are the only ones that emit mail, and each carries
// three middlewares that are invisible from any other test: the tighter compose
// rate limiter, the multipart reader, and the handler. Drop one silently and
// nothing else in this file changes colour — hence a structural check.

const authPath = require.resolve('../middleware/auth.middleware');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    protect: (req, res, next) => next(),
    attachTenant: (req, res, next) => next(),
  },
};
const mailRouter = require('../routes/mail.routes');

/** The middleware chain express registered for one method+path. */
const chainFor = (method, path) =>
  mailRouter.stack.find((l) => l.route?.path === path && l.route?.methods?.[method])?.route.stack ||
  [];

test('both compose routes are rate limited and read multipart, the read routes are not', () => {
  for (const path of ['/:accountId/send', '/:accountId/drafts']) {
    const chain = chainFor('post', path);
    assert.strictEqual(chain.length, 3, `${path} lost a middleware`);
    // express-rate-limit v7 hangs getKey/resetKey off the middleware it returns.
    assert.strictEqual(
      typeof chain[0].handle.resetKey,
      'function',
      `${path} is not behind the compose rate limiter`
    );
    assert.strictEqual(chain[1].name, 'withAttachments', `${path} does not read its attachments`);
  }
  // A read route must not have picked up the compose limiter by accident.
  assert.strictEqual(chainFor('get', '/:accountId/messages').length, 1);
});

test('a multer rejection is a 400 that explains itself, not an opaque 500', async () => {
  const { PassThrough } = require('node:stream');
  const BOUNDARY = '----mailtest';
  const body = Buffer.from(
    `--${BOUNDARY}\r\n` +
      'Content-Disposition: form-data; name="avatar"; filename="a.bin"\r\n' +
      'Content-Type: application/octet-stream\r\n\r\n' +
      'xxxx\r\n' +
      `--${BOUNDARY}--\r\n`
  );

  const withAttachments = chainFor('post', '/:accountId/send')[1].handle;
  const req = new PassThrough();
  req.headers = {
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    'content-length': String(body.length),
  };
  req.method = 'POST';

  const err = await new Promise((resolve) => {
    withAttachments(req, {}, resolve);
    req.end(body);
  });

  assert.ok(err, 'an unexpected upload field was accepted');
  // Without the MulterError branch this reaches the global handler with no
  // statusCode, is served as a 500, and its message is masked in production.
  assert.strictEqual(err.statusCode, 400);
  assert.match(err.message, /avatar/);
});

test.after(() => imap.closeAll());
