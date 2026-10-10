const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bounded } = require('../services/restock/reader');
test('bounded populated reads batch references instead of querying each document', async () => {
  let limit, time;
  const query = {
    limit: (n) => {
      limit = n;
      return query;
    },
    maxTimeMS: (n) => {
      time = n;
      return query;
    },
    lean: async () => [{ _id: 'a' }, { _id: 'b' }],
  };
  assert.equal((await bounded(query, 2)).length, 2);
  assert.equal(limit, 3);
  assert.equal(time, 30000);
});
test('capacity overflow is explicit and never returned as complete data', async () => {
  const query = {
    limit: () => query,
    maxTimeMS: () => query,
    lean: async () => [1, 2, 3],
  };
  await assert.rejects(bounded(query, 2), /capacity/);
});
