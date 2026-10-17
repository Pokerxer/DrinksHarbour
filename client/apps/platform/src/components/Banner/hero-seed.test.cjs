const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const image = { _id: 'hero', type: 'hero', placement: 'home_hero', image: { url: 'https://res.cloudinary.com/drinks/image/upload/v1/hero.jpg', alt: 'Current homepage promotion' } };
function load(file) {
  const fixture = new Module(file, module);
  fixture.paths = module.paths;
  fixture.require = request => {
    if (request === '@/lib/api') return { API_URL: 'https://api.test' };
    if (request === './banner-link') return { BannerClickLayer: () => null };
    if (request === '@/components/UI/OptimizedImage') return { __esModule: true, default: ({ priority, fill, unoptimized, ...props }) => React.createElement('img', props) };
    return require(request);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
  return fixture.exports;
}
test('complete homepage banner seed renders its image before client JavaScript runs', () => {
  const Hero = load(__dirname + '/HeroBanner.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Hero, { initialBanners: [image], initialBannersComplete: true }));
  assert.match(html, /alt="Current homepage promotion"/);
  assert.match(html, /aria-label="Promotional banners"/);
  assert.match(html, /image\/upload\/v1\/hero.jpg/);
});
test('complete empty banner seed does not show a spinner that later collapses', () => {
  const Hero = load(__dirname + '/HeroBanner.tsx').default;
  assert.equal(renderToStaticMarkup(React.createElement(Hero, { initialBanners: [], initialBannersComplete: true })), '');
});
