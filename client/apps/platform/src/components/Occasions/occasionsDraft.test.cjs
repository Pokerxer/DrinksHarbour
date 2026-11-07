const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'))('jsdom');
const sourceRoot = path.resolve(__dirname, '../..');

function load(relative, mocks = {}) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const m = new Module(filename, module); m.paths = module.paths; cache.set(filename, m);
    m.require = request => {
      if (request in mocks) return mocks[request];
      if (request === '@/context/AuthContext') return { useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { role: 'customer' } }) };
      if (request === '@/lib/fetchWithAuth') return { fetchWithAuth: (...args) => global.fetch(...args) };
      if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.join(sourceRoot, request.slice(2)) : path.resolve(path.dirname(filename), request);
        return read([base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || base);
      }
      return require(request);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return m.exports;
  }
  return read(path.join(sourceRoot, relative));
}

const submission = reference => Promise.resolve({ ok: true, json: async () => ({ success: true, data: { reference, dueAt: '2026-11-06T18:00:00Z', conversationId: `thread-${reference}`, channel: 'email' } }) });
const messages = stored => Promise.resolve({ ok: true, json: async () => ({ success: true, data: { request: { _id: 'x', reference: 'r', status: 'pending', createdAt: '2026-11-06T12:00:00Z' }, messages: stored, olderCursor: null } }) });
const backend = (calls, reference) => (url, options = {}) => {
  calls.push(String(url));
  if (String(url).includes('/api/products/search?')) return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { products: [{ _id: '507f1f77bcf86cd799439011', name: 'Reception Wine', slug: 'reception-wine' }] } }) });
  if (String(url).includes('/messages')) return messages([]);
  return submission(reference);
};

