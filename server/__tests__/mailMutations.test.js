// Delete must not destroy mail on the first click. Anywhere but Trash, delete
// is a move to Trash; only a message already in Trash is expunged. This is the
// difference between "undo it in the mail client" and "it is gone".
//
// The pure resolution rules are tested directly. The rest is driven through a
// stub ImapFlow, because the properties that matter here are not "the function
// returned" but "which IMAP command was issued, and was its answer believed":
// imapflow resolves a rejected STORE / MOVE / COPY / EXPUNGE to `false` instead
// of throwing, so a mutation that silently did not happen looks exactly like
// one that did. No test in this repo touches the network.

const test = require('node:test');
const assert = require('node:assert');

// ── stub transport ──────────────────────────────────────────────────────────

/** Every IMAP call the service makes, in order: ['move', range, destination]. */
let commands = [];
/** Per-test overrides for what the fake server does. */
let behaviour = {};

const DEFAULT_BOXES = [
  { path: 'INBOX', name: 'INBOX', specialUse: undefined, flags: new Set() },
  { path: 'INBOX.Archive', name: 'Archive', specialUse: '\\Archive', flags: new Set() },
  { path: 'INBOX.Trash', name: 'Trash', specialUse: '\\Trash', flags: new Set() },
  { path: 'INBOX.Sent', name: 'Sent', specialUse: '\\Sent', flags: new Set() },
];

class FakeImapFlow {
  constructor(options) {
    this.options = options;
    this.usable = false;
  }

  // Recomputed per access so a test can change the advertised capabilities
  // without needing a fresh pooled connection.
  get capabilities() {
    return new Map((behaviour.capabilities ?? ['MOVE']).map((name) => [name, true]));
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
    return behaviour.boxes ?? DEFAULT_BOXES;
  }
  async getMailboxLock(path) {
    commands.push(['select', path]);
    return { release() {} };
  }
  async messageFlagsAdd(range, flags) {
    commands.push(['flagsAdd', range, flags]);
    return behaviour.flagsAdd ?? true;
  }
  async messageFlagsRemove(range, flags) {
    commands.push(['flagsRemove', range, flags]);
    return behaviour.flagsRemove ?? true;
  }
  async messageMove(range, destination) {
    commands.push(['move', range, destination]);
    return behaviour.move ?? { path: 'INBOX', destination };
  }
  async messageCopy(range, destination) {
    commands.push(['copy', range, destination]);
    return behaviour.copy ?? { path: 'INBOX', destination };
  }
  async messageDelete(range) {
    commands.push(['expunge', range]);
    return behaviour.expunge ?? true;
  }
}

// Injected into the module cache before imap.service is loaded, so the service
// under test is the real one and only the socket is fake.
const imapflowPath = require.resolve('imapflow');
require.cache[imapflowPath] = {
  id: imapflowPath,
  filename: imapflowPath,
  loaded: true,
  exports: { ImapFlow: FakeImapFlow },
};

const imap = require('../services/imap.service');
const controller = require('../controllers/mail.controller');

const ACCOUNT = {
  id: 'support',
  imap: { host: 'mail.test', port: 993, secure: true, auth: { user: 'u', pass: 'p' } },
};

function reset() {
  commands = [];
  behaviour = {};
}

const issued = (verb) => commands.filter((c) => c[0] === verb);

// ── resolveDeleteTarget ─────────────────────────────────────────────────────

const FOLDERS = [
  { path: 'INBOX', specialUse: null },
  { path: 'INBOX.Archive', specialUse: '\\Archive' },
  { path: 'INBOX.Trash', specialUse: '\\Trash' },
];

test('deleting from the inbox moves to trash rather than expunging', () => {
  const target = imap.resolveDeleteTarget(FOLDERS, 'INBOX');
  assert.strictEqual(target.expunge, false);
  assert.strictEqual(target.trash, 'INBOX.Trash');
});

