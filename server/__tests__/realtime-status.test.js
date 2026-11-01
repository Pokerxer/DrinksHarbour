'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const handler = require('../middleware/realtimeStatus');
for (const attached of [false, true]) {
  test(`realtime status advertises actual attached server: ${attached}`, () => {
    const app = express();
    if (attached) app.set('io', {});
    let payload; const headers = {};
    handler({ app }, { set: (k,v) => { headers[k] = v; }, json: value => { payload = value; } });
    assert.deepEqual(payload, { available: attached });
    assert.equal(headers['Cache-Control'], 'no-store');
  });
}
