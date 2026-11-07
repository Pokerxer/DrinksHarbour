const key = 'dh:checkout-attempt:v1';
export function checkoutAttemptKey(storage) {
  let value = storage.getItem(key);
  if (!value) { value = globalThis.crypto.randomUUID(); storage.setItem(key, value); }
  return value;
}
export function finishCheckoutAttempt(storage) { storage.removeItem(key); }
