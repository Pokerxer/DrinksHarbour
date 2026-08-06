// Snippets are canned replies an operator drops into a live message. Whatever
// survives validation here is HTML that will later be posted to a real SMTP
// server over an admin's signature, so the body is sanitized on the way IN
// rather than on the way out: a snippet is written once and sent hundreds of
// times, and a sanitizer applied only at send time would leave the stored copy
// dangerous for every other consumer (the editor, a preview, an export).
//
// Pure validation only — no database and no network. The model is never loaded.

const test = require('node:test');
const assert = require('node:assert');

const svc = require('../services/snippet.service');

// ── body sanitisation ───────────────────────────────────────────────────────

test('keeps the formatting a Quill editor actually produces', () => {
  const body = svc.sanitizeSnippetBody(
    '<p>Hi <strong>there</strong>, see <a href="https://drinksharbour.com">our shop</a>.</p>' +
      '<ul><li>One</li><li>Two</li></ul>'
  );
  assert.ok(body.includes('<strong>there</strong>'));
  assert.ok(body.includes('href="https://drinksharbour.com"'));
  assert.ok(body.includes('<li>One</li>'));
});

test('strips script tags and inline event handlers', () => {
  const body = svc.sanitizeSnippetBody(
    '<p onclick="steal()">Hello</p><script>alert(1)</script><img src="x" onerror="alert(1)">'
  );
  assert.ok(!/script/i.test(body), 'script survived');
  assert.ok(!/onclick/i.test(body), 'event handler survived');
  assert.ok(!/onerror/i.test(body), 'event handler survived');
  assert.ok(body.includes('Hello'));
});

test('refuses a javascript: link rather than storing it', () => {
  const body = svc.sanitizeSnippetBody('<a href="javascript:alert(1)">click</a>');
  assert.ok(!/javascript:/i.test(body), 'javascript: url survived');
});

test('a body that is only markup is refused, not silently stored empty', () => {
  // "<script>…</script>" sanitizes to nothing. Storing an empty snippet would
  // give the operator a menu entry that inserts nothing at all.
  assert.throws(() => svc.sanitizeSnippetBody('<script>alert(1)</script>'), /body/i);
  assert.throws(() => svc.sanitizeSnippetBody('   '), /body/i);
  assert.throws(() => svc.sanitizeSnippetBody(undefined), /body/i);
});

test('refuses a body past the size cap', () => {
  assert.throws(
    () => svc.sanitizeSnippetBody(`<p>${'a'.repeat(svc.MAX_BODY_LENGTH + 1)}</p>`),
    /too long/i
  );
});

// ── tags ────────────────────────────────────────────────────────────────────

test('tags are trimmed, lowercased and de-duplicated', () => {
  assert.deepStrictEqual(
    svc.normalizeTags([' Refund ', 'refund', 'SHIPPING', '', '   ']),
    ['refund', 'shipping']
  );
});

test('tags accept a comma-separated string as well as an array', () => {
  assert.deepStrictEqual(svc.normalizeTags('refund, shipping'), ['refund', 'shipping']);
});

test('tags default to empty and refuse non-string entries', () => {
  assert.deepStrictEqual(svc.normalizeTags(undefined), []);
  assert.deepStrictEqual(svc.normalizeTags(null), []);
  assert.throws(() => svc.normalizeTags([{ a: 1 }]), /tag/i);
});

test('refuses more tags than the cap, and an over-long tag', () => {
  const many = Array.from({ length: svc.MAX_TAGS + 1 }, (_, i) => `tag${i}`);
  assert.throws(() => svc.normalizeTags(many), /at most/i);
  assert.throws(() => svc.normalizeTags(['x'.repeat(41)]), /too long/i);
});

// ── whole payloads ──────────────────────────────────────────────────────────

test('a valid payload yields exactly title, body and tags', () => {
  const fields = svc.validateSnippet({
    title: '  Refund policy  ',
    body: '<p>We refund within 14 days.</p>',
    tags: ['Refund'],
    createdBy: 'not-your-decision',
  });
  assert.deepStrictEqual(Object.keys(fields).sort(), ['body', 'tags', 'title']);
  assert.strictEqual(fields.title, 'Refund policy');
  assert.deepStrictEqual(fields.tags, ['refund']);
});

test('a missing or non-string title is refused', () => {
  for (const title of [undefined, null, '', '   ', 42, ['a']]) {
    assert.throws(
      () => svc.validateSnippet({ title, body: '<p>x</p>' }),
      /title/i,
      `accepted ${String(title)}`
    );
  }
});

test('refuses a title past the length cap', () => {
  assert.throws(
    () => svc.validateSnippet({ title: 'x'.repeat(svc.MAX_TITLE_LENGTH + 1), body: '<p>x</p>' }),
    /too long/i
  );
});

test('a patch only carries the fields it was given', () => {
  // Sending {title} alone must not blank the body — findByIdAndUpdate with an
  // undefined body would, and a half-written snippet is worse than a rejected
  // edit because it is discovered mid-reply.
  const patch = svc.validateSnippetPatch({ title: 'New title' });
  assert.deepStrictEqual(patch, { title: 'New title' });

  const bodyOnly = svc.validateSnippetPatch({ body: '<p>Updated</p>' });
  assert.deepStrictEqual(Object.keys(bodyOnly), ['body']);
  assert.ok(bodyOnly.body.includes('Updated'));
});

test('an empty patch is refused rather than issuing a no-op write', () => {
  assert.throws(() => svc.validateSnippetPatch({}), /nothing to update/i);
  assert.throws(() => svc.validateSnippetPatch({ createdBy: 'x' }), /nothing to update/i);
});

test('a patch validates the fields it does carry', () => {
  assert.throws(() => svc.validateSnippetPatch({ title: '   ' }), /title/i);
  assert.throws(() => svc.validateSnippetPatch({ body: '<script>x</script>' }), /body/i);
});