test('deleting from archive also moves to trash', () => {
  const target = imap.resolveDeleteTarget(FOLDERS, 'INBOX.Archive');
  assert.strictEqual(target.expunge, false);
  assert.strictEqual(target.trash, 'INBOX.Trash');
});

test('deleting from trash expunges', () => {
  const target = imap.resolveDeleteTarget(FOLDERS, 'INBOX.Trash');
  assert.strictEqual(target.expunge, true);
});

test('with no trash folder it expunges, because there is nowhere to move to', () => {
  const target = imap.resolveDeleteTarget([{ path: 'INBOX', specialUse: null }], 'INBOX');
  assert.strictEqual(target.expunge, true);
  assert.strictEqual(target.trash, null);
});

test('the INBOX token is case-insensitive, as RFC 3501 requires', () => {
  assert.strictEqual(imap.resolveDeleteTarget(FOLDERS, 'inbox.Trash').expunge, true);
  assert.strictEqual(imap.resolveDeleteTarget(FOLDERS, 'Inbox.Trash').expunge, true);
});

test('a case difference below INBOX misses towards a move, never towards an expunge', () => {
  // Only the INBOX token is case-folded; the rest is the server's own
  // case-sensitive namespace. Missing here costs a redundant move into Trash.
  // Matching wrongly would destroy mail, so the comparison must not be looser.
  assert.strictEqual(imap.resolveDeleteTarget(FOLDERS, 'INBOX.trash').expunge, false);
});

// ── the flag allowlist ──────────────────────────────────────────────────────

test('\\Deleted cannot be set through the flags API, in any casing', () => {
  for (const flag of ['\\Deleted', '\\deleted', '\\DELETED']) {
    assert.throws(() => imap.normalizeFlags([flag], 'add'), /may only contain/);
  }
});

test('unknown and custom flags are rejected', () => {
  assert.throws(() => imap.normalizeFlags(['$Junk'], 'add'), /may only contain/);
  assert.throws(() => imap.normalizeFlags(['\\Recent'], 'add'), /may only contain/);
});

test('a non-array flag list is rejected rather than coerced', () => {
  assert.throws(() => imap.normalizeFlags('\\Seen', 'add'), /must be an array/);
  assert.throws(() => imap.normalizeFlags({ 0: '\\Seen' }, 'add'), /must be an array/);
  assert.throws(() => imap.normalizeFlags([{}], 'add'), /may only contain/);
});

test('allowed flags are canonicalised and de-duplicated', () => {
  assert.deepStrictEqual(imap.normalizeFlags(['\\seen', '\\SEEN', '\\flagged'], 'add'), [
    '\\Seen',
    '\\Flagged',
  ]);
  assert.deepStrictEqual(imap.normalizeFlags(undefined, 'add'), []);
});

test('a sparse array cannot smuggle an unvalidated flag past the allowlist', () => {
  // Array#map SKIPS holes, so `new Array(1)` used to come out of normalizeFlags
  // as [undefined] with nothing having checked it — an unvalidated value handed
  // to a STORE. Array.from visits holes as undefined so they fail like any other
  // non-string. Not reachable through JSON, but this function is the value's
  // last checkpoint and must behave like one.
  assert.throws(() => imap.normalizeFlags(new Array(1), 'add'), /may only contain/);
  assert.throws(() => imap.normalizeFlags([, '\\Seen'], 'add'), /may only contain/);
});

test('setFlags refuses \\Deleted without issuing any command', async () => {
  reset();
  await assert.rejects(
    () => imap.setFlags(ACCOUNT, 'INBOX', [1], { add: ['\\Deleted'] }),
    (err) => err.code === 'EBADFLAG'
  );
  assert.deepStrictEqual(commands, [], 'a rejected flag still reached the server');
});

// ── mutations believe nothing they are not told ─────────────────────────────

