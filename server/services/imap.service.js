// services/imap.service.js
//
// Every IMAP verb the mail client needs, and nothing about HTTP or users.
//
// Two things drive the shape of this module:
//
//   1. IMAP is stateful. One command may be in flight per connection, and the
//      "currently selected mailbox" is connection-global. ImapFlow's
//      getMailboxLock() serializes both, so every folder operation goes
//      through withMailbox() and nothing touches client.* directly.
//
//   2. Nothing here persists. The envelope cache is in-process memory with a
//      30s TTL, dropped on any mutation. There is no Mongo model for mail and
//      there must never be one.

const { ImapFlow } = require('imapflow');

const ENVELOPE_CACHE_TTL_MS = 30_000;
const IDLE_CLOSE_MS = 5 * 60_000;

/** accountId -> { client, connecting, idleTimer } */
const pool = new Map();
/** cacheKey -> { at, value } */
const envelopeCache = new Map();

// ── connection pool ─────────────────────────────────────────────────────────

function scheduleIdleClose(accountId) {
  const entry = pool.get(accountId);
  if (!entry) return;
  clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => closeConnection(accountId), IDLE_CLOSE_MS);
  entry.idleTimer.unref?.();
}

/**
 * Closes one pool entry. `entry` may be a stale entry that has already been
 * superseded in `pool` by a newer connection attempt (the reconnect path in
 * getClient does exactly this) — in that case we still log the old client
 * out, but we must not delete whatever entry is now current for the account.
 */
async function closeConnection(accountId, entry) {
  const target = entry ?? pool.get(accountId);
  if (!target) return;
  if (pool.get(accountId) === target) pool.delete(accountId);
  clearTimeout(target.idleTimer);
  try {
    await target.client?.logout();
  } catch {
    // The connection is being discarded either way; a failure to log out
    // cleanly is not worth surfacing to the caller.
  }
}

async function getClient(account) {
  const existing = pool.get(account.id);
  if (existing?.connecting) return existing.connecting;
  if (existing?.client?.usable) {
    scheduleIdleClose(account.id);
    return existing.client;
  }

  // `existing`, if present, is a stale entry: usable === false and
  // connecting === null (e.g. mid-teardown after a socket error, before its
  // own close/error handler has run). We claim the pool slot for a fresh
  // connection attempt *synchronously*, before awaiting anything below, so a
  // concurrent getClient() call for this account sees `connecting` set on
  // the very next turn and coalesces onto this attempt instead of racing to
  // build its own client — which would otherwise orphan one of the two.
  const entry = { client: null, connecting: null, idleTimer: null };
  pool.set(account.id, entry);

  entry.connecting = (async () => {
    if (existing) await closeConnection(account.id, existing);

    const client = new ImapFlow({
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.secure,
      // Defensive copy: `account.imap.auth` is a live reference into a
      // module-level cache shared by every caller in the process. Nothing in
      // this file mutates it, but handing the original object to a
      // third-party dependency would let it do so.
      auth: { ...account.imap.auth },
      logger: false,
      // A hung mail server must fail fast and loudly rather than leaving the
      // inbox spinning — an empty inbox that is really an outage is the exact
      // failure mode this feature must not have.
      socketTimeout: 30_000,
      greetingTimeout: 15_000,
    });

    // These handlers must only ever tear down *this* client's own pool
    // entry, never whatever entry happens to be current for the account. A
    // client superseded by a newer connection attempt can still fire a late
    // 'error' or 'close' event; without the identity check below that event
    // would close out a healthy connection another caller may be mid-
    // operation on.
    client.on('error', () => {
      if (pool.get(account.id) === entry) closeConnection(account.id, entry);
    });
    client.on('close', () => {
      if (pool.get(account.id) === entry) pool.delete(account.id);
    });

    await client.connect();
    entry.client = client;
    entry.connecting = null;
    scheduleIdleClose(account.id);
    return client;
  })().catch((err) => {
    if (pool.get(account.id) === entry) pool.delete(account.id);
    throw err;
  });

  return entry.connecting;
}

