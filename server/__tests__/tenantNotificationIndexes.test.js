const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ensureNotificationDedupIndex,
} = require('../services/tenantNotificationIndexes');
function model(createIndex) {
  return {
    schema: {
      indexes: () => [
        [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
        [
          { tenant: 1, recipient: 1, dedupKey: 1 },
          {
            unique: true,
            partialFilterExpression: { dedupKey: { $type: 'string' } },
          },
        ],
      ],
    },
    collection: { createIndex },
    createIndexes: () => {
      throw Error('legacy TTL index conflict');
    },
  };
}
test('prepares only the episode dedup index and leaves legacy TTL options untouched', async () => {
  const calls = [];
  const m = model(async (...args) => calls.push(args));
  await ensureNotificationDedupIndex(m);
  await ensureNotificationDedupIndex(m);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    { tenant: 1, recipient: 1, dedupKey: 1 },
    {
      unique: true,
      partialFilterExpression: { dedupKey: { $type: 'string' } },
    },
  ]);
});
test('concurrent setup shares one promise and failed setup can retry', async () => {
  let calls = 0;
  const m = model(async () => {
    calls++;
    if (calls === 1) throw Error('Offline');
  });
  await assert.rejects(
    Promise.all([
      ensureNotificationDedupIndex(m),
      ensureNotificationDedupIndex(m),
    ]),
    /Offline/,
  );
  await ensureNotificationDedupIndex(m);
  assert.equal(calls, 2);
});
