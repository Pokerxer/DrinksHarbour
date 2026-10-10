const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildPageMeta, MAX_PAGE_LIMIT } = require('../services/posPage.service');

describe('buildPageMeta', () => {
  // The orders list used to infer completeness from `rows.length === 500` and
  // hard-clamp `limit` to 500. "Load all" asked for 2000, was silently given
  // 500, and cleared the truncation warning — so the user was told the data was
  // complete while looking at only the newest 500 receipts. Completeness has to
  // be a fact the server states, never a guess the client makes.
  test('a page shorter than the limit is complete', () => {
    const meta = buildPageMeta({ matched: 40, included: 40, limit: 500 });
    assert.equal(meta.truncated, false);
    assert.equal(meta.matched, 40);
    assert.equal(meta.included, 40);
  });

  test('a page that exactly fills the limit is not assumed complete', () => {
    // Exactly `limit` rows is ambiguous, and treating it as complete is how the
    // bug hid. The server knows the true count, so it decides.
    assert.equal(buildPageMeta({ matched: 500, included: 500, limit: 500 }).truncated, false);
    assert.equal(buildPageMeta({ matched: 501, included: 500, limit: 500 }).truncated, true);
  });

  test('more matched than included is partial', () => {
    const meta = buildPageMeta({ matched: 1234, included: 500, limit: 500 });
    assert.equal(meta.truncated, true);
    assert.equal(meta.missing, 734);
  });

  test('nothing matched is complete and not partial', () => {
    const meta = buildPageMeta({ matched: 0, included: 0, limit: 500 });
    assert.equal(meta.truncated, false);
    assert.equal(meta.missing, 0);
  });

  test('the reported limit is the one actually granted, never the one requested', () => {
    // If a client asks for more than the ceiling, the ceiling is what happened
    // and that is what the report must describe.
    const meta = buildPageMeta({ matched: 9000, included: 2000, limit: 99999 });
    assert.equal(meta.limit, MAX_PAGE_LIMIT);
    assert.equal(meta.truncated, true);
  });

  test('a negative missing count is impossible', () => {
    const meta = buildPageMeta({ matched: 10, included: 12, limit: 500 });
    assert.equal(meta.missing, 0);
  });

  test('the ceiling allows a real "load all" while staying bounded', () => {
    assert.ok(MAX_PAGE_LIMIT >= 2000, 'must outlast the old 2000 request');
    assert.ok(MAX_PAGE_LIMIT <= 5000, 'must stay a bounded page, not a dump');
  });
});
