'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSingleFlight } = require('../utils/singleFlight');
test('overflow keeps retained work bounded without dropping requests', async () => {
  const run = createSingleFlight(1);
  let release, calls = 0;
  const blocked = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const first = run('one', blocked);
  const same = run('one', blocked);
  assert.equal(await run('two', async () => 'overflow'), 'overflow');
  assert.equal(await run('two', async () => 'fresh'), 'fresh');
  await new Promise(resolve => setImmediate(resolve));
  release('shared');
  assert.deepEqual(await Promise.all([first, same]), ['shared', 'shared']);
  assert.equal(calls, 1);
});
test('synchronous loader failures release entries and do not poison retries', async () => {
  const run = createSingleFlight();
  await assert.rejects(run('one', () => { throw new Error('failed'); }), /failed/);
  assert.equal(await run('one', () => 3), 3);
});
