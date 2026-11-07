'use strict';
const path = require('node:path');
const { tmpdir } = require('node:os');

async function loadLocalEmbeddingPipeline(model, {
  loadRuntime = () => import('@huggingface/transformers'),
  cacheDir = process.env.EMBEDDING_CACHE_DIR || path.join(tmpdir(), 'drinksharbour-embedding-models'),
} = {}) {
  const { pipeline, env } = await loadRuntime();
  env.allowLocalModels = false;
  env.useBrowserCache = false;
  env.useFSCache = true;
  // Installed application bundles may be read-only in production.
  env.cacheDir = cacheDir;
  return pipeline('feature-extraction', model, { dtype: 'q8', device: 'cpu' });
}

module.exports = { loadLocalEmbeddingPipeline };
