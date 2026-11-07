import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSecrets } from './secret-scan.mjs';

test('detects database credentials without returning credential text', () => {
  const secret = ['mongodb+srv:', '', 'reader:test-password@cluster.invalid/db'].join('/');
  const found = findSecrets(`const uri = '${secret}';`);
  assert.deepEqual(found, [{ rule: 'database-credentials', line: 1 }]);
  assert(!JSON.stringify(found).includes('test-password'));
});
test('does not confuse environment references or credential-free local URLs with credentials', () => {
  assert.deepEqual(findSecrets('const uri = process.env.MONGODB_URI;\nconst test = "mongodb://localhost:27017/test";'), []);
});
test('detects private keys and payment secret keys while returning only safe locations', () => {
  const key = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
  const payment = 'sk_' + 'live_' + 'x'.repeat(30);
  assert.deepEqual(findSecrets(`${key}\n${payment}`), [
    { rule: 'private-key', line: 1 }, { rule: 'payment-secret', line: 2 },
  ]);
});