test('setFlags issues a UID STORE and reports success only when the server agrees', async () => {
  reset();
  await imap.setFlags(ACCOUNT, 'INBOX', [7, 9], { add: ['\\Seen'], remove: ['\\Flagged'] });
  assert.deepStrictEqual(issued('flagsAdd'), [['flagsAdd', '7,9', ['\\Seen']]]);
  assert.deepStrictEqual(issued('flagsRemove'), [['flagsRemove', '7,9', ['\\Flagged']]]);
});

test('a rejected STORE throws instead of reporting "Flags updated"', async () => {
  reset();
  // imapflow returns false without throwing for an unresolvable UID, a
  // read-only mailbox, or a rejected STORE, and swallows the underlying error
  // into a logger this service disables.
  behaviour.flagsAdd = false;
  await assert.rejects(
    () => imap.setFlags(ACCOUNT, 'INBOX', [7], { add: ['\\Seen'] }),
    (err) => err.code === 'ESTOREFAILED'
  );
});

test('a rejected -FLAGS throws even though the +FLAGS succeeded', async () => {
  reset();
  behaviour.flagsRemove = false;
  await assert.rejects(
    () => imap.setFlags(ACCOUNT, 'INBOX', [7], { add: ['\\Seen'], remove: ['\\Flagged'] }),
    (err) => err.code === 'ESTOREFAILED'
  );
});

test('a uid that is not a positive integer never reaches an IMAP command', async () => {
  reset();
  for (const uids of [[1.5], [-1], [0], ['3'], [Number.MAX_SAFE_INTEGER + 2]]) {
    await assert.rejects(
      () => imap.setFlags(ACCOUNT, 'INBOX', uids, { add: ['\\Seen'] }),
      (err) => err.code === 'EBADUID'
    );
  }
  assert.deepStrictEqual(issued('flagsAdd'), []);
});

test('a uid above the 32-bit range is refused, not passed through', async () => {
  // RFC 3501 §2.3.1.1 makes UIDs 32-bit unsigned. 4294967296 is a safe integer,
  // so the isSafeInteger check alone let it compile into a real sequence-set.
  reset();
  await assert.rejects(
    () => imap.setFlags(ACCOUNT, 'INBOX', [4294967296], { add: ['\\Seen'] }),
    (err) => err.code === 'EBADUID'
  );
  assert.strictEqual(imap.normalizeMailboxPath('INBOX'), 'INBOX'); // sanity
  assert.deepStrictEqual(issued('flagsAdd'), []);
  assert.throws(() => controller.parseUids('4294967296'), /Invalid message id/);
  assert.deepStrictEqual(controller.parseUids('4294967295'), [4294967295]);
});

test('a sparse uid array cannot compile into a sequence-set', async () => {
  // Array#map skips holes and join() renders each as "", so `new Array(2)` used
  // to reach the server as the sequence-set ",".
  reset();
  await assert.rejects(
    () => imap.setFlags(ACCOUNT, 'INBOX', new Array(2), { add: ['\\Seen'] }),
    (err) => err.code === 'EBADUID'
  );
  assert.deepStrictEqual(issued('flagsAdd'), []);
});

test('a second \\Trash folder degrades to a move, never a surprise expunge', () => {
  // specialFolder() takes the first match. Deleting from a mailbox that also
  // carries \Trash but is not the resolved one must not expunge it blindly.
  const twoTrash = [
    { path: 'INBOX', specialUse: null },
    { path: 'INBOX.Trash', specialUse: '\\Trash' },
    { path: 'INBOX.Deleted Items', specialUse: '\\Trash' },
  ];
  assert.strictEqual(imap.resolveDeleteTarget(twoTrash, 'INBOX.Trash').expunge, true);
  const second = imap.resolveDeleteTarget(twoTrash, 'INBOX.Deleted Items');
  assert.strictEqual(second.expunge, false);
  assert.strictEqual(second.trash, 'INBOX.Trash');
});