/** Runs fn against a client with `folder` selected and locked. */
async function withMailbox(account, folder, fn) {
  const client = await getClient(account);
  const lock = await client.getMailboxLock(folder);
  try {
    return await fn(client);
  } finally {
    lock.release();
    scheduleIdleClose(account.id);
  }
}

async function closeAll() {
  // Not `.map(closeConnection)`: Array#map also passes the index and the
  // array itself, and closeConnection's second parameter is the pool entry
  // to close, not an index — passing it through by accident would make
  // every call but the first silently skip logging its client out.
  await Promise.all([...pool.keys()].map((accountId) => closeConnection(accountId)));
  envelopeCache.clear();
}

// ── pure helpers (unit-tested without a connection) ─────────────────────────

/** Resolves a SPECIAL-USE flag to a folder path, or null. Names vary by server. */
function specialFolder(folders, use) {
  return folders.find((f) => f.specialUse === use)?.path ?? null;
}

const firstAddress = (list) => {
  const entry = Array.isArray(list) ? list[0] : null;
  return { name: entry?.name || '', address: entry?.address || '' };
};

const addressList = (list) =>
  (Array.isArray(list) ? list : []).map((a) => ({ name: a?.name || '', address: a?.address || '' }));

/**
 * True when the message carries a real attachment. Inline parts (the images a
 * newsletter references from its own HTML) are excluded — flagging those puts
 * a paperclip on nearly every marketing email and makes the icon meaningless.
 */
function hasAttachments(node) {
  if (!node) return false;
  if (node.disposition === 'attachment') return true;
  return (node.childNodes || []).some(hasAttachments);
}

/** Flattens one IMAP message into the envelope the UI consumes. */
function mapEnvelope(raw, folder) {
  const env = raw.envelope || {};
  const flags = raw.flags || new Set();
  return {
    uid: raw.uid,
    folder,
    subject: env.subject || '(no subject)',
    from: firstAddress(env.from),
    to: addressList(env.to),
    date: env.date || raw.internalDate || null,
    seen: flags.has('\\Seen'),
    flagged: flags.has('\\Flagged'),
    answered: flags.has('\\Answered'),
    hasAttachments: hasAttachments(raw.bodyStructure),
    preview: raw.preview || '',
    messageId: env.messageId || null,
    inReplyTo: env.inReplyTo || null,
    references: env.references ? String(env.references).trim().split(/\s+/) : [],
  };
}

// ── folder + envelope reads ─────────────────────────────────────────────────

async function listFolders(account) {
  const client = await getClient(account);
  const folders = await client.list();
  const withCounts = await Promise.all(
    folders
      .filter((f) => !f.flags?.has?.('\\Noselect'))
      .map(async (f) => {
        let status = { messages: 0, unseen: 0 };
        try {
          status = await client.status(f.path, { messages: true, unseen: true });
        } catch {
          // A folder we cannot STATUS still belongs in the list; showing it
          // with zero counts beats hiding a folder that holds mail.
        }
        return {
          path: f.path,
          name: f.name,
          specialUse: f.specialUse || null,
          total: status.messages || 0,
          unseen: status.unseen || 0,
        };
      })
  );
  scheduleIdleClose(account.id);
  return withCounts;
}

/**
 * Builds an ESEARCH query from a free-text term and the triage filters.
 *
 * The filters are server-side criteria on purpose. A mailbox holds far more
 * mail than the 25 envelopes one page fetches, so filtering the fetched array
 * instead would answer "3 need a reply" when the backlog is 300 — and would
 * page through a list whose length changed under it.
 *
 * Criteria sit as sibling keys, which is IMAP's implicit AND: a term combined
 * with `unanswered` searches *within* the unanswered set rather than unioning
 * with it.
 */
const searchQuery = (term, filter = {}) => {
  const query = {};
  if (filter.unread) query.seen = false;
  if (filter.unanswered) query.answered = false;
  if (term) query.or = [{ from: term }, { subject: term }, { body: term }];
  return Object.keys(query).length ? query : { all: true };
};

