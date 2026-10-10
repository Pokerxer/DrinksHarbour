'use strict';
// Share only concurrent read work. Settled values and errors are never cached.
function createSingleFlight(maxEntries = 256) {
  const pending = new Map();
  return function run(key, load) {
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= maxEntries) return Promise.resolve().then(load);
    const promise = Promise.resolve().then(load).finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  };
}
module.exports = { createSingleFlight };