test('the manual COPY, its check and the EXPUNGE all run under one mailbox lock', async () => {
  // If the lock were released between the COPY and the delete, another request
  // could SELECT a different mailbox on the same connection and the EXPUNGE
  // would land somewhere else entirely.
  reset();
  behaviour.capabilities = [];
  const locks = [];
  const realLock = FakeImapFlow.prototype.getMailboxLock;
  FakeImapFlow.prototype.getMailboxLock = async function (path) {
    commands.push(['select', path]);
    return { release() { commands.push(['release', path]); } };
  };
  try {
    await imap.deleteMessages(ACCOUNT, 'INBOX', [5]);
  } finally {
    FakeImapFlow.prototype.getMailboxLock = realLock;
  }
  const seq = commands.filter((c) => ['select', 'copy', 'expunge', 'release'].includes(c[0])).map((c) => c[0]);
  const open = seq.lastIndexOf('select');
  const close = seq.indexOf('release', open);
  assert.ok(open !== -1 && close !== -1, 'no lock was taken');
  assert.ok(seq.indexOf('copy') > open && seq.indexOf('copy') < close, 'COPY ran outside the lock');
  assert.ok(seq.indexOf('expunge') > open && seq.indexOf('expunge') < close, 'EXPUNGE ran outside the lock');
  assert.strictEqual(locks.length, 0);
});

// ── delete ──────────────────────────────────────────────────────────────────

test('deleting from the inbox issues a MOVE to Trash and never an EXPUNGE', async () => {
  reset();
  const result = await imap.deleteMessages(ACCOUNT, 'INBOX', [11, 12]);
  assert.deepStrictEqual(result, { expunged: false, movedTo: 'INBOX.Trash' });
  assert.deepStrictEqual(issued('move'), [['move', '11,12', 'INBOX.Trash']]);
  assert.deepStrictEqual(issued('expunge'), [], 'mail was destroyed on the first delete');
});

test('deleting from Trash expunges', async () => {
  reset();
  const result = await imap.deleteMessages(ACCOUNT, 'INBOX.Trash', [3]);
  assert.deepStrictEqual(result, { expunged: true, movedTo: null });
  assert.deepStrictEqual(issued('expunge'), [['expunge', '3']]);
  assert.deepStrictEqual(issued('move'), []);
});

test('a rejected MOVE throws rather than claiming the mail is in Trash', async () => {
  reset();
  behaviour.move = false;
  await assert.rejects(
    () => imap.deleteMessages(ACCOUNT, 'INBOX', [11]),
    (err) => err.code === 'EMOVEFAILED'
  );
});

test('a rejected EXPUNGE throws rather than claiming the mail is gone', async () => {
  reset();
  behaviour.expunge = false;
  await assert.rejects(
    () => imap.deleteMessages(ACCOUNT, 'INBOX.Trash', [3]),
    (err) => err.code === 'EDELETEFAILED'
  );
});

test('a folder the server does not have is refused before any mailbox is selected', async () => {
  reset();
  await assert.rejects(
    () => imap.deleteMessages(ACCOUNT, 'INBOX.Nope', [1]),
    (err) => err.code === 'ENOFOLDER'
  );
  assert.deepStrictEqual(issued('select'), []);
});

test('an account with no Trash folder expunges, because there is nowhere to move to', async () => {
  reset();
  behaviour.boxes = [{ path: 'INBOX', name: 'INBOX', specialUse: undefined, flags: new Set() }];
  const result = await imap.deleteMessages(ACCOUNT, 'INBOX', [4]);
  assert.deepStrictEqual(result, { expunged: true, movedTo: null });
});

// ── servers without RFC 6851 MOVE ───────────────────────────────────────────