// `folder` and `search` are arbitrary text (a server-supplied path and a
// user-typed query respectively) and may contain the `|` delimiter used to
// join cache-key fields below. encodeURIComponent escapes `|` out of every
// field it's applied to, so two logically distinct requests can never
// collide onto the same key, and an accountId that is a textual prefix of
// another (e.g. "abc" vs "abc123") can never satisfy `startsWith` for the
// wrong account — the encoded id can't contain the `|` that follows it.
const cacheField = (value) => encodeURIComponent(String(value));

function invalidate(accountId) {
  const prefix = `${cacheField(accountId)}|`;
  for (const key of envelopeCache.keys()) {
    if (key.startsWith(prefix)) envelopeCache.delete(key);
  }
}

async function listMessages(
  account,
  { folder, page = 1, limit = 25, search = '', unread = false, unanswered = false }
) {
  // The filters are part of the key. Without them an "unanswered" request made
  // seconds after an unfiltered one would be served the unfiltered page and
  // quietly show answered mail under a "Needs reply" heading.
  const cacheKey = [
    cacheField(account.id),
    cacheField(folder),
    page,
    limit,
    cacheField(search),
    unread ? 'unread' : '',
    unanswered ? 'unanswered' : '',
  ].join('|');
  const hit = envelopeCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ENVELOPE_CACHE_TTL_MS) return hit.value;

  const value = await withMailbox(account, folder, async (client) => {
    const uids = await client.search(searchQuery(search, { unread, unanswered }), { uid: true });
    const newestFirst = [...uids].sort((a, b) => b - a);
    const start = (page - 1) * limit;
    const pageUids = newestFirst.slice(start, start + limit);

    const items = [];
    if (pageUids.length) {
      for await (const msg of client.fetch(
        pageUids.join(','),
        { uid: true, envelope: true, flags: true, bodyStructure: true },
        { uid: true }
      )) {
        items.push(mapEnvelope(msg, folder));
      }
      // fetch() returns in server order; restore newest-first for the UI.
      items.sort((a, b) => pageUids.indexOf(a.uid) - pageUids.indexOf(b.uid));
    }
    return { items, total: uids.length, page, limit };
  });

  envelopeCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

// ── single-message reads ────────────────────────────────────────────────────

/**
 * The largest message this server will pull into memory.
 *
 * Everything downstream of fetchRaw is buffered and synchronous: the raw source
 * is held whole, simpleParser materialises every attachment again alongside it,
 * and sanitizeHtml blocks the event loop for the duration (a 5.7MB HTML part
 * measured at ~1.5s of hard block). The sender chooses the size, so without a
 * cap any stranger can post a 50MB message and stall or OOM the whole process —
 * which also serves the storefront — with a single admin click. 25MB is above
 * the attachment limit of every mail host this talks to.
 */
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

/**
 * Fetches one message's raw RFC822 source. Returns null if the UID is gone.
 *
 * Size is checked with a separate metadata FETCH first. RFC822.SIZE costs one
 * cheap round trip and is the only way to refuse an oversized message *before*
 * its bytes are already in this process — checking `source.length` afterwards
 * would be measuring the damage rather than preventing it.
 */
async function fetchRaw(account, folder, uid) {
  return withMailbox(account, folder, async (client) => {
    // fetchOne resolves to `false` (not a throw) when nothing matches the UID,
    // which is the normal outcome for a message another client has already
    // moved or deleted.
    const meta = await client.fetchOne(String(uid), { size: true }, { uid: true });
    if (!meta) return null;

    if (Number(meta.size) > MAX_MESSAGE_BYTES) {
      // Tagged rather than an AppError: this module deliberately knows nothing
      // about HTTP. mail.controller's mailError() maps the code to a 413.
      const err = new Error(`Message ${uid} is ${meta.size} bytes (limit ${MAX_MESSAGE_BYTES})`);
      err.code = 'EMSGTOOLARGE';
      throw err;
    }

    const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
    return message?.source || null;
  });
}

