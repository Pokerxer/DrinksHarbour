// Triage filters: "unread" and "needs reply".
//
// Both are IMAP SEARCH criteria, not client-side array filters, and that is the
// whole point — a mailbox holds far more mail than one page, so filtering the
// 25 envelopes we happened to fetch would answer "3 need a reply" when 300 do.
// What is asserted here is therefore the *criteria actually issued to the
// server*, plus the cache key that keeps two different filters from returning
// each other's results.
//
// A stub ImapFlow is injected into the module cache before imap.service loads,
// so the service under test is the real one and only the socket is fake.
// No test in this repo touches the network.

const test = require('node:test');
const assert = require('node:assert');

// ── stub transport ──────────────────────────────────────────────────────────

/** Every IMAP call made, in order. Search criteria land here verbatim. */
let commands = [];
let behaviour = {};

class FakeImapFlow {
  constructor(options) {
    this.options = options;
    this.usable = false;
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
    return [{ path: 'INBOX', name: 'INBOX', specialUse: undefined, flags: new Set() }];
  }
  async getMailboxLock(path) {
    commands.push(['select', path]);
    return { release() {} };
  }
  async search(query) {
    commands.push(['search', query]);
    return behaviour.uids ?? [];
  }
  // Never reached with an empty uid list, but present so a non-empty one does
  // not explode if a future test wants it.
  async *fetch() {}
}

const imapflowPath = require.resolve('imapflow');
require.cache[imapflowPath] = {
  id: imapflowPath,
  filename: imapflowPath,
  loaded: true,
  exports: { ImapFlow: FakeImapFlow },
};

const imap = require('../services/imap.service');

const ACCOUNT = {
  id: 'triage',
  imap: { host: 'mail.test', port: 993, secure: true, auth: { user: 'u', pass: 'p' } },
};

function reset() {
  commands = [];
  behaviour = {};
  imap.invalidate(ACCOUNT.id);
}

const lastSearch = () => commands.filter((c) => c[0] === 'search').pop()?.[1];

// ── searchQuery ─────────────────────────────────────────────────────────────

test('with no term and no filter it asks for everything', () => {
  assert.deepStrictEqual(imap.searchQuery('', {}), { all: true });
  assert.deepStrictEqual(imap.searchQuery(''), { all: true });
});

test('unanswered becomes SEARCH UNANSWERED, not a client-side filter', () => {
  assert.deepStrictEqual(imap.searchQuery('', { unanswered: true }), { answered: false });
});

test('unread becomes SEARCH UNSEEN', () => {
  assert.deepStrictEqual(imap.searchQuery('', { unread: true }), { seen: false });
});

test('a free-text term still spans from, subject and body', () => {
  assert.deepStrictEqual(imap.searchQuery('refund', {}), {
    or: [{ from: 'refund' }, { subject: 'refund' }, { body: 'refund' }],
  });
});

test('a term and a filter are ANDed, so search narrows within the filter', () => {
  // Both keys on one object is IMAP's implicit AND. Nesting the term under
  // `or` alongside `answered:false` at the top level is what makes
  // "unanswered AND (from|subject|body matches)" rather than a union.
  assert.deepStrictEqual(imap.searchQuery('refund', { unanswered: true }), {
    answered: false,
    or: [{ from: 'refund' }, { subject: 'refund' }, { body: 'refund' }],
  });
});

test('the two filters compose', () => {
  assert.deepStrictEqual(imap.searchQuery('', { unread: true, unanswered: true }), {
    seen: false,
    answered: false,
  });
});

test('falsy filter values do not add criteria', () => {
  assert.deepStrictEqual(imap.searchQuery('', { unread: false, unanswered: false }), {
    all: true,
  });
});

// ── listMessages issues them ────────────────────────────────────────────────

test('listMessages sends UNANSWERED to the server rather than filtering locally', async () => {
  reset();
  await imap.listMessages(ACCOUNT, { folder: 'INBOX', unanswered: true });
  assert.deepStrictEqual(lastSearch(), { answered: false });
});

