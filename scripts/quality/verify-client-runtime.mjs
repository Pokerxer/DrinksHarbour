// Run after a clean client install: node scripts/quality/verify-client-runtime.mjs [client-directory]
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const client = path.resolve(process.argv[2] || fileURLToPath(new URL('../../client', import.meta.url)));
const fromApp = (app) => createRequire(path.join(client, 'apps', app, 'package.json'));
const admin = fromApp('admin');
const mobile = fromApp('mobile');

for (const app of ['admin', 'platform', 'mobile']) {
  test(`${app}: matching React renderer can render real markup`, () => {
    const require = fromApp(app);
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    assert.equal(renderToStaticMarkup(React.createElement('strong', null, 'DrinksHarbour')),
      '<strong>DrinksHarbour</strong>');
    assert.equal(require('react/package.json').version, require('react-dom/package.json').version);
  });
}

test('Credentials authentication signs and verifies a token without the unused email provider', async () => {
  for (const app of ['admin', 'platform']) {
    const require = fromApp(app);
    const authRequire = createRequire(require.resolve('next-auth'));
    assert.throws(() => authRequire.resolve('nodemailer'), { code: 'MODULE_NOT_FOUND' });
    const Credentials = require('next-auth/providers/credentials').default;
    const provider = Credentials({ authorize: async () => ({ id: 'synthetic-user' }) });
    assert.equal(provider.type, 'credentials');
    assert.equal((await provider.options.authorize()).id, 'synthetic-user');
    const { encode, decode } = require('next-auth/jwt');
    const secret = 'synthetic-runtime-verification-secret';
    const token = await encode({ secret, token: { sub: 'synthetic-user', tenant: 'tenant-a' } });
    const decoded = await decode({ secret, token });
    assert.equal(decoded.sub, 'synthetic-user');
    assert.equal(decoded.tenant, 'tenant-a');
    assert.equal(await decode({ secret: 'wrong-secret', token }).catch(() => null), null);
    // Loads the real server handler, including Credentials-only core routes.
    assert.equal(typeof require('next-auth/next').getServerSession, 'function');
  }
});

test('native Sharp can resize and encode an image with the patched runtime', async () => {
  const sharp = admin('sharp');
  const png = await sharp({ create: { width: 8, height: 6, channels: 4, background: '#224466' } })
    .resize(4, 3).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, 4);
  assert.equal(metadata.height, 3);
  assert.equal(metadata.format, 'png');
});

test('Next PostCSS parses and transforms CSS with working source maps', async () => {
  const nextRequire = createRequire(admin.resolve('next/package.json'));
  const postcss = nextRequire('postcss');
  const result = await postcss([{
    postcssPlugin: 'runtime-compatibility',
    Declaration(decl) { if (decl.prop === 'color') decl.value = '#123456'; },
  }]).process('.beverage { color: red }', { from: 'input.css', to: 'output.css', map: { inline: false } });
  assert.match(result.css, /color: #123456/);
  assert.equal(result.map.toJSON().sources.length, 1);
  assert.throws(() => postcss.parse('.broken {'), /Unclosed block/);
});

test('UploadThing Effect fibers preserve concurrent request context', async () => {
  const uploadRequire = createRequire(admin.resolve('uploadthing/next'));
  const { Effect } = uploadRequire('effect');
  const store = new AsyncLocalStorage();
  const results = await Promise.all(Array.from({ length: 100 }, (_, id) =>
    store.run(id, () => Effect.runPromise(Effect.gen(function* () {
      yield* Effect.yieldNow();
      yield* Effect.yieldNow();
      return yield* Effect.sync(() => store.getStore());
    })))));
  assert.deepEqual(results, Array.from({ length: 100 }, (_, id) => id));
});

test('Expo Metro processes image dimensions and scaled asset variants', async () => {
  const expoRequire = createRequire(mobile.resolve('expo/metro-config'));
  const wrapperRequire = createRequire(expoRequire.resolve('@expo/metro/package.json'));
  const metroRequire = createRequire(wrapperRequire.resolve('metro/package.json'));
  const { getAssetSize, getAssetData } = metroRequire('metro/private/Assets');
  const sharp = admin('sharp');
  const makePng = (width, height) => sharp({
    create: { width, height, channels: 4, background: '#112233' },
  }).png().toBuffer();
  const image = await makePng(12, 8);
  assert.deepEqual(getAssetSize('png', image, 'beverage.png'), { width: 12, height: 8 });
  assert.throws(() => getAssetSize('png', Buffer.from('not-an-image'), 'invalid.png'), /Invalid/);
  const folder = await mkdtemp(path.join(tmpdir(), 'drinks-metro-assets-'));
  try {
    const asset = path.join(folder, 'beverage.png');
    await writeFile(asset, image);
    await writeFile(path.join(folder, 'beverage@2x.png'), await makePng(24, 16));
    const data = await getAssetData(asset, 'beverage.png', [], 'ios', '/assets');
    assert.equal(data.width, 12);
    assert.equal(data.height, 8);
    assert.deepEqual(data.scales, [1, 2]);
    assert.equal(data.files.length, 2);
    assert.equal(typeof data.hash, 'string');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