/**
 * Marks a message \Seen. Safe to call when it already is.
 *
 * Returns whether the STORE *succeeded*, which is not the same as whether the
 * flag changed: imapflow's own contract is "true on success, false on failure
 * or if nothing to do", so an already-seen message also returns true. There is
 * no way to distinguish "changed" from "was already set" through this API, and
 * callers must not claim otherwise.
 *
 * The failure direction is the one that matters. imapflow returns false —
 * *without throwing* — when the UID does not resolve, when the mailbox is
 * read-only (\Seen missing from permanentFlags), or when the STORE itself
 * errors; in that last case it swallows the exception into connection.log.warn,
 * which this module discards by constructing the client with `logger: false`.
 * A caller's try/catch therefore never fires for a rejected STORE. So the
 * warning is logged here instead: a mailbox where flagging is persistently
 * broken must not be silent on the server, which is exactly the shape of the
 * mail outage this codebase has already shipped once.
 */
async function markSeen(account, folder, uid) {
  const stored = await withMailbox(account, folder, (client) =>
    client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
  );
  if (stored !== true) {
    console.warn(
      `[mail] STORE \\Seen rejected for uid ${uid} in ${folder} — the UID may be gone or the mailbox read-only`
    );
    return false;
  }
  // Unconditional: a successful STORE may or may not have changed the flag, and
  // imapflow does not say which. Keeping a cache that might now be stale is the
  // worse of the two errors — a dropped cache costs one refetch.
  invalidate(account.id);
  return true;
}

// ── mutations ───────────────────────────────────────────────────────────────

/**
 * Tags a failure with a code the controller can map to a status.
 *
 * This module deliberately knows nothing about HTTP, so it never constructs an
 * AppError; mail.controller's mailError() owns the translation. Same convention
 * fetchRaw already uses for EMSGTOOLARGE.
 */
function taggedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * The only flags a client may change.
 *
 * This is an allowlist and the reason is `\Deleted`. Nothing else in this file
 * ever sets that flag, because setting it is how mail gets destroyed:
 *
 *   - a plain EXPUNGE (every server without UIDPLUS) removes *every* `\Deleted`
 *     message in the mailbox, not only the UIDs the expunging request named; and
 *   - imapflow emulates MOVE with COPY + `\Deleted` + EXPUNGE on servers without
 *     RFC 6851.
 *
 * So a single flags call marking an inbox `\Deleted`, followed by any later
 * delete in that same mailbox, would destroy mail nothing ever asked to delete —
 * routing straight around the trash-safe delete this module exists to enforce.
 * `\Recent` is excluded too: RFC 3501 §2.3.2 forbids a client setting it at all.
 *
 * System flag names are case-insensitive, so matching is case-insensitive and
 * the canonical spelling is what goes on the wire — otherwise `\deleted` would
 * slip past a case-sensitive check and still reach the server as a real flag.
 */
const SETTABLE_FLAGS = ['\\Seen', '\\Flagged', '\\Answered', '\\Draft'];
const CANONICAL_FLAG = new Map(SETTABLE_FLAGS.map((flag) => [flag.toLowerCase(), flag]));

/** Validates a client-supplied flag list against SETTABLE_FLAGS. Throws EBADFLAG. */
function normalizeFlags(input, label = 'flags') {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) {
    throw taggedError('EBADFLAG', `${label} must be an array of flags`);
  }
  // Array.from, not Array#map: map SKIPS holes, so a sparse array like
  // `new Array(1)` passes straight through unvalidated and comes out the other
  // side as `[undefined]` — an unchecked value handed to a STORE. Array.from
  // visits holes as undefined, so they fail the check below like any other
  // non-string. (Not reachable through JSON today, but this function's whole
  // job is to be the value's last checkpoint.)
  const flags = Array.from(input, (value) => {
    const canonical = typeof value === 'string' ? CANONICAL_FLAG.get(value.toLowerCase()) : undefined;
    if (!canonical) {
      throw taggedError('EBADFLAG', `${label} may only contain ${SETTABLE_FLAGS.join(' ')}`);
    }
    return canonical;
  });
  return [...new Set(flags)];
}

/**
 * The largest value that can be a real IMAP UID.
 *
 * RFC 3501 §2.3.1.1 makes UIDs 32-bit unsigned. A larger number is not a UID
 * that happens to match nothing, it is malformed input, and it should be
 * refused at the same place every other malformed uid is.
 */
const MAX_UID = 4294967295;