test('without MOVE support a failed COPY must not be followed by a delete', async () => {
  reset();
  // imapflow's own MOVE emulation runs COPY then deletes the source
  // unconditionally, so a COPY that fails still expunges the originals and the
  // mail is gone. The service does the emulation itself for exactly this.
  behaviour.capabilities = [];
  behaviour.copy = false;
  await assert.rejects(
    () => imap.deleteMessages(ACCOUNT, 'INBOX', [11]),
    (err) => err.code === 'ECOPYFAILED'
  );
  assert.deepStrictEqual(issued('copy'), [['copy', '11', 'INBOX.Trash']]);
  assert.deepStrictEqual(issued('expunge'), [], 'the source was destroyed after a failed copy');
});

test('without MOVE support a successful COPY is followed by the delete', async () => {
  reset();
  behaviour.capabilities = [];
  const result = await imap.deleteMessages(ACCOUNT, 'INBOX', [11]);
  assert.deepStrictEqual(result, { expunged: false, movedTo: 'INBOX.Trash' });
  assert.deepStrictEqual(commands.filter((c) => c[0] === 'copy' || c[0] === 'expunge'), [
    ['copy', '11', 'INBOX.Trash'],
    ['expunge', '11'],
  ]);
});

// ── move ────────────────────────────────────────────────────────────────────

test('a destination that is not a real mailbox is refused', async () => {
  reset();
  await assert.rejects(
    () => imap.moveMessages(ACCOUNT, 'INBOX', [1], 'INBOX.Elsewhere'),
    (err) => err.code === 'ENOFOLDER'
  );
  assert.deepStrictEqual(issued('select'), []);
});

test('a move resolves the destination to the server\'s own spelling', async () => {
  reset();
  const to = await imap.moveMessages(ACCOUNT, 'inbox', [1], 'inbox.Archive');
  assert.strictEqual(to, 'INBOX.Archive');
  assert.deepStrictEqual(issued('move'), [['move', '1', 'INBOX.Archive']]);
});

test('moving a message into the folder it is already in is a no-op', async () => {
  reset();
  const to = await imap.moveMessages(ACCOUNT, 'INBOX', [1], 'inbox');
  assert.strictEqual(to, 'INBOX');
  assert.deepStrictEqual(issued('move'), []);
  assert.deepStrictEqual(issued('expunge'), []);
});

// ── request parsing ─────────────────────────────────────────────────────────

test('uid parsing rejects anything a parseInt would have silently truncated', () => {
  for (const input of ['12abc', '-1', '0', '1.5', 'x', '', undefined, null, {}, ['1', 'a']]) {
    assert.throws(() => controller.parseUids(input), /Invalid message id|No messages selected/);
  }
});

test('uid parsing accepts both a comma string and an array of numbers', () => {
  assert.deepStrictEqual(controller.parseUids('4,5,6'), [4, 5, 6]);
  assert.deepStrictEqual(controller.parseUids([4, 5, 6]), [4, 5, 6]);
  assert.deepStrictEqual(controller.parseUids(' 4 , 5 '), [4, 5]);
});

test('a uid list is capped so one request cannot address a whole mailbox', () => {
  const many = Array.from({ length: 201 }, (_, i) => i + 1);
  assert.throws(() => controller.parseUids(many), /at most 200/);
  assert.strictEqual(controller.parseUids(many.slice(0, 200)).length, 200);
});

test('a non-string folder is rejected, not defaulted to INBOX', () => {
  // qs turns ?folder[]=a&folder[]=b into an array and ?folder[x]=y into an
  // object; a JSON body can carry any type at all. Defaulting a mutation's
  // folder would apply the change to a mailbox the caller never named.
  for (const value of [['a', 'b'], { x: 'y' }, 7, true]) {
    assert.throws(() => controller.folderFrom(value), /Invalid folder/);
  }
  assert.strictEqual(controller.folderFrom(undefined), 'INBOX');
  assert.strictEqual(controller.folderFrom(''), 'INBOX');
  assert.strictEqual(controller.folderFrom('INBOX.Sent'), 'INBOX.Sent');
});

test.after(() => imap.closeAll());
