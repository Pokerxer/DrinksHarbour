// A provider that cannot INITIALISE is misconfigured, not having a bad minute.
//
// Regression origin: /api/products/search took 5-6s warm. The local provider
// (Xenova/all-MiniLM-L6-v2) sets `env.useBrowserCache = true`, which cannot work
// under Node — every load threw "Browser cache is not available in this
// environment". getLocalPipeline then nulled its own memo, so the failure was
// never remembered: every search re-attempted the model download, and
// generateEmbeddingWithRetry ran the full 3 attempts with retryDelay * attempt
// sleeps (1000 + 2000 = 3s of pure sleep) before falling back to text search.
//
// The same call sits in product create and update, both inside a try/catch that
// logs and continues — which is why 0 of 567 published products ever got an
// embedding, and so why the semantic branch could never contribute anything
// even when it "worked".
const test = require('node:test');
const assert = require('node:assert/strict');

const embeddings = require('../utils/embeddings');
const {
  generateEmbedding,
  isEmbeddingAvailable,
  markProviderUnavailable,
  resetProviderAvailability,
} = embeddings;

test.beforeEach(() => {
  resetProviderAvailability();
  embeddings.clearEmbeddingCache();
});

test.after(() => {
  resetProviderAvailability();
});

test('the provider is assumed available until something proves otherwise', () => {
  assert.equal(isEmbeddingAvailable(), true);
});

test('a provider marked unavailable stays unavailable for the cooldown', () => {
  markProviderUnavailable('Browser cache is not available in this environment');
  assert.equal(isEmbeddingAvailable(), false);
});

test('generateEmbedding short-circuits while the provider is unavailable', async () => {
  markProviderUnavailable('model init failed');

  // The point is the *cost*: no model load, no retry sleeps. Before the fix this
  // path took ~3s of sleeps alone; assert it is now effectively free.
  const started = Date.now();
  const result = await generateEmbedding('wine');
  const elapsed = Date.now() - started;

  assert.equal(result, null, 'an unavailable provider yields null, not a throw');
  assert.ok(elapsed < 250, `expected an immediate short-circuit, took ${elapsed}ms`);
});

test('the cooldown expires so a transient outage can recover', () => {
  markProviderUnavailable('temporary', 30);
  assert.equal(isEmbeddingAvailable(), false);
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(isEmbeddingAvailable(), true, 'availability must return after the cooldown');
      resolve();
    }, 60);
  });
});

test('resetProviderAvailability clears the latch', () => {
  markProviderUnavailable('whatever');
  assert.equal(isEmbeddingAvailable(), false);
  resetProviderAvailability();
  assert.equal(isEmbeddingAvailable(), true);
});