/**
 * Builds the IMAP sequence-set for a uid list.
 *
 * Every element is re-checked here even though the controller already parsed
 * them: this is the last point before the value is compiled into a command, and
 * the guarantee worth having is that nothing but digits and commas can ever
 * reach a UID STORE / MOVE / EXPUNGE. A uid that is not a positive 32-bit
 * integer would either address the wrong message or become an unintended range.
 */
function uidRange(uids) {
  if (!Array.isArray(uids) || !uids.length) {
    throw taggedError('EBADUID', 'No messages selected');
  }
  // Array.from, not Array#map: map skips holes, so a sparse array survives
  // every check below and join() renders each hole as an empty string — a
  // `new Array(2)` compiled to the sequence-set "," and issued as a real
  // command. Array.from visits holes as undefined, which fails the check.
  return Array.from(uids, (uid) => {
    if (!Number.isSafeInteger(uid) || uid < 1 || uid > MAX_UID) {
      throw taggedError('EBADUID', 'Invalid message id');
    }
    return String(uid);
  }).join(',');
}

/**
 * Folds the leading `INBOX` token, and only that token.
 *
 * RFC 3501 §5.1 makes `INBOX` the one mailbox name that is case-insensitive;
 * everything after it belongs to the server's own, case-sensitive namespace. So
 * `inbox.Trash` and `INBOX.Trash` are the same mailbox, while `INBOX.trash` and
 * `INBOX.Trash` are not, and this must not pretend otherwise. The asymmetry is
 * deliberate in the safe direction: a delete comparison that *misses* degrades
 * to a move into Trash, while one that falsely matches expunges mail.
 *
 * The separator varies by server (`.` here, `/` elsewhere), hence the class.
 */
function normalizeMailboxPath(path) {
  const value = String(path ?? '');
  return /^inbox(?=$|[./\\])/i.test(value) ? `INBOX${value.slice(5)}` : value;
}

const sameMailbox = (a, b) => normalizeMailboxPath(a) === normalizeMailboxPath(b);

/** Maps a client-supplied folder onto a real mailbox path from the server, or null. */
function resolveFolderPath(folders, requested) {
  return folders.find((f) => sameMailbox(f.path, requested))?.path ?? null;
}

/**
 * Mailbox paths and SPECIAL-USE flags, without listFolders()'s per-folder STATUS.
 *
 * listFolders() issues one STATUS round trip per folder to produce the unread
 * badges the rail needs. A mutation needs none of those counts — only the paths
 * and the `\Trash` flag — and paying for a dozen STATUS calls on every delete
 * would make the most latency-sensitive action in the client the slowest.
 */
async function listMailboxes(account) {
  const client = await getClient(account);
  const boxes = await client.list();
  scheduleIdleClose(account.id);
  return boxes
    .filter((f) => !f.flags?.has?.('\\Noselect'))
    .map((f) => ({ path: f.path, name: f.name, specialUse: f.specialUse || null }));
}

/**
 * Where a delete should send a message.
 *
 * Delete is a move to Trash everywhere except Trash itself, so one click can
 * never destroy mail irrecoverably. If the account has no Trash folder there is
 * nowhere to move to and the expunge is the honest outcome.
 *
 * `folder` should already be a canonical path from resolveFolderPath(); the
 * comparison is still folded so a caller that skipped that step degrades to a
 * move rather than to an expunge.
 */
function resolveDeleteTarget(folders, folder) {
  const trash = specialFolder(folders, '\\Trash');
  if (!trash || sameMailbox(folder, trash)) return { expunge: true, trash };
  return { expunge: false, trash };
}

/**
 * Adds and/or removes flags across a uid range.
 *
 * The return values are checked, not discarded. imapflow's messageFlagsAdd /
 * messageFlagsRemove return `false` *without throwing* when the UID does not
 * resolve, when the mailbox is read-only, or when the STORE itself is rejected —
 * in that last case the underlying exception goes to connection.log.warn, which
 * this module discards by constructing the client with `logger: false`. Ignoring
 * the boolean would therefore report "Flags updated" for a change that never
 * happened, with nothing anywhere saying otherwise. This codebase has already
 * shipped one mail outage that logged success for days.
 */
