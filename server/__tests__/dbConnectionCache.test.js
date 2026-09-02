// The serverless connection cache in config/db.js.
//
// Regression origin: on 2026-09-02 every /api endpoint on the deployed backend
// returned 500 with one identical stack — "MongooseServerSelectionError: Server
// selection timed out after 5000 ms" at NativeConnection.openUri — across
// /api/categories, /api/auth/me, /api/products/search and eight more, all
// inside four seconds. One stack repeated verbatim across unrelated routes is
// the signature of a *cached rejection*, not eleven separate timeouts: the
// cache stored the promise returned by mongoose.connect() and never cleared it
// when that promise rejected, so a single transient Atlas blip on a cold start
// poisoned the whole warm container until Vercel recycled it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const mongoose = require('mongoose');

// Non-localhost so config/db.js takes the real connect path (a localhost URI is
// a documented short-circuit there), and unroutable so a leaked call can never
// reach a real server.
process.env.MONGODB_URI = 'mongodb://db.invalid:27017/dh-test';

const realConnect = mongoose.connect;
const { connectDB } = require('../config/db');

// config/db.js captures `global.mongoose` by reference at require time, so the
// cache has to be *mutated* between tests — reassigning global.mongoose would
// leave the module pointing at the old object.
function resetCache() {
  global.mongoose.conn = null;
  global.mongoose.promise = null;
}

function fakeInstance(readyState = 1) {
  const connection = new EventEmitter();
  connection.readyState = readyState;
  return { connection };
}

test.afterEach(() => {
  mongoose.connect = realConnect;
});

test('a rejected connection attempt is not cached — the next request retries', async () => {
  resetCache();
  let calls = 0;
  mongoose.connect = async () => {
    calls += 1;
    if (calls === 1) throw new Error('Server selection timed out after 5000 ms');
    return fakeInstance(1);
  };

  await assert.rejects(connectDB(), /Server selection timed out/);

  const conn = await connectDB();
  assert.equal(calls, 2, 'the request after a failure must attempt a fresh connection');
  assert.ok(conn, 'the retry must return a usable connection');
});

test('a cached connection whose socket has dropped is replaced', async () => {
  resetCache();
  let calls = 0;
  const dead = fakeInstance(1);
  mongoose.connect = async () => {
    calls += 1;
    return calls === 1 ? dead : fakeInstance(1);
  };

  await connectDB();
  // Atlas failover, or an idle socket reaped between invocations. With
  // bufferCommands:false a handle in this state throws on every query, so
  // handing it back to the route guard is worse than reconnecting.
  dead.connection.readyState = 0;

  const conn = await connectDB();
  assert.equal(calls, 2, 'a disconnected cached handle must trigger a reconnect');
  assert.notEqual(conn, dead, 'the dead handle must not be returned');
});

test('a live cached connection is reused without reconnecting', async () => {
  resetCache();
  let calls = 0;
  mongoose.connect = async () => {
    calls += 1;
    return fakeInstance(1);
  };

  const first = await connectDB();
  const second = await connectDB();
  assert.equal(calls, 1, 'the warm path must not reconnect');
  assert.equal(first, second);
});

test('concurrent cold-start requests share a single connection attempt', async () => {
  resetCache();
  let calls = 0;
  mongoose.connect = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return fakeInstance(1);
  };

  const [a, b, c] = await Promise.all([connectDB(), connectDB(), connectDB()]);
  assert.equal(calls, 1, 'in-flight attempts must be shared, not duplicated');
  assert.equal(a, b);
  assert.equal(b, c);
});

// Regression origin: Atlas alerted that connections were "nearing the connection
// limit" for the M0 cluster Cluster0. M0 caps at 500 concurrent connections. The
// config had minPoolSize:1 and no maxIdleTimeMS, so every warm-but-idle Vercel
// container pinned at least one socket permanently — connections grew with
// container count and were never returned. These assertions pin the two settings
// that actually release them; a future edit reinstating minPoolSize>0 or dropping
// maxIdleTimeMS reintroduces the exhaustion.
test('the pool is configured to release connections back to an M0 cluster', async () => {
  resetCache();
  let opts;
  mongoose.connect = async (_uri, options) => {
    opts = options;
    return fakeInstance(1);
  };

  await connectDB();

  assert.equal(opts.minPoolSize, 0, 'an idle container must not pin a pool socket');
  assert.equal(
    opts.maxIdleTimeMS,
    60000,
    'without an idle timeout a warm container never gives a socket back',
  );
  assert.ok(
    opts.maxPoolSize <= 5,
    `maxPoolSize ${opts.maxPoolSize} is too large a share of the 500-connection M0 ceiling`,
  );
  assert.equal(opts.appName, 'drinksharbour-api', 'connections must be identifiable in Atlas');
});

test('concurrent requests all reject, then a later request still recovers', async () => {
  resetCache();
  let calls = 0;
  mongoose.connect = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (calls === 1) throw new Error('Server selection timed out after 5000 ms');
    return fakeInstance(1);
  };

  const settled = await Promise.allSettled([connectDB(), connectDB(), connectDB()]);
  assert.ok(settled.every((r) => r.status === 'rejected'), 'all sharers of a failed attempt reject');

  const conn = await connectDB();
  assert.equal(calls, 2, 'the shared rejection must be cleared exactly once');
  assert.ok(conn);
});
