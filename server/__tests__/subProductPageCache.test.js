const test = require('node:test');
const assert = require('node:assert/strict');
const { createSubProductPageCache } = require('../services/subProductPageCache');
function fixture() {
  const rows = new Map(); let counts = 0, references = 0;
  const cache = { isEnabled: () => true, invalidate: async () => rows.clear(),
    async read(context, load, { fresh } = {}) {
      const key = JSON.stringify(context);
      if (!fresh && rows.has(key)) return rows.get(key);
      const result = await load(); rows.set(key, JSON.parse(JSON.stringify(result))); return result;
    } };
  const SubProduct = { countDocuments: async query => { counts++; return query.tenant === 'B' ? 2 : 1; } };
  const model = { find: query => { references++; return { select: () => ({ lean: async () => query._id.$in.map(_id => ({ _id, name: 'Brand' })) }) }; } };
  return { pages: createSubProductPageCache({ cache, SubProduct, modelFor: () => model }),
    get counts() { return counts; }, get references() { return references; } };
}
test('warm summary counts reuse work, isolate tenants and support refresh/invalidation', async () => {
  const f = fixture();
  assert.equal((await f.pages.statistics('A')).active, 1);
  await f.pages.statistics('A'); assert.equal(f.counts, 3);
  assert.equal((await f.pages.statistics('B')).active, 2); assert.equal(f.counts, 6);
  await f.pages.statistics('A', { fresh: true }); assert.equal(f.counts, 9);
  await f.pages.invalidate(['tenant:A']); await f.pages.statistics('A'); assert.equal(f.counts, 12);
});
test('reference lookups share cache across products but never replace live pricing', async () => {
  const f = fixture(), spec = [{ path: 'brand', select: 'name' }];
  const first = [{ _id: 'p1', brand: 'b1', platformMarkup: 5 }];
  await f.pages.populateReferences(first, spec);
  const next = [{ _id: 'p2', brand: 'b1', platformMarkup: 20 }];
  await f.pages.populateReferences(next, spec);
  assert.equal(f.references, 1);
  assert.equal(next[0].brand.name, 'Brand'); assert.equal(next[0].platformMarkup, 20);
});
test('array references retain order and drop missing records', async () => {
  const f = fixture();
  const products = [{ tags: ['tag2', 'tag1', 'tag2'] }];
  await f.pages.populateReferences(products, [{ path: 'tags', select: 'name' }]);
  assert.deepEqual(products[0].tags.map(row => row._id), ['tag2', 'tag1', 'tag2']);
});
