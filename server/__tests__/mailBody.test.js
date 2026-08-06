// Message bodies are attacker-controlled HTML from strangers. Two independent
// layers keep them contained: this sanitizer, and a sandboxed iframe on the
// client. These tests pin the server layer.
//
// Remote images are stripped by default as well — loading them on open fires
// the sender's tracking pixel and leaks the reader's IP address.

const test = require('node:test');
const assert = require('node:assert');

const {
  sanitizeBody,
  parseMessage,
  attachmentHeaders,
  contentDispositionFor,
  safeContentType,
} = require('../services/mailBody.service');

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
  // The per-image marker has to outlive attribute filtering, or the reading
  // pane cannot draw a placeholder where the blocked image was.
  assert.ok(html.includes('data-blocked-remote="true"'), 'blocked marker was stripped');
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

// The attachment filename and content type are both written by the sender.
// They end up in response headers, so they are a header-injection and a
// stored-XSS surface respectively, and a non-ASCII name makes Node's own
// setHeader throw (ERR_INVALID_CHAR) unless it is transliterated first.

test('attachment headers carry a non-ASCII filename without breaking the header', () => {
  const headers = attachmentHeaders({
    filename: 'rapport été.pdf',
    contentType: 'application/pdf',
  });
  const cd = headers['Content-Disposition'];
  assert.ok(!/[^\x20-\x7e]/.test(cd), 'non-ASCII byte reached the header value');
  assert.ok(cd.includes('filename="rapport _t_.pdf"'), `unexpected fallback: ${cd}`);
  assert.ok(
    cd.includes("filename*=UTF-8''rapport%20%C3%A9t%C3%A9.pdf"),
    `missing RFC 5987 form: ${cd}`
  );
  assert.strictEqual(headers['Content-Type'], 'application/pdf');
});

test('attachment headers neutralise a hostile filename and content type', () => {
  const headers = attachmentHeaders({
    filename: '../../secret\\pay"load\r\nX-Injected: yes.pdf',
    contentType: 'text/html; charset=utf-8',
  });
  const cd = headers['Content-Disposition'];
  assert.ok(!/[\r\n]/.test(cd), 'header injection survived');
  // Count the quotes before extracting. `/filename="([^"]*)"/` alone stops at
  // the first INNER quote, so if the escaping regressed it would capture only
  // the harmless prefix and this test would pass while the header was broken
  // out of. Exactly two quotes in the whole value is the real invariant.
  assert.strictEqual(
    (cd.match(/"/g) || []).length,
    2,
    `quoted-string was escaped out of: ${cd}`
  );
  const ascii = /filename="([^"]*)"/.exec(cd)[1];
  assert.ok(!/["\\/]/.test(ascii), `quote or path separator survived: ${ascii}`);
  // Active content served from the API origin is a stored-XSS vector even with
  // an attachment disposition, so it is downgraded and sniffing is forbidden.
  assert.strictEqual(headers['Content-Type'], 'application/octet-stream');
  assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
  assert.ok(/default-src 'none'/.test(headers['Content-Security-Policy']));
});

// ── regression cover for the Task 4 review ──────────────────────────────────
//
// Each of these pins a protection that a mutation survived: removing the
// guard left the suite green, which means the guard was load-bearing but
// unowned. See .superpowers/sdd/progress.md, Task 4 review.

test('a srcless img is not counted as a blocked remote image', () => {
  // Spacer/shim <img> tags are everywhere in real marketing mail and fetch
  // nothing. Counting them makes the reading pane offer to "show" images that
  // do not exist.
  for (const html of ['<img>', '<img alt="spacer">', '<img src="">']) {
    const { blockedRemoteImages } = sanitizeBody(html, {});
    assert.strictEqual(blockedRemoteImages, 0, `counted a srcless img: ${html}`);
  }
  const { blockedRemoteImages } = sanitizeBody('<img src="https://t.test/p.gif">', {});
  assert.strictEqual(blockedRemoteImages, 1, 'a real remote image was not counted');
});

test('positioning styles cannot escape the message body', () => {
  // The allowedStyles allowlist is what stops a message covering the admin UI
  // with an absolutely-positioned overlay. It had no test at all.
  const { html } = sanitizeBody(
    '<div style="position:fixed;top:0;left:0;z-index:9999;color:red">x</div>',
    {}
  );
  assert.ok(!/position/i.test(html), `position survived: ${html}`);
  assert.ok(!/z-index/i.test(html), `z-index survived: ${html}`);
  assert.ok(/color:\s*red/i.test(html), 'the allowlisted property was dropped too');
});

test('protocol-relative image URLs are treated as remote, not embedded', () => {
  const { html, blockedRemoteImages } = sanitizeBody('<img src="//tracker.test/p.gif">', {});
  assert.strictEqual(blockedRemoteImages, 1);
  assert.ok(!html.includes('tracker.test'), `protocol-relative src survived: ${html}`);
});

test('a filename of only dots cannot become a path', () => {
  for (const name of ['..', '.', '...', '../../etc/passwd']) {
    const cd = contentDispositionFor(name);
    const ascii = /filename="([^"]*)"/.exec(cd)[1];
    assert.ok(!/^\.+$/.test(ascii), `dot-only name survived: ${ascii}`);
    assert.ok(!ascii.includes('/'), `path separator survived: ${ascii}`);
  }
});

test('an unparseable content type falls back to octet-stream', () => {
  for (const bad of ['', null, undefined, 'not a mime type', 'text/html', 'TEXT/HTML', 'image/svg+xml']) {
    assert.strictEqual(
      safeContentType(bad),
      'application/octet-stream',
      `passed through: ${bad}`
    );
  }
  assert.strictEqual(safeContentType('application/pdf; charset=x'), 'application/pdf');
});