async function setFlags(account, folder, uids, { add, remove } = {}) {
  const toAdd = normalizeFlags(add, 'add');
  const toRemove = normalizeFlags(remove, 'remove');
  if (!toAdd.length && !toRemove.length) {
    throw taggedError('EBADFLAG', 'No flag changes requested');
  }
  const range = uidRange(uids);

  try {
    await withMailbox(account, folder, async (client) => {
      if (toAdd.length && (await client.messageFlagsAdd(range, toAdd, { uid: true })) !== true) {
        throw taggedError('ESTOREFAILED', `STORE +FLAGS rejected for ${range} in ${folder}`);
      }
      if (
        toRemove.length &&
        (await client.messageFlagsRemove(range, toRemove, { uid: true })) !== true
      ) {
        throw taggedError('ESTOREFAILED', `STORE -FLAGS rejected for ${range} in ${folder}`);
      }
    });
  } finally {
    // Unconditional, including on the throw: a rejected STORE may still have
    // applied to part of the range, and the add can land before the remove
    // fails. A cache kept across a mutation of unknown extent is worse than one
    // wasted refetch.
    invalidate(account.id);
  }
}

/**
 * Moves an already-resolved uid range between two already-resolved mailboxes.
 *
 * The COPY-then-delete branch is not a micro-optimisation, it is a data-safety
 * fix. On a server without RFC 6851 MOVE, imapflow's messageMove emulates it as
 * COPY + `\Deleted` + EXPUNGE — and it runs the delete *unconditionally*, so a
 * COPY that fails (destination over quota, vanished, permission denied) is
 * followed by an expunge of the source and the mail is gone. imapflow does
 * return false afterwards, but detecting the failure after the messages have
 * been destroyed is not a safeguard. Done here, the COPY is verified first and
 * the worst case is a duplicate rather than a loss.
 */
async function performMove(account, source, destination, uids) {
  const range = uidRange(uids);
  try {
    await withMailbox(account, source, async (client) => {
      if (client.capabilities?.has?.('MOVE')) {
        // Resolves to a {path, destination, uidMap} object on success, false on
        // a rejected MOVE, undefined if no mailbox is selected. Only truthiness
        // is meaningful, and none of the failures throw on their own.
        const moved = await client.messageMove(range, destination, { uid: true });
        if (!moved) {
          throw taggedError('EMOVEFAILED', `MOVE ${range} ${source} -> ${destination} rejected`);
        }
        return;
      }

      const copied = await client.messageCopy(range, destination, { uid: true });
      if (!copied) {
        throw taggedError('ECOPYFAILED', `COPY ${range} ${source} -> ${destination} rejected`);
      }
      const removed = await client.messageDelete(range, { uid: true });
      if (removed !== true) {
        // The copy landed, so the mail exists in `destination`; only the source
        // cleanup failed. Reported rather than swallowed, but nothing is lost.
        throw taggedError('EDELETEFAILED', `EXPUNGE ${range} in ${source} rejected after COPY`);
      }
    });
  } finally {
    invalidate(account.id);
  }
  return destination;
}

/**
 * Moves messages to another folder. Returns the canonical destination path.
 *
 * Both folders are resolved against the server's real mailbox list first. The
 * destination is client-supplied, and an unchecked one is not merely a failed
 * command: on the no-MOVE-capability path above it is the input that decides
 * whether the COPY can succeed at all.
 */
async function moveMessages(account, folder, uids, target) {
  const folders = await listMailboxes(account);
  const source = resolveFolderPath(folders, folder);
  if (!source) throw taggedError('ENOFOLDER', `No mailbox matching ${folder}`);
  const destination = resolveFolderPath(folders, target);
  if (!destination) throw taggedError('ENOFOLDER', `No mailbox matching ${target}`);

  // Moving a message into the folder it is already in is a no-op, not an error.
  // Servers disagree about what MOVE-into-self means — some duplicate, some
  // reject — and none of the answers is useful here.
  if (sameMailbox(source, destination)) return destination;

  return performMove(account, source, destination, uids);
}

