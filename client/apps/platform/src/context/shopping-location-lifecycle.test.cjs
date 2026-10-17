const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { createRoot } = require('react-dom/client');
const adminRequire = Module.createRequire(path.resolve(__dirname, '../../../admin/package.json'));
const { JSDOM } = adminRequire('jsdom');

test('logout discards late addresses and clears loading; session selection survives StrictMode', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const previous = { window: global.window, document: global.document, storage: global.sessionStorage };
  global.window = dom.window; global.document = dom.window.document; global.sessionStorage = dom.window.sessionStorage;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  let auth = { user: { _id: 'a' }, token: 'a', isLoading: false };
  const pending = [];
  const fetchWithAuth = () => new Promise(resolve => pending.push(resolve));
  let shoppingModule;
  let closed = 0;
  function load(file) {
    const fixture = new Module(file, module); fixture.paths = module.paths;
    fixture.require = name => {
      if (name === '@/context/ShoppingLocationContext') return shoppingModule;
      if (name === '@/components/AddressAutocomplete/AddressAutocomplete') return { __esModule: true, default: props => React.createElement(React.Fragment, null, React.createElement('button', { onClick: () => props.onChange('Example address', { lat: 0, lon: 1, formatted: 'Example address' }) }, 'Select example delivery address'), React.createElement('button', { onClick: () => props.onChange('Partial address') }, 'Enter partial address')) };
      if (name === './AuthContext') return { useAuth: () => auth };
      if (name === '@/lib/api') return { API_URL: '' };
      if (name === '@/lib/fetchWithAuth') return { fetchWithAuth };
      if (name === './shopping-location') return load(path.join(__dirname, 'shopping-location.ts'));
      if (name.startsWith('.')) {
        const base = path.resolve(path.dirname(file), name);
        const found = [base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
        if (found) return load(found);
      }
      return require(name);
    };
    fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, file);
    return fixture.exports;
  }
  shoppingModule = load(path.join(__dirname, 'ShoppingLocationContext.tsx'));
  const { ShoppingLocationProvider, useShoppingLocation } = shoppingModule;
  const Dialog = load(path.join(__dirname, '../components/ShoppingLocation/ShoppingLocationDialog.tsx')).default;
  dom.window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  let value;
  function Probe() { value = useShoppingLocation(); return null; }
  const root = createRoot(dom.window.document.getElementById('root'));
  const render = () => root.render(React.createElement(React.StrictMode, null,
    React.createElement(ShoppingLocationProvider, null, React.createElement(Probe))));
  try {
    const saved = { lat: 0, lon: 0, label: 'Selected delivery', source: 'delivery', ownerId: 'a' };
    sessionStorage.setItem('dh_shopping_location', JSON.stringify(saved));
    await React.act(async () => render());
    assert.equal(value.location?.label, 'Selected delivery', 'StrictMode must not consume the saved choice twice');
    await React.act(async () => { for (const resolve of pending) resolve({ ok: false }); });
    assert.ok(value.addressError, 'saved-address failure provides an actionable error');
    assert.equal(value.addressesLoading, false);
    const attempts = pending.length;
    await React.act(async () => value.retryAddresses());
    assert.ok(pending.length > attempts, 'retry starts a fresh address lookup');
    assert.equal(value.addressesLoading, true);

    auth = { user: null, token: null, isLoading: false };
    await React.act(async () => render());
    assert.equal(value.location, null);
    assert.equal(value.loading, false, 'logged-out user has no pending address load');
    await React.act(async () => {
      for (const resolve of pending) resolve({ ok: true, json: async () => ({
        data: { addresses: [{ _id: 'old', addressLine1: 'Old account', isDefaultShipping: true, coordinates: { lat: 1, lng: 1 } }] },
      }) });
    });
    assert.equal(value.location, null, 'late old-account results must be discarded');
    const previousNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
    let finishLocation;
    Object.defineProperty(global, 'navigator', { configurable: true, value: {
      geolocation: { getCurrentPosition(callback) { finishLocation = callback; } },
    } });
    try {
      await React.act(async () => value.requestCurrentLocation());
      await React.act(async () => value.clearLocation());
      await React.act(async () => finishLocation({ coords: { latitude: 1, longitude: 1 } }));
      assert.equal(value.location, null, 'clearing location cancels an older geolocation result');
    } finally {
      if (previousNavigator) Object.defineProperty(global, 'navigator', previousNavigator);
      else delete global.navigator;
    }
    await React.act(async () => root.render(React.createElement(ShoppingLocationProvider, null,
      React.createElement(Probe), React.createElement(Dialog, { onClose: () => { closed++; } }))));
    const button = [...dom.window.document.querySelectorAll('button')].find(row => row.textContent === 'Select example delivery address');
    await React.act(async () => button.click());
    assert.equal(value.location, null, 'a draft address must not reorder the shop before Apply');
    assert.equal(closed, 0);
    const apply = [...dom.window.document.querySelectorAll('button')].find(row => row.textContent.includes('Apply location'));
    await React.act(async () => apply.click());
    assert.equal(value.location.label, 'Example address');
    assert.equal(value.location.source, 'delivery');
    assert.equal(closed, 1);
    // Reopen the picker with an active address; geolocation is a draft until Apply.
    const oldNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
    let resolveCurrent;
    Object.defineProperty(global, 'navigator', { configurable: true, value: {
      geolocation: { getCurrentPosition(callback) { resolveCurrent = callback; } },
    } });
    const renderPicker = key => root.render(React.createElement(ShoppingLocationProvider, null,
      React.createElement(Probe), React.createElement(Dialog, { key, onClose: () => { closed++; } })));
    const findButton = label => [...dom.window.document.querySelectorAll('button')].find(row => row.textContent.includes(label));
    try {
      await React.act(async () => renderPicker('cancel'));
      await React.act(async () => findButton('Enter partial address').click());
      assert.equal(findButton('Apply location').disabled, true, 'unselected address text cannot be applied');
      assert.equal(value.location.label, 'Example address');

      await React.act(async () => findButton('Use current location').click());
      assert.equal(value.location.label, 'Example address');
      await React.act(async () => resolveCurrent({ coords: { latitude: 0, longitude: 2 } }));
      assert.equal(value.location.source, 'delivery', 'position lookup must not apply the draft');
      await React.act(async () => findButton('Cancel').click());
      assert.equal(value.location.label, 'Example address');
      await React.act(async () => renderPicker('apply'));
      await React.act(async () => findButton('Use current location').click());
      await React.act(async () => resolveCurrent({ coords: { latitude: 0, longitude: 2 } }));
      await React.act(async () => findButton('Apply location').click());
      assert.equal(value.location.source, 'current');
      assert.equal(value.location.lon, 2);
    } finally {
      if (oldNavigator) Object.defineProperty(global, 'navigator', oldNavigator);
      else delete global.navigator;
    }

  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    global.window = previous.window; global.document = previous.document; global.sessionStorage = previous.storage;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
