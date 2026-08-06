// Escalation from the storefront chatbot into the support inbox.
//
// Everything here arrives from an unauthenticated visitor, so the surface being
// tested is mostly refusal: what the endpoint declines to send, and what it
// strips out of what it does send. The message body is attacker-controlled text
// that lands in an operator's HTML mail client, which is the one place in this
// module where "it renders" is a security property rather than a cosmetic one.
//
// The transport is stubbed. No test in this repo touches the network.

const test = require('node:test');
const assert = require('node:assert');

const escalation = require('../services/chatEscalation.service');

// ── the customer's address ──────────────────────────────────────────────────

test('a valid address is accepted and normalized', () => {
  const fields = escalation.validateEscalation({
    email: '  Ada@Example.COM ',
    message: 'my order never arrived',
  });
  assert.strictEqual(fields.email, 'ada@example.com');
});

test('a missing or malformed address is refused', () => {
  for (const email of ['', '   ', 'nope', 'a@b', 'a b@c.com', undefined, null, 42, {}]) {
    assert.throws(
      () => escalation.validateEscalation({ email, message: 'hello' }),
      /email/i,
      `accepted ${JSON.stringify(email)}`
    );
  }
});

test('an address cannot smuggle a header break', () => {
  // This value becomes a Reply-To. A newline in it is how a CRLF injection
  // grafts a Bcc onto the outgoing message.
  for (const email of ['a@b.com\nBcc: x@y.com', 'a@b.com\r\nBcc: x@y.com', 'a@b.com\rx']) {
    assert.throws(() => escalation.validateEscalation({ email, message: 'hi' }), /email/i);
  }
});

// ── the message ─────────────────────────────────────────────────────────────

test('an empty message is refused', () => {
  for (const message of ['', '    ', '\n\n', undefined, null, [], {}]) {
    assert.throws(
      () => escalation.validateEscalation({ email: 'a@b.com', message }),
      /message/i,
      `accepted ${JSON.stringify(message)}`
    );
  }
});

test('an over-long message is refused rather than silently truncated', () => {
  assert.throws(
    () =>
      escalation.validateEscalation({
        email: 'a@b.com',
        message: 'x'.repeat(escalation.MAX_MESSAGE_LENGTH + 1),
      }),
    /too long/i
  );
  assert.doesNotThrow(() =>
    escalation.validateEscalation({
      email: 'a@b.com',
      message: 'x'.repeat(escalation.MAX_MESSAGE_LENGTH),
    })
  );
});