/**
 * Appends a raw RFC822 message to a mailbox. Returns the path it landed in.
 *
 * This is the only APPEND in the process, and it exists so that filing a Sent
 * or Drafts copy does not need `getClient` from outside this module — reaching
 * for the raw client is how a caller ends up issuing commands outside
 * withMailbox()'s mailbox lock, which is the discipline that keeps concurrent
 * requests from interleaving on a stateful IMAP connection.
 *
 * It runs *inside* withMailbox rather than on a bare client for a second,
 * non-obvious reason: imapflow filters the flag list against the selected
 * mailbox's permanentFlags (commands/append.js:44-46 via tools.canUseFlag).
 * With no mailbox selected, `connection.mailbox` is false and canUseFlag waves
 * everything through, so `\Draft` would be sent to a server that may reject the
 * whole APPEND for it. Selecting the destination first means the flags are
 * checked against the mailbox they are actually going into.
 *
 * The return value is checked, not discarded. imapflow's public append()
 * resolves to `false` (imap-flow.js:3130, `(await this.run(...)) || false`) when
 * the underlying command returns undefined — which commands/append.js does,
 * without throwing, whenever the connection is not in an AUTHENTICATED or
 * SELECTED state or the destination is empty ("nothing to do here"). A real
 * APPEND rejection *does* throw, but it is logged to connection.log.warn first,
 * and this module constructs its client with `logger: false`, so the underlying
 * server text is discarded either way. Both outcomes therefore have to be
 * turned into something the caller can see.
 */
async function appendMessage(account, path, raw, flags = []) {
  const result = await withMailbox(account, path, (client) =>
    client.append(path, raw, flags, new Date())
  );
  if (!result) {
    throw taggedError('EAPPENDFAILED', `APPEND to ${path} was refused by the mail server`);
  }
  // The mailbox now has one more message than any cached envelope page says.
  invalidate(account.id);
  return result.destination || path;
}

/**
 * Deletes messages: a move to Trash everywhere except Trash itself.
 *
 * Note the expunge branch. Without UIDPLUS, imapflow falls back to a bare
 * EXPUNGE, which removes every `\Deleted` message in the mailbox rather than
 * just this range. SETTABLE_FLAGS guarantees that *this service* never leaves a
 * message flagged `\Deleted`, but it is not the only client of a real mailbox:
 * anything the operator marks deleted from their phone, Outlook or webmail and
 * has not yet expunged would be swept up by this EXPUNGE too. That is accepted
 * rather than solved — the blast radius is the Trash folder, whose contents
 * were already headed for deletion — and it is the honest reason this branch is
 * confined to Trash. The fallback only applies without UIDPLUS: imapflow issues
 * `UID EXPUNGE <range>` when the server advertises it (expunge.js:31), which
 * touches nothing outside the range. Whether this account's server does has not
 * been confirmed against a live CAPABILITY, so the comment assumes it does not.
 */
async function deleteMessages(account, folder, uids) {
  const folders = await listMailboxes(account);
  const source = resolveFolderPath(folders, folder);
  if (!source) throw taggedError('ENOFOLDER', `No mailbox matching ${folder}`);

  const { expunge, trash } = resolveDeleteTarget(folders, source);
  if (!expunge) {
    const movedTo = await performMove(account, source, trash, uids);
    return { expunged: false, movedTo };
  }

  const range = uidRange(uids);
  try {
    await withMailbox(account, source, async (client) => {
      const removed = await client.messageDelete(range, { uid: true });
      if (removed !== true) {
        throw taggedError('EDELETEFAILED', `EXPUNGE ${range} in ${source} rejected`);
      }
    });
  } finally {
    invalidate(account.id);
  }
  return { expunged: true, movedTo: null };
}

module.exports = {
  listFolders,
  listMailboxes,
  listMessages,
  searchQuery,
  mapEnvelope,
  specialFolder,
  withMailbox,
  // getClient is deliberately NOT exported. Every IMAP verb this app needs has
  // a named function here, and each one takes the mailbox lock; handing the raw
  // client out lets a caller issue commands around that lock and interleave
  // with another request's selected mailbox.
  invalidate,
  closeAll,
  fetchRaw,
  markSeen,
  SETTABLE_FLAGS,
  normalizeFlags,
  normalizeMailboxPath,
  resolveFolderPath,
  resolveDeleteTarget,
  setFlags,
  moveMessages,
  deleteMessages,
  appendMessage,
};
