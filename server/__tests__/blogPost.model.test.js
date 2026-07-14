// server/__tests__/blogPost.model.test.js
const test = require('node:test');
const assert = require('node:assert');
const BlogPost = require('../models/BlogPost');

test('valid draft post passes validation with defaults', () => {
  const doc = new BlogPost({
    title: 'Test Post',
    slug: 'test-post',
    category: 'Wine Guide',
    content: [{ type: 'p', text: 'hello' }],
  });
  assert.strictEqual(doc.validateSync(), undefined);
  assert.strictEqual(doc.status, 'draft');
  assert.strictEqual(doc.featured, false);
  assert.strictEqual(doc.content[0]._id, undefined);
});

test('rejects unknown category and unknown block type', () => {
  const badCat = new BlogPost({ title: 't', slug: 't', category: 'Gossip' });
  assert.ok(badCat.validateSync().errors['category']);
  const badBlock = new BlogPost({ title: 't', slug: 't', category: 'Recipes', content: [{ type: 'div' }] });
  assert.ok(badBlock.validateSync());
});

test('requires title and slug', () => {
  const doc = new BlogPost({ category: 'Recipes' });
  const err = doc.validateSync();
  assert.ok(err.errors['title']);
  assert.ok(err.errors['slug']);
});
