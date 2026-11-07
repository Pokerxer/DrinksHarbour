const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, relative);
  const fixture = new Module(filename, module);
  fixture.paths = module.paths;
  fixture.require = request => {
    if (request in mocks) return { __esModule: true, ...mocks[request] };
    if (request.startsWith('@/lib/')) return load('../lib/' + request.slice(6) + '.ts', mocks);
    if (request.startsWith('@/components/')) return { __esModule: true, default: () => null };
    if (request === '@/app/fonts') return { fraunces: { className: '' } };
    if (request === 'next/navigation') return { notFound() { throw new Error('404'); } };
    if (request === 'next/link') return { __esModule: true, default: ({ children, ...p }) => React.createElement('a', p, children) };
    if (request === './BlogImage') return { __esModule: true, default: () => null };
    return require(request);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return fixture.exports;
}

for (const route of ['contact', 'faqs', 'careers', 'returns', 'shipping-info', 'sustainability', 'privacy-policy', 'terms', 'cookie-policy', 'vip-signup', 'vendors', 'vendors/register/apply']) {
  test(route + ' provides a complete sharing image without losing its canonical/robots policy', () => {
    const meta = load('./' + route + '/layout.tsx').metadata;
    assert(meta.alternates?.canonical);
    assert(meta.openGraph?.images?.length, 'page-level OG must include images because Next replaces parent OG');
    assert(meta.twitter?.images?.length);
    if (route.endsWith('/apply')) assert.equal(meta.robots.index, false);
  });
}

test('category and subcategory metadata expand short text without changing canonical targets', async () => {
  const original = global.fetch;
  global.fetch = async url => ({ ok: true, json: async () => url.includes('/api/products/')
    ? { products: [{ _id: 'p', name: 'Test bottle', slug: 'test-bottle' }] }
    : { data: url.includes('/subcategories/')
      ? { _id: 'sub', slug: 'cognac', name: 'Cognac', shortDescription: 'Brandy from France', parent: { _id: 'cat', slug: 'brandy' } }
      : { _id: 'cat', slug: 'brandy', name: 'Brandy', shortDescription: 'Aged grape spirit' } },
  });
  try {
    for (const [file, params, suffix] of [
      ['./categories/[slug]/page.tsx', { slug: 'brandy' }, '/shop?category=brandy'],
      ['./categories/[slug]/[subSlug]/page.tsx', { slug: 'brandy', subSlug: 'cognac' }, '/shop?category=brandy&subcategory=cognac'],
    ]) {
      const meta = await load(file).generateMetadata({ params: Promise.resolve(params) });
      assert(meta.description.length >= 120 && meta.description.length <= 160, meta.description);
      assert(String(meta.alternates.canonical).endsWith(suffix));
      assert.equal(meta.openGraph.description, meta.description);
    }
  } finally { global.fetch = original; }
});

test('shop carousel has one seeded H1 while its banners are still loading', () => {
  const ShopHero = load('../components/Shop/ShopHeroCarousel.tsx').default;
  const html = renderToStaticMarkup(React.createElement(ShopHero, { heroSeed: { label: 'Premium Drinks in Nigeria' } }));
  assert.match(html, /<h1[^>]*>Premium Drinks in Nigeria<\/h1>/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('public store layout provides a server heading before client inventory loads', async () => {
  const exports = load('./vendors/[slug]/layout.tsx');
  const Layout = exports.default;
  for (const slug of ['wyncity', 'ufg-legacy-limited', 'ckay']) {
    const meta = await exports.generateMetadata({ params: Promise.resolve({ slug }) });
    assert(meta.openGraph.images.length);
    assert(meta.twitter.images.length);
    assert(String(meta.openGraph.url).endsWith(`/vendors/${slug}`));
  }
  const html = renderToStaticMarkup(await Layout({ params: Promise.resolve({ slug: 'ufg-legacy-limited' }), children: null }));
  assert.match(html, /<h1[^>]*>Ufg Legacy Limited[^<]*<\/h1>/);
});

for (const city of ['abuja', 'lagos']) {
  test(city + ' delivery page supplies its own sharing image and canonical', () => {
    const meta = load('./delivery/' + city + '/page.tsx').metadata;
    assert(meta.openGraph.images.length);
    assert(meta.twitter.images.length);
    assert(String(meta.alternates.canonical).endsWith('/delivery/' + city));
  });
}

test('editorial links use verified current product identities and preserve outside citations', () => {
  const { renderRichText } = load('./blog/blog-content.tsx');
  for (const [oldSlug, currentSlug] of [
    ['tenjaku-whisky', 'tenjaku-blended-whisky'],
    ['tenjaku-sherry-cask-japanese-whisky', 'tenjaku-pure-malt-sherry-cask-limited-edition-12-years'],
    ['akashi-blended-sherry-oak-finish', 'akashi-blended-whisky-sherry-cask-finish'],
    ['richland-merlot', 'calabria-richland-merlot'],
    ['the-yamazaki-single-malt-japanese-whisky-distillers-reserve', 'the-yamazaki-distiller-s-reserve-single-malt-japanese-whisky'],
    ['the-hakushu-single-malt-japanese-whisky-distillers-reserve', 'the-hakushu-distiller-s-reserve-single-malt-japanese-whisky'],
  ]) {
    const html = renderToStaticMarkup(React.createElement('p', null, renderRichText(`[Bottle](/product/${oldSlug})`)));
    assert(html.includes(`href="/product/${currentSlug}"`), html);
  }
  const citation = renderToStaticMarkup(React.createElement('p', null, renderRichText('[Source](https://example.org/product/tenjaku-whisky)')));
  assert(citation.includes('href="https://example.org/product/tenjaku-whisky"'));
});

test('a removed brand links to a product search instead of a confirmed 404', () => {
  const { resolveCatalogueHref } = load('../lib/catalogueLinks.ts');
  assert.equal(resolveCatalogueHref('/brands/springfield-estate'), '/shop?search=Springfield%20Estate');
  assert.equal(resolveCatalogueHref('/brands/glenfiddich'), '/brands/glenfiddich');
  assert.equal(resolveCatalogueHref('/product/tenjaku-whisky?size=70cl#offers'), '/product/tenjaku-blended-whisky?size=70cl#offers');
});

test('blog listings omit article bodies while article detail retains its content', async () => {
  const api = load('./blog/api.ts');
  const post = { _id: 'p', title: 'Wine guide', slug: 'wine-guide', createdAt: '2026-01-01', content: [{ type: 'p', text: 'Full article body '.repeat(1000) }] };
  const original = global.fetch;
  global.fetch = async url => ({ ok: true, json: async () => url.includes('/slug/') ? post : { posts: [post] } });
  try {
    const summaries = await api.getPosts();
    assert.equal(summaries[0].title, 'Wine guide');
    assert.deepEqual(summaries[0].content, []);
    assert.equal((await api.getPostBySlug('wine-guide')).content[0].text, post.content[0].text);
  } finally { global.fetch = original; }
});
