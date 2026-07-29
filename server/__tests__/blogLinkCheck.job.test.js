'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { scanBlogLinks } = require('../jobs/blogLinkCheck.job');
const { clearUrlCache } = require('../services/blog.links');

function fakeModel(posts) {
  const saved = [];
  return {
    saved,
    find() {
      return {
        sort: () => ({ limit: () => ({ lean: async () => posts }) }),
      };
    },
    async updateOne(filter, update) {
      saved.push({ filter, update });
    },
  };
}

test('scanBlogLinks strips links that have died and records the check', async () => {
  clearUrlCache();
  const posts = [
    {
      _id: 'p1',
      slug: 'best-whisky',
      content: [
        { type: 'p', text: 'Per [NAFDAC](https://alive.example/a), and [old](https://gone.example/b).' },
      ],
      externalLinks: [{ url: 'https://alive.example/a' }, { url: 'https://gone.example/b' }],
    },
  ];
  const model = fakeModel(posts);
  const fetchImpl = async (url) => ({ status: url.includes('alive') ? 200 : 404 });

  const result = await scanBlogLinks({ model, fetchImpl });

  assert.strictEqual(result.scanned, 1);
  assert.strictEqual(result.stripped, 1);
  assert.strictEqual(model.saved.length, 1);
  const { content, externalLinks, linksCheckedAt } = model.saved[0].update.$set;
  assert.strictEqual(
    content[0].text,
    'Per [NAFDAC](https://alive.example/a), and old.'
  );
  assert.deepStrictEqual(
    externalLinks.map((l) => l.state),
    ['ok']
  );
  assert.ok(linksCheckedAt instanceof Date);
});

test('scanBlogLinks leaves a healthy post untouched', async () => {
  clearUrlCache();
  const model = fakeModel([
    {
      _id: 'p2',
      slug: 'fine',
      content: [{ type: 'p', text: '[a](https://alive.example/c)' }],
      externalLinks: [{ url: 'https://alive.example/c' }],
    },
  ]);
  const result = await scanBlogLinks({ model, fetchImpl: async () => ({ status: 200 }) });
  assert.strictEqual(result.stripped, 0);
  assert.strictEqual(model.saved.length, 1);
  assert.strictEqual(
    model.saved[0].update.$set.content[0].text,
    '[a](https://alive.example/c)'
  );
});
