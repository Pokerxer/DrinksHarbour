'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../utils/localEmbeddingRuntime');

test('Node embedding runtime uses the same model with q8 and filesystem caching', async () => {
  const env = {};
  const extractor = async () => ({ data: new Float32Array(384) });
  const loaded = await runtime.loadLocalEmbeddingPipeline('Xenova/all-MiniLM-L6-v2', {
    cacheDir: '/tmp/drinksharbour-synthetic-model-cache',
    loadRuntime: async () => ({ env, pipeline: async (task, model, options) => {
      assert.equal(task, 'feature-extraction');
      assert.equal(model, 'Xenova/all-MiniLM-L6-v2');
      assert.equal(options.dtype, 'q8');
      assert.equal(options.device, 'cpu');
      assert.equal(options.quantized, undefined);
      return extractor;
    } }),
  });
  assert.equal(loaded, extractor);
  assert.equal(env.useBrowserCache, false);
  assert.equal(env.useFSCache, true);
  assert.equal(env.cacheDir, '/tmp/drinksharbour-synthetic-model-cache');
});

test('asynchronous inference is awaited, cached and disposed without changing vector shape', async t => {
  let loads = 0, inferences = 0, disposals = 0;
  const extractor = async (text, options) => {
    inferences++;
    assert.equal(text, 'Cabernet wine');
    assert.deepEqual(options, { pooling: 'mean', normalize: true });
    await new Promise(resolve => setImmediate(resolve));
    return { data: Float32Array.from({ length: 384 }, (_, i) => i === 0 ? 1 : 0) };
  };
  extractor.dispose = async () => { disposals++; };
  t.mock.method(runtime, 'loadLocalEmbeddingPipeline', async () => { loads++; return extractor; });
  delete require.cache[require.resolve('../utils/embeddings')];
  const embeddings = require('../utils/embeddings');
  const options = { provider: 'local', retries: 1 };
  try {
    const [first, second] = await Promise.all([
      embeddings.generateEmbedding('Cabernet wine', options),
      embeddings.generateEmbedding('Cabernet wine', options),
    ]);
    assert.equal(first.length, 384);
    assert.deepEqual(second, first);
    assert.equal(first[0], 1);
    assert(first.every(Number.isFinite));
    assert.equal(loads, 1, 'concurrent requests share model initialization');
    const before = inferences;
    assert.deepEqual(await embeddings.generateEmbedding('Cabernet wine', options), first);
    assert.equal(inferences, before, 'a cached embedding does not rerun inference');
  } finally {
    await embeddings.disposeLocalPipeline();
    await embeddings.disposeLocalPipeline();
  }
  assert.equal(disposals, 1);
});