async function mountWeddingPlanner() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/weddings' });
  const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const Planner = load('components/Weddings/WeddingPlanner.tsx').default;
  let current = null;
  const mount = async () => {
    await React.act(async () => { if (current) { const old = current; current = null; await old.unmount(); } });
    current = createRoot(document.getElementById('root'));
    await React.act(async () => current.render(React.createElement(Planner)));
  };
  await mount();
  async function change(id, value) {
    await React.act(async () => {
      const el = document.getElementById(id), proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
  }
  const draft = () => dom.window.localStorage.getItem('drinksharbour-occasion-draft:weddings');
  const finish = async () => {
    try { if (current) { const old = current; current = null; await React.act(async () => old.unmount()); } } finally {
      dom.window.close();
      Object.assign(global, { window: prior.window, document: prior.document, fetch: prior.fetch, IS_REACT_ACT_ENVIRONMENT: prior.IS_REACT_ACT_ENVIRONMENT });
    }
  };
  return { dom, change, mount, draft, finish };
}

const startDraftTest = async reference => { const h = await mountWeddingPlanner(); const calls = []; global.fetch = backend(calls, reference); return h; };

test('occasion draft saves plan details and preferences on this device — never contacts or the attachment', async () => {
  const h = await startDraftTest('DH-EVT-DRAFT1');
  try {
    assert.equal(h.draft(), null, 'no draft is written before meaningful input');
    await h.change('occasion-city', 'Abuja');
    await h.change('occasion-guests', '300');
    await h.change('occasion-budget', '5000000');
    await h.change('occasion-notes', 'Four hours, 180 adult drinkers; venue supplies water.');
    await h.change('occasion-email', 'ada@example.test');
    await h.change('occasion-name', 'Ada');
    await React.act(async () => document.getElementById('wedding-wine').click());
    assert(h.draft(), 'a draft exists after edits');
    const saved = JSON.parse(h.draft());
    assert.equal(saved.fields.city, 'Abuja');
    assert.equal(saved.fields.guests, '300');
    assert.equal(saved.fields.notes, 'Four hours, 180 adult drinkers; venue supplies water.');
    assert.deepEqual(saved.preferences, ['wine']);
    assert.equal(saved.fields.email, undefined, 'email is never part of the persisted draft');
    assert.equal(saved.fields.name, undefined, 'name is never part of the persisted draft');
    assert.equal(saved.fields.whatsapp, undefined, 'whatsapp is never part of the persisted draft');
    assert.equal(saved.fields.consent, undefined, 'consent must be re-given, never restored');
    assert(!h.draft().includes('ada@example.test') && !h.draft().includes('"Ada"'), 'no contact identifier reaches device storage');
    const file = new File(['Wine x10'], 'wedding-list.txt', { type: 'text/plain' });
    await React.act(async () => { const input = document.getElementById('occasion-list-file'); Object.defineProperty(input, 'files', { value: [file], configurable: true }); input.dispatchEvent(new h.dom.window.Event('change', { bubbles: true })); });
    assert(!h.draft().includes('wedding-list.txt'), 'the attachment file is never persisted');
    assert(document.body.textContent.includes('Draft saved on this device'), 'the saved-draft affordance is visible');
    assert(document.body.textContent.includes('never saved'), 'the affordance says attachments are never saved');
  } finally { await h.finish(); }
});

test('returning to the occasion page restores the draft and re-asks contact details and the attachment', async () => {
  const h = await startDraftTest('DH-EVT-DRAFT2');
  try {
    await h.change('occasion-city', 'Lagos');
    await h.change('occasion-guests', '250');
    await h.change('occasion-notes', 'Cocktail table plus soft drinks.');
    await React.act(async () => document.getElementById('wedding-wine').click());
    await h.change('occasion-email', 'ada@example.test');
    await h.mount();
    assert.equal(document.getElementById('occasion-city').value, 'Lagos');
    assert.equal(document.getElementById('occasion-guests').value, '250');
    assert.equal(document.getElementById('occasion-notes').value, 'Cocktail table plus soft drinks.');
    assert.equal(document.getElementById('wedding-wine').checked, true, 'category preference restores');
    assert.equal(document.getElementById('occasion-email').value, '', 'email is re-asked');
    assert.equal(document.getElementById('occasion-name').value, '', 'name is re-asked');
    assert.equal(document.getElementById('occasion-consent').checked, false, 'consent is re-asked');
    assert.equal(document.getElementById('occasion-list-file').value, '', 'the attachment is re-asked');
    assert(document.body.textContent.includes('Draft saved on this device'));
  } finally { await h.finish(); }
});

test('quantity list entries persist and restore with their catalogue product', async () => {
  const h = await startDraftTest('DH-EVT-DRAFT3');
  try {
    await h.change('wedding-bottle-search', 'Reception');
    await React.act(async () => document.querySelector('#wedding-bottle-list form').dispatchEvent(new h.dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await React.act(async () => [...document.querySelectorAll('button')].find(el => el.textContent === 'Add Reception Wine').click());
    await h.change('bottle-1-quantity', '12');
    await h.mount();
    assert.equal(document.getElementById('bottle-1-quantity').value, '12', 'the saved bottle quantity comes back');
  } finally { await h.finish(); }
});

test('Send another request after a receipt clears the draft and restores a blank planner', async () => {
  const h = await startDraftTest('DH-EVT-DRAFT4');
  try {
    await h.change('occasion-city', 'Abuja');
    await h.change('occasion-name', 'Ada');
    await h.change('occasion-email', 'ada@example.test');
    await h.change('occasion-notes', 'Send this one.');
    await React.act(async () => document.getElementById('occasion-consent').click());
    const submit = () => React.act(async () => document.querySelector('#occasion-planner form').dispatchEvent(new h.dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await submit();
    assert(document.body.textContent.includes('DH-EVT-DRAFT4'), 'receipt view shows');
    assert(h.draft(), 'draft still exists while the receipt is on screen');
    await React.act(async () => [...document.querySelectorAll('button')].find(el => el.textContent === 'Send another request').click());
    assert.equal(h.draft(), null, 'send-another clears the device draft');
    assert.equal(document.getElementById('occasion-city').value, '', 'form returns empty');
    assert(document.body.textContent.includes('Send request to our team'), 'planner is usable again');
  } finally { await h.finish(); }
});
