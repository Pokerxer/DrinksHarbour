'use strict';
// Opt-in network/native smoke test; synthetic text only, no dotenv or database.
const assert = require('node:assert/strict');
process.env.EMBEDDING_PROVIDER = 'local';
const embeddings = require('../utils/embeddings');
async function main() {
  try {
    const texts = ['Cabernet Sauvignon red wine', 'Cabernet red wine', 'Motorcycle engine repair workshop'];
    const vectors = [];
    for (const text of texts) {
      const vector = await embeddings.generateEmbedding(text, { provider: 'local', retries: 1 });
      assert.equal(vector?.length, 384);
      assert(vector.every(Number.isFinite));
      const norm = Math.hypot(...vector);
      assert(Math.abs(norm - 1) < 0.001, `Expected normalized vector, got norm ${norm}`);
      vectors.push(vector);
    }
    const related = embeddings.cosineSimilarity(vectors[0], vectors[1]);
    const unrelated = embeddings.cosineSimilarity(vectors[0], vectors[2]);
    assert(related > unrelated, 'Related beverage text must rank above unrelated text');
    console.log(JSON.stringify({ model: embeddings.EMBEDDING_CONFIG.local.model, dimensions: 384,
      normalized: true, relatedCosine: related, unrelatedCosine: unrelated }));
  } finally { await embeddings.disposeLocalPipeline(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
