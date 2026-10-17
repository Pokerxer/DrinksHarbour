const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

function selectionTimeout(extraEnv) {
  const script = `
    console.log = () => {};
    const mongoose = require('mongoose');
    mongoose.connect = async (_uri, opts) => {
      process.stdout.write(String(opts.serverSelectionTimeoutMS));
      return { connection: { readyState: 1 } };
    };
    require('./config/db').connectDB().catch(() => process.exit(1));
  `;
  return Number(execFileSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, VERCEL: '', NODE_DNS_SERVERS: '',
      MONGODB_URI: 'mongodb://db.invalid/test', MONGO_SERVER_SELECTION_TIMEOUT_MS: '', ...extraEnv },
  }));
}

test('long-running servers allow the driver default discovery window', () => {
  assert.equal(selectionTimeout({}), 30000);
});

test('serverless requests retain a bounded discovery window', () => {
  assert.equal(selectionTimeout({ VERCEL: '1' }), 10000);
});

test('explicit connection timeout overrides either environment default', () => {
  assert.equal(selectionTimeout({ MONGO_SERVER_SELECTION_TIMEOUT_MS: '17000' }), 17000);
  assert.equal(selectionTimeout({ VERCEL: '1', MONGO_SERVER_SELECTION_TIMEOUT_MS: '17000' }), 17000);
});