test('listMessages sends UNSEEN for the unread filter', async () => {
  reset();
  await imap.listMessages(ACCOUNT, { folder: 'INBOX', unread: true });
  assert.deepStrictEqual(lastSearch(), { seen: false });
});

test('an unfiltered list still asks for everything', async () => {
  reset();
  await imap.listMessages(ACCOUNT, { folder: 'INBOX' });
  assert.deepStrictEqual(lastSearch(), { all: true });
});

test('total counts the whole filtered set, not the page', async () => {
  reset();
  // A filtered "Awaiting reply" count that only counted the current page would
  // under-report the backlog, which is the one number this filter exists for.
  behaviour.uids = [11, 12, 13, 14, 15, 16, 17];
  const result = await imap.listMessages(ACCOUNT, {
    folder: 'INBOX',
    unanswered: true,
    limit: 2,
  });
  assert.strictEqual(result.total, 7);
  assert.strictEqual(result.limit, 2);
});

// ── the cache must not confuse two filters ──────────────────────────────────

test('a filtered request does not return the unfiltered cached page', async () => {
  reset();
  behaviour.uids = [1, 2, 3];
  const all = await imap.listMessages(ACCOUNT, { folder: 'INBOX' });
  assert.strictEqual(all.total, 3);

  behaviour.uids = [3];
  const unanswered = await imap.listMessages(ACCOUNT, { folder: 'INBOX', unanswered: true });
  assert.strictEqual(
    unanswered.total,
    1,
    'the unanswered request was served from the unfiltered cache entry'
  );
  assert.deepStrictEqual(lastSearch(), { answered: false });
});

test('unread and unanswered do not share a cache entry either', async () => {
  reset();
  behaviour.uids = [1, 2];
  const unread = await imap.listMessages(ACCOUNT, { folder: 'INBOX', unread: true });
  assert.strictEqual(unread.total, 2);

  behaviour.uids = [9, 8, 7, 6];
  const unanswered = await imap.listMessages(ACCOUNT, { folder: 'INBOX', unanswered: true });
  assert.strictEqual(unanswered.total, 4);
});

test('an identical filtered request is still served from cache', async () => {
  reset();
  behaviour.uids = [1, 2, 3];
  await imap.listMessages(ACCOUNT, { folder: 'INBOX', unanswered: true });
  const before = commands.filter((c) => c[0] === 'search').length;
  await imap.listMessages(ACCOUNT, { folder: 'INBOX', unanswered: true });
  assert.strictEqual(
    commands.filter((c) => c[0] === 'search').length,
    before,
    'the repeat request re-hit the server'
  );
});

// ── the controller reads the query params ───────────────────────────────────

const controller = require('../controllers/mail.controller');

test('filtersFrom reads only the literal string "true"', () => {
  assert.deepStrictEqual(controller.filtersFrom({ unanswered: 'true' }), {
    unread: false,
    unanswered: true,
  });
  assert.deepStrictEqual(controller.filtersFrom({ unread: 'true' }), {
    unread: true,
    unanswered: false,
  });
  assert.deepStrictEqual(controller.filtersFrom({}), { unread: false, unanswered: false });
});

test('filtersFrom does not treat "false" or junk as on', () => {
  // A query string carries no booleans, so `unanswered=false` arrives as the
  // non-empty — and therefore truthy — string "false". Anything looser than an
  // exact match silently pins the inbox to a filter nobody asked for.
  assert.deepStrictEqual(controller.filtersFrom({ unanswered: 'false' }), {
    unread: false,
    unanswered: false,
  });
  assert.deepStrictEqual(controller.filtersFrom({ unanswered: '0' }), {
    unread: false,
    unanswered: false,
  });
  assert.deepStrictEqual(controller.filtersFrom({ unanswered: ['true'] }), {
    unread: false,
    unanswered: false,
  });
});
