const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function route(relative) {
  const file = path.join(__dirname, relative);
  const fixture = new Module(file, module);
  fixture.paths = module.paths;
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, file);
  return fixture.exports;
}

for (const event of ['click', 'impression']) {
  test(event + ' tracking resolves promised route params before sending the beacon', async () => {
    const original = global.fetch;
    const urls = [];
    global.fetch = async (url, options) => {
      urls.push(url);
      assert.equal(options.method, 'POST');
      return new Response('{}');
    };
    try {
      const handler = route(`[id]/${event}/route.ts`);
      const response = await handler.POST(new Request('http://localhost/'), { params: Promise.resolve({ id: 'banner-123' }) });
      assert.equal(response.status, 200);
      assert.equal(new URL(urls[0]).pathname, `/api/banners/banner-123/${event}`);
    } finally { global.fetch = original; }
  });
}

test('placement route resolves its promised name and preserves filtering parameters', async () => {
  const original = global.fetch;
  let destination;
  global.fetch = async url => {
    destination = new URL(url);
    return new Response(JSON.stringify({ success: true, data: [{ _id: 'hero' }] }));
  };
  try {
    const handler = route('placement/[placement]/route.ts');
    const response = await handler.GET({ nextUrl: new URL('http://localhost/?limit=5&tenant=wyncity') }, { params: Promise.resolve({ placement: 'home_hero' }) });
    assert.equal(destination.pathname, '/api/banners/placement/home_hero');
    assert.equal(destination.searchParams.get('limit'), '5');
    assert.equal(destination.searchParams.get('tenant'), 'wyncity');
    assert.equal((await response.json()).data[0]._id, 'hero');
  } finally { global.fetch = original; }
});
