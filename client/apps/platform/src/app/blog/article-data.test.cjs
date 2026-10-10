const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

test('article and navigation requests start together and preserve results', async () => {
  const api = new Module(__filename + '.fixture', module);
  api.paths = module.paths;
  api._compile(ts.transpileModule(fs.readFileSync(__dirname + '/api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, __filename);
  const originalFetch = global.fetch;
  const requests = [];
  const releases = [];
  global.fetch = url => {
    requests.push(url);
    return new Promise(resolve => releases.push(resolve));
  };
  try {
    const result = api.exports.getArticleData('wine guide');
    assert.equal(requests.length, 2, 'both requests must start before either completes');
    assert.match(requests[0], /slug\/wine%20guide/);
    const post = { _id: '1', title: 'Wine guide', slug: 'wine-guide', createdAt: '2026-01-01' };
    releases[0]({ ok: true, json: async () => post });
    releases[1]({ ok: true, json: async () => ({ posts: [post] }) });
    const data = await result;
    assert.equal(data.post.title, 'Wine guide');
    assert.equal(data.posts[0].slug, 'wine-guide');
  } finally { global.fetch = originalFetch; }
});