test('the message is carried as text, never as markup', () => {
  const fields = escalation.validateEscalation({
    email: 'a@b.com',
    message: '<img src=x onerror=alert(1)> <script>alert(2)</script>',
  });
  // The visitor's words are preserved verbatim in the text part...
  assert.match(fields.message, /<script>/);
  // ...and escaped in the HTML part. `onerror=` still appears as *characters* —
  // that is fine and is the point: what must not survive is the angle bracket
  // that would make them an element. So the property asserted is that every
  // tag in the body is one this module wrote, not one the visitor supplied.
  assert.match(fields.html, /&lt;script&gt;/);
  assert.match(fields.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  const tags = fields.html.match(/<[^>]*>/g) || [];
  assert.deepStrictEqual(
    tags.filter((t) => !/^<\/?(p|br|hr|strong)>$/.test(t)),
    [],
    'a tag the visitor supplied survived into the HTML body'
  );
});

test('the HTML body escapes every dangerous character, including quotes', () => {
  const { html } = escalation.validateEscalation({
    email: 'a@b.com',
    message: `& < > " '`,
  });
  assert.ok(!/[<>]/.test(html.replace(/<\/?(p|br|div|strong|em|a|hr)\b[^>]*>/g, '')));
  assert.match(html, /&amp;/);
  assert.match(html, /&quot;|&#3[49];/);
});

test('newlines survive into the HTML as line breaks', () => {
  // A chat transcript is mostly newlines. Collapsing them turns a readable
  // complaint into one unbroken paragraph in the operator's inbox.
  const { html } = escalation.validateEscalation({
    email: 'a@b.com',
    message: 'line one\nline two',
  });
  assert.match(html, /line one<br>line two/);
});

// ── the subject ─────────────────────────────────────────────────────────────

test('the subject is prefixed and derived from the message', () => {
  const { subject } = escalation.validateEscalation({
    email: 'a@b.com',
    message: 'Where is my Hennessy order?',
  });
  assert.ok(subject.startsWith('[Chat escalation]'), subject);
  assert.match(subject, /Where is my Hennessy order\?/);
});

test('the subject is capped and single-line', () => {
  const { subject } = escalation.validateEscalation({
    email: 'a@b.com',
    message: `${'word '.repeat(80)}\nsecond line`,
  });
  assert.ok(subject.length <= escalation.MAX_SUBJECT_LENGTH, `subject was ${subject.length}`);
  assert.ok(!/[\r\n]/.test(subject), 'a newline reached the Subject header');
});

test('a message with no usable words still gets a subject', () => {
  const { subject } = escalation.validateEscalation({ email: 'a@b.com', message: '...' });
  assert.ok(subject.startsWith('[Chat escalation]'));
  assert.ok(subject.length > '[Chat escalation]'.length);
});

// ── the optional name ───────────────────────────────────────────────────────

test('a name is optional and stripped of control characters', () => {
  assert.strictEqual(escalation.validateEscalation({ email: 'a@b.com', message: 'x' }).name, '');
  const { name } = escalation.validateEscalation({
    email: 'a@b.com',
    message: 'x',
    name: '  Ada \n Lovelace  ',
  });
  assert.strictEqual(name, 'Ada Lovelace');
});

test('a non-string name is ignored rather than coerced', () => {
  assert.strictEqual(
    escalation.validateEscalation({ email: 'a@b.com', message: 'x', name: { a: 1 } }).name,
    ''
  );
});

// ── the send ────────────────────────────────────────────────────────────────

function stubDeps({ account, send } = {}) {
  return {
    firstAccount: async () => (account === undefined ? ACCOUNT : account),
    send: send ?? (async (...args) => {
      sends.push(args);
      return { messageId: '<1@test>', accepted: [ACCOUNT.address], rejected: [], partial: false };
    }),
  };
}

const ACCOUNT = { id: 'platform:support@test', address: 'support@test', displayName: 'Support' };
let sends = [];

test('the message is sent from the support mailbox to itself', async () => {
  sends = [];
  await escalation.escalate(
    { email: 'ada@example.com', message: 'help' },
    stubDeps()
  );
  const [account, input] = sends[0];
  assert.strictEqual(account.id, ACCOUNT.id);
  assert.strictEqual(input.to, ACCOUNT.address);
});

test('Reply-To is the customer, so Reply reaches them and not ourselves', async () => {
  sends = [];
  await escalation.escalate({ email: 'ada@example.com', message: 'help' }, stubDeps());
  const [, input] = sends[0];
  assert.strictEqual(input.replyTo, 'ada@example.com');
});

test('nothing is ever bcc-ed or cc-ed from a public endpoint', async () => {
  // The visitor controls every input here; an endpoint that can be talked into
  // adding recipients is an open relay with extra steps.
  sends = [];
  await escalation.escalate(
    { email: 'ada@example.com', message: 'help', cc: 'x@y.com', bcc: 'z@y.com', to: 'q@y.com' },
    stubDeps()
  );
  const [, input] = sends[0];
  assert.strictEqual(input.to, ACCOUNT.address);
  assert.ok(!input.cc, 'cc was carried through from the request body');
  assert.ok(!input.bcc, 'bcc was carried through from the request body');
});

test('the customer address is stated in the body as well as the header', async () => {
  // Reply-To is invisible in most clients' reading panes; an operator skimming
  // the message must still be able to see who wrote it.
  sends = [];
  await escalation.escalate({ email: 'ada@example.com', message: 'help' }, stubDeps());
  const [, input] = sends[0];
  assert.match(input.html, /ada@example\.com/);
  assert.match(input.text, /ada@example\.com/);
});

test('with no mailbox configured it fails loudly rather than reporting success', async () => {
  // Silently accepting an escalation nobody will ever read is worse than an
  // error: the visitor is told a human will get back to them.
  await assert.rejects(
    () => escalation.escalate({ email: 'a@b.com', message: 'help' }, stubDeps({ account: null })),
    /no support mailbox/i
  );
});

test('a validation failure sends nothing at all', async () => {
  sends = [];
  await assert.rejects(() => escalation.escalate({ email: 'nope', message: 'x' }, stubDeps()));
  assert.deepStrictEqual(sends, [], 'a refused escalation still reached the transport');
});

test('an SMTP failure propagates rather than being reported as sent', async () => {
  await assert.rejects(
    () =>
      escalation.escalate(
        { email: 'a@b.com', message: 'help' },
        stubDeps({
          send: async () => {
            throw new Error('SMTP said no');
          },
        })
      ),
    /SMTP said no/
  );
});
