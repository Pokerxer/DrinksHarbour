import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutAttemptKey, finishCheckoutAttempt } from './checkoutAttempt.mjs';
test('checkout retries and reloads retain key until purchase completes', () => {
  const values = new Map(); const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const first = checkoutAttemptKey(storage);
  assert.equal(checkoutAttemptKey(storage), first);
  finishCheckoutAttempt(storage);
  assert.notEqual(checkoutAttemptKey(storage), first);
});
