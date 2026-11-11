const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Keep real React rendering; replace only Next routing and remote context hooks.
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, relative);
  const fixture = new Module(filename, module);
  fixture.filename = filename;
  fixture.paths = module.paths;
  fixture.require = request => request in mocks
    ? { __esModule: true, ...mocks[request] }
    : require(request);
  fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return fixture.exports;
}

// Evaluate the actual published robots rules using Google's longest-match rule.
function allowed(group, url) {
  const entries = [];
  for (const [key, result] of [['allow', true], ['disallow', false]]) {
    for (const rule of [group[key] || []].flat()) {
      const anchored = rule.endsWith('$');
      const pattern = anchored ? rule.slice(0, -1) : rule;
      const expression = '^' + pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : '');
      if (new RegExp(expression).test(url)) entries.push({ size: rule.replaceAll('*', '').length, result });
    }
  }
  entries.sort((a, b) => b.size - a.size || Number(b.result) - Number(a.result));
  return entries[0]?.result ?? true;
}

test('all crawler groups can fetch optimized images without opening search/private URLs', () => {
  for (const group of load('./robots.ts').default().rules) {
    for (const url of [
      '/_next/image?url=%2Fimages%2Flogo.png&w=640&q=75',
      '/_next/image?q=90&w=1080&url=https%3A%2F%2Fres.cloudinary.com%2Ftest.jpg',
      '/_next/static/chunks/app.js',
      '/_next/static/css/app.css',
      '/shop?category=scotch&page=2',
    ]) assert.equal(allowed(group, url), true, url);
    for (const url of ['/shop?q=whisky', '/blog?q=cognac', '/shop?sort=price', '/api/auth/me', '/my-account', '/payment/verify?reference=test']) {
      assert.equal(allowed(group, url), false, url);
    }
  }
});

test('site OnlineStore markup uses organization properties and real logo assets', () => {
  const filename = path.join(__dirname, 'layout.tsx');
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'localBusinessJsonLd') initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const { NATIONWIDE_DELIVERY_PROMISE } = load('../lib/deliveryCopy.ts');
  const schema = vm.runInNewContext('(' + initializer + ')', {
    BASE_URL: 'https://www.drinksharbour.com',
    NATIONWIDE_DELIVERY_PROMISE,
  });
  assert.equal(schema['@type'], 'OnlineStore');
  assert(schema.description.includes(NATIONWIDE_DELIVERY_PROMISE));
  assert.match(schema.description, /^Nigeria-based online beverage marketplace/);
  assert(schema.areaServed.some(area => area['@type'] === 'Country' && area.name === 'Nigeria'));
  // These schema.org properties have LocalBusiness/Place domains, not OnlineBusiness.
  for (const key of ['geo', 'openingHoursSpecification', 'currenciesAccepted', 'paymentAccepted', 'priceRange', 'hasMap']) {
    assert.equal(key in schema, false, key + ' is invalid on OnlineStore');
  }
  assert.equal(schema.address.addressCountry, 'NG');
  for (const key of ['logo', 'image']) {
    assert(fs.existsSync(path.join(__dirname, '../../public', new URL(schema[key]).pathname)), key + ' must resolve to a real asset');
  }
});

const link = ({ children, ...props }) => React.createElement('a', props, children);
const routing = { 'next/link': { default: link } };
function anchorText(html) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, body]) => ({
    attributes,
    text: body.replace(/<[^>]+>/g, '').trim(),
    imageAlt: /<img\b[^>]*alt="[^"]+"/.test(body),
  }));
}

test('footer social links contain descriptive anchor text in server HTML', () => {
  const Footer = load('../components/Footer/Footer.tsx', {
    ...routing,
    'next/image': { default: ({ priority, ...props }) => React.createElement('img', props) },
    '@/context/TenantContext': { useTenant: () => ({ tenant: null, isMainSite: true }) },
    '@/lib/api': { API_URL: '' },
    '@/components/Analytics/PreferredSourceButton': { default: () => null },
  }).default;
  const anchors = anchorText(renderToStaticMarkup(React.createElement(Footer)));
  assert(anchors.length > 10);
  for (const a of anchors) assert(a.text || a.imageAlt, 'Empty anchor: ' + a.attributes);
});

for (const linkType of ['internal', 'external']) {
  test(linkType + ' entity banner link contains its offer name as text', () => {
    const Banner = load('../components/Banner/entity-banner-overlay.tsx', {
      ...routing,
      './entity-banner-analytics': { useEntityBannerTracking: () => ({ ref: { current: null }, trackClick() {} }) },
    }).default;
    const html = renderToStaticMarkup(React.createElement(Banner, { link: '/shop?brand=test', linkType, label: 'Test brand' }));
    assert.equal(anchorText(html)[0].text, 'Test brand — view offer');
    const inert = renderToStaticMarkup(React.createElement(Banner, { link: '', label: 'Test brand' }));
    assert.equal(anchorText(inert).length, 0);
  });
}

test('whole-slide promotion links contain anchor text, including their fallback', () => {
  const { BannerClickLayer } = load('../components/Banner/banner-link.tsx', routing);
  for (const [banner, expected] of [
    [{ ctaLink: '/shop', title: 'Browse wine' }, 'Browse wine'],
    [{ ctaLink: '/deals', linkType: 'external' }, 'Open banner link'],
  ]) {
    const html = renderToStaticMarkup(React.createElement(BannerClickLayer, { banner }));
    assert.equal(anchorText(html)[0].text, expected);
  }
  assert.equal(renderToStaticMarkup(React.createElement(BannerClickLayer, {
    banner: { ctaLink: '/shop', imageClickable: false },
  })), '');
});

test('query restrictions match complete parameter names in every position', () => {
  for (const group of load('./robots.ts').default().rules) {
    for (const url of ['/shop?q=wine', '/shop?brand=house&q=wine', '/shop?brand=house&sort=price', '/shop?minPrice=100']) {
      assert.equal(allowed(group, url), false, url);
    }
    for (const url of ['/faqs?faq=delivery', '/shop?resort=abuja', '/shop?campaign_search=summer', '/shop?category=wine&page=2', '/llms.txt', '/cart', '/checkout', '/login']) {
      assert.equal(allowed(group, url), true, url);
    }
    for (const url of ['/api', '/api?route=products', '/api/auth/me']) assert.equal(allowed(group, url), false, url);
  }
});

test('robots sitemap is an absolute HTTPS root URL despite stale or invalid configuration', () => {
  const original = process.env.NEXT_PUBLIC_BASE_URL;
  try {
    for (const [input, expected] of [
      ['http://www.drinksharbour.com/', 'https://www.drinksharbour.com/sitemap.xml'],
      ['http://drinksharbour.com/path?test=1', 'https://www.drinksharbour.com/sitemap.xml'],
      ['https://tenant.drinksharbour.com/store/', 'https://tenant.drinksharbour.com/sitemap.xml'],
      ['not a URL', 'https://www.drinksharbour.com/sitemap.xml'],
      ['ftp://example.com', 'https://www.drinksharbour.com/sitemap.xml'],
      ['http://localhost:3002/', 'http://localhost:3002/sitemap.xml'],
    ]) {
      process.env.NEXT_PUBLIC_BASE_URL = input;
      assert.equal(load('./robots.ts').default().sitemap, expected, input);
    }
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = original;
  }
});
