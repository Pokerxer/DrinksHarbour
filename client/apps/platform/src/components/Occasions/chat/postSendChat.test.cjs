const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../../admin/package.json'))('jsdom');
const sourceRoot = path.resolve(__dirname, '../../..');

function load(relative, mocks = {}) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const m = new Module(filename, module); m.paths = module.paths; cache.set(filename, m);
    m.require = request => {
      if (request in mocks) return mocks[request];
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

const reference = 'DH-EVT-CHAT1', conversationId = 'thread-chat';
const brief = status => ({ _id: conversationId, reference, occasion: 'weddings', city: 'Abuja', notes: '', preferences: [], items: [], status: status || 'pending', createdAt: '2026-11-06T12:00:00Z' });
const conversation = (messages, status) => ({ ok: true, json: async () => ({ success: true, data: { request: brief(status), messages, olderCursor: null } }) });

function start(url = 'http://localhost/occasions/weddings') {
  const dom = new JSDOM('<div id="root"></div>', { url });
  const prior = { window: global.window, document: global.document, fetch: global.fetch, setInterval: global.setInterval, clearInterval: global.clearInterval, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  // Interval hooks: the 10s poll is tick()ed explicitly; title-flash ticks are separate.
  const timers = [];
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true, setInterval: (callback, ms) => { const entry = { callback, ms }; timers.push(entry); return entry; }, clearInterval: entry => { const index = timers.indexOf(entry); if (index >= 0) timers.splice(index, 1); } });
  Object.defineProperty(dom.window.document, 'hidden', { value: false });
  const root = require('react-dom/client').createRoot(dom.window.document.getElementById('root'));
  return { dom, root, tick: () => timers.filter(entry => entry.ms === 10000).forEach(entry => entry.callback()), flashTick: () => timers.filter(entry => entry.ms !== 10000).forEach(entry => entry.callback()), finish: async () => { await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, prior); } };
}

const typeMessage = (boot, value) => React.act(async () => {
  const input = document.getElementById('post-send-chat-message');
  Object.getOwnPropertyDescriptor(boot.dom.window.HTMLTextAreaElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new boot.dom.window.Event('input', { bubbles: true }));
});

test('post-send chat modal opens with dialog semantics, honest human copy and the canonical full-conversation link', async () => {
  global.fetch = async url => { assert.match(String(url), /\/api\/occasion-requests\/thread-chat\/messages/); return conversation([]); };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    const dialog = document.querySelector('[role=dialog]');
    assert(dialog, 'modal is open immediately after a successful send');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.getAttribute('aria-labelledby'), 'post-send-chat-title');
    assert(document.getElementById('post-send-chat-title'));
    assert(document.querySelector('[aria-label="Close conversation"]'));
    assert(document.body.textContent.includes('Your request is with our team'));
    assert(document.body.textContent.includes('about 30 minutes'));
    assert(document.body.textContent.includes('longer when busy'));
    assert(document.querySelector('[role=log]'), 'conversation log exists before any reply');
    const fullLink = document.querySelector('a[href="/my-account/chat/thread-chat"]');
    assert(fullLink, 'the full profile thread stays reachable from the modal');
    assert.equal(fullLink.textContent, 'Open full conversation');
    const composer = document.getElementById('post-send-chat-message');
    assert(composer instanceof boot.dom.window.HTMLTextAreaElement, 'composer is a plain text area with no price/size controls');
    assert(document.querySelector('input[type=number], input[type=checkbox]') === null, 'no quantity or pack controls live in the chat');
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    assert(!document.querySelector('[role=dialog]'));
    const reopen = document.querySelector('button[aria-label="Continue chat"]');
    assert(reopen, 'a Continue-chat affordance stays on the page for the session');
    await React.act(async () => reopen.click());
    assert(document.querySelector('[role=dialog]'), 'Continue chat re-opens the same pane');
    await React.act(async () => document.dispatchEvent(new boot.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert(!document.querySelector('[role=dialog]'), 'Escape closes the conversation');
    assert.equal(document.activeElement?.getAttribute('aria-label'), 'Continue chat', 'closing hands focus back to the affordance');
  } finally { await boot.finish(); }
});

test('staff replies polled while the modal is closed raise and then clear the unread badge', async () => {
  const stored = [];
  global.fetch = async url => conversation([...stored]);
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    stored.push({ _id: '0002', sender: 'staff', content: 'Our team reviewed your list.', createdAt: '2026-11-06T12:05:00Z' });
    await React.act(async () => boot.tick());
    const badge = document.querySelector('button[aria-label*="unread"]');
    assert(badge, 'unread replies surface on the Continue-chat affordance');
    assert.match(badge.getAttribute('aria-label'), /1 unread/);
    assert(!document.body.textContent.includes('Our team reviewed your list.'), 'the closed pane shows no conversation body, only the affordance');
    await React.act(async () => badge.click());
    assert(document.querySelector('[role=dialog]'));
    assert(!document.querySelector('button[aria-label*="unread"]'), 'opening the pane clears the unread counter');
    assert(document.querySelector('[role=log]').textContent.includes('Our team reviewed your list.'));
  } finally { await boot.finish(); }
});

test('follow-ups queue optimistically; failures keep the text inline and retry the same UUID key', async () => {
  const stored = [], keys = [];
  let fail = true;
  const gates = [];
  global.fetch = async (url, options = {}) => {
    if (options.method === 'POST') {
      const input = JSON.parse(options.body);
      return new Promise((resolve, reject) => {
        keys.push(input.messageKey);
        gates.push(() => (fail
          ? reject(Error('Too many messages in a short time. Try again shortly.'))
          : resolve({ ok: true, json: async () => ({ success: true, data: { _id: '0003', sender: 'customer', content: input.content, createdAt: '2026-11-06T12:06:00Z' } }) })));
      });
    }
    return conversation([...stored]);
  };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await typeMessage(boot, 'Add 20 non-alcoholic bottles.');
    const sendForm = () => React.act(async () => document.querySelector('form').dispatchEvent(new boot.dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await sendForm();
    const log = document.querySelector('[role=log]');
    assert.equal(keys.length, 1);
    assert.equal(document.getElementById('post-send-chat-message').value, '', 'the composer clears as soon as the message is queued');
    assert(log.textContent.includes('Add 20 non-alcoholic bottles.'), 'the pending customer bubble appears inline');
    assert(log.textContent.includes('Sending…'), 'the pending line is announced on the bubble');
    assert(log.textContent.split('Add 20 non-alcoholic bottles.').length - 1 === 1, 'one pending copy only — no server duplicate yet');
    await React.act(async () => boot.tick());
    assert(document.querySelector('[role=log]').textContent.includes('Sending…'), 'the poll does not drop the pending bubble');
    await React.act(async () => { gates[0](); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert(!document.querySelector('[role=log]').textContent.includes('Sending…'), 'the failed bubble stops saying sending');
    assert(document.querySelector('[role=log]').textContent.includes('Add 20 non-alcoholic bottles.'), 'the failed bubble keeps its exact text');
    assert(document.body.textContent.includes('Too many messages in a short time. Try again shortly.'), 'honest rate-limit copy sits on the bubble');
    const retry = document.querySelector('button[aria-label="Retry sending your message"]');
    assert(retry, 'the per-message retry button is inline on the failed bubble');
    fail = false;
    await React.act(async () => retry.click());
    await React.act(async () => { gates[1](); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1], 'retry re-POSTs the exact same UUID idempotency key');
    assert(document.querySelector('[role=log]').textContent.includes('Add 20 non-alcoholic bottles.'));
    assert(!document.querySelector('[role=log]').textContent.includes('Sending…'), 'success replaces the pending copy with the real document');
    assert(!document.querySelector('button[aria-label="Retry sending your message"]'), 'succeeded bubbles lose the retry affordance');
    await React.act(async () => boot.tick());
  } finally { await boot.finish(); }
});

test('OccasionChatPlanner mounts the modal once the request form reports a receipt', async () => {
  const stubReceipt = { reference: 'DH-EVT-CHAT9', dueAt: '2026-11-06T18:00:00Z', channel: 'email', conversationId: 'thread-stub' };
  let reported = null;
  const FormStub = function({ onReceipt }) { reported = onReceipt; return React.createElement('button', { type: 'button', onClick: () => onReceipt(stubReceipt) }, 'emit-receipt'); };
  const Planner = load('components/Occasions/OccasionChatPlanner.tsx', {
    './OccasionRequestForm': { __esModule: true, default: FormStub },
    '@/components/Weddings/WeddingDrinkInterests': { __esModule: true, default: () => null },
    '@/components/Weddings/WeddingBottleList': { __esModule: true, default: () => null },
    '@/lib/weddingBottleList': { validateBottleList: () => '' },
  }).default;
  global.fetch = async () => conversation([]);
  const boot = start();
  try {
    await React.act(async () => boot.root.render(React.createElement(Planner)));
    assert(typeof reported === 'function', 'planner hands the form a receipt callback');
    await React.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'emit-receipt').click());
    assert(document.querySelector('[role=dialog]'), 'receipt from the form opens the chat pane');
    assert(document.querySelector('a[href="/my-account/chat/thread-stub"]'));
  } finally { await boot.finish(); }
});

test('the closed band reports the request state from the backend status payload, with the honest waiting copy', async () => {
  global.fetch = async url => conversation([]);
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    const band = document.querySelector('div[role=status]');
    assert(band, 'the occasion page keeps a post-send status block');
    assert.match(band.textContent, /with our team/);
    assert.match(band.textContent, /about 30 minutes/);
    assert.match(band.textContent, /longer during busy periods/);
    assert(band.querySelector('a[href="/my-account/chat/thread-chat"]'), 'the status block links the canonical thread');
    assert(!/seconds|countdown|remaining/i.test(band.textContent), 'no countdown or guaranteed-response phrasing');
  } finally { await boot.finish(); }
});

test('a polled staff reply flips the status block to “a human replied” without exposing the message body', async () => {
  const stored = [{ _id: '0002', sender: 'staff', content: 'Our team reviewed your list.', createdAt: '2026-11-06T12:05:00Z' }];
  global.fetch = async url => conversation([...stored]);
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    const band = document.querySelector('div[role=status]');
    assert.match(band.textContent, /A human replied/);
    assert.match(band.textContent, /open your conversation|Open the conversation|continue here/i);
    assert(!band.textContent.includes('Our team reviewed your list.'), 'message content stays inside the conversation panes');
  } finally { await boot.finish(); }
});

test('every request status surfaces honest copy on the in-modal band and the closed-state block', async () => {
  for (const [status, expected] of [
    ['draft', /prepared your reviewed plan/],
    ['sending', /is being sent now/],
    ['sent', /was sent/],
    ['delivery_failed', /could not deliver/],
  ]) {
    const stored = [];
    global.fetch = async url => conversation([...stored], status);
    const boot = start();
    const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
    try {
      await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
      const band = document.querySelector('div[role=status]');
      assert.match(band.textContent, expected, `${status} copy shows while the pane is open`);
      assert(!/countdown|guaranteed|remaining/i.test(band.textContent), `${status} stays countdown-free`);
      await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
      const closed = document.querySelector('div[role=status]');
      assert.match(closed.textContent, expected, `${status} copy shows on the closed-state block`);
    } finally { await boot.finish(); }
  }
});

test('Enter submits the composer, Shift+Enter keeps editing, IME and touch keyboards are never hijacked', async () => {
  global.fetch = async (url, options = {}) => {
    if (options.method === 'POST') {
      const input = JSON.parse(options.body);
      return { ok: true, json: async () => ({ success: true, data: { _id: '0009', sender: 'customer', content: input.content, createdAt: new Date().toISOString() } }) };
    }
    return conversation([]);
  };
  const boot = start();
  const keyboard = load('lib/chatKeyboard.ts');
  assert.equal(keyboard.enterSubmitsMessage({ key: 'Enter', shiftKey: false, isComposing: false }), true, 'plain Enter submits');
  assert.equal(keyboard.enterSubmitsMessage({ key: 'Enter', shiftKey: true, isComposing: false }), false, 'Shift+Enter inserts a newline');
  assert.equal(keyboard.enterSubmitsMessage({ key: 'Enter', shiftKey: false, isComposing: true }), false, 'IME composition never submits');
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await typeMessage(boot, 'Tell us about the guest list.');
    const press = (init) => React.act(async () => document.getElementById('post-send-chat-message')
      .dispatchEvent(new boot.dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', ...init })));
    await press({});
    assert(document.querySelector('[role=log]').textContent.includes('Tell us about the guest list.'), 'Enter queues the message');
    assert.equal(document.getElementById('post-send-chat-message').value, '', 'Enter clears the composer');
    boot.dom.window.matchMedia = query => ({ matches: /coarse|hover: none/.test(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    await typeMessage(boot, 'Second line on a phone.');
    await press({});
    assert(document.getElementById('post-send-chat-message').value, 'a coarse-pointer keyboard keeps the default Enter behaviour — nothing sends');
    assert(!document.querySelector('[role=log]').textContent.includes('Second line on a phone.'), 'touch Enter did not queue a message');
  } finally { await boot.finish(); }
});

test('timestamps group by WAT day — Today, Yesterday and the plain legacy date', async () => {
  const formatting = load('lib/chatFormatting.ts');
  const now = new Date();
  const wat = new Date(now.getTime() + 3600e3); // Africa/Lagos is a fixed UTC+1
  const startOfWatToday = Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate());
  const today = now.toISOString();
  const yesterday = new Date(startOfWatToday - 12 * 3600e3).toISOString();
  const older = new Date(startOfWatToday - 40 * 86400e3).toISOString();
  assert.equal(formatting.chatDayLabel(today, now), 'Today');
  assert.equal(formatting.chatDayLabel(yesterday, now), 'Yesterday');
  assert.match(formatting.chatDayLabel(older, now), /^[A-Z][a-z]{2,4}, \d{1,2} \w+ \d{4}$/, 'older threads read as a plain WAT date');
  const messages = [
    { _id: '0001', sender: 'customer', content: 'Older note.', createdAt: older },
    { _id: '0002', sender: 'staff', content: 'Yesterday reply.', createdAt: yesterday },
    { _id: '0003', sender: 'staff', content: 'Fresh reply.', createdAt: today },
  ];
  global.fetch = async () => conversation(messages);
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    const log = document.querySelector('[role=log]').textContent;
    assert(log.includes('Today'), 'a Today divider exists');
    assert(log.includes('Yesterday'), 'a Yesterday divider exists');
    assert(log.includes(formatting.chatDayLabel(older, now)), 'the older day renders as its plain WAT date');
    assert(log.indexOf(formatting.chatDayLabel(older, now)) < log.indexOf('Yesterday'), 'groups land in chronological order');
    assert(log.includes('WAT'), 'times stay labelled WAT');
  } finally { await boot.finish(); }
});

test('a reply arriving while the pane is closed flashes the title with a badge and restores it exactly', async () => {
  const stored = [];
  const siteTitle = 'Occasions pages — DrinksHarbour';
  global.fetch = async url => conversation([...stored]);
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    document.title = siteTitle;
    stored.push({ _id: '0005', sender: 'staff', content: 'Plan update.', createdAt: '2026-11-06T12:08:00Z' });
    await React.act(async () => boot.tick());
    assert.equal(document.title, siteTitle, 'no flash before a tick — attention derives only from the poll');
    await React.act(async () => boot.flashTick());
    assert.equal(document.title, `(1) ${siteTitle}`, 'the title flashes with the unread badge');
    await React.act(async () => boot.flashTick());
    assert.equal(document.title, siteTitle, 'the badge alternates with the exact title');
    assert(document.querySelector('[role=status]').textContent.includes('1 unread reply from our team'), 'one static unread cue sits on the closed band');
    await React.act(async () => document.querySelector('button[aria-label*="unread"]').click());
    assert(document.querySelector('[role=dialog]'));
    assert.equal(document.title, siteTitle, 'the exact prior title is restored once the pane is read');
  } finally { await boot.finish(); }
});

const singleServerMessage = (suffix, content) => ({ _id: suffix, sender: 'staff', content, createdAt: '2026-11-06T12:09:00Z' });

test('the visible-tab poll re-reads incrementally past the last server id — brief status rides along', async () => {
  const calls = [], stored = [{ _id: '0001', sender: 'customer', content: 'Opening details.', createdAt: '2026-11-06T12:00:00Z' }];
  let status = 'pending';
  global.fetch = async url => {
    calls.push(String(url));
    const after = /after=([^&]+)/.exec(String(url))?.[1];
    const page = after ? stored.filter(message => message._id.localeCompare(after) > 0).slice(0, 30) : stored;
    return conversation(page, status);
  };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    assert(!calls[0].includes('after='), 'the first read stays a full read');
    assert(!calls[0].includes('before='), 'the first read sends no cursor at all');
    status = 'delivery_failed';
    await React.act(async () => boot.tick());
    assert(calls[1].includes('after=0001'), `the next poll re-reads past the last server id (${calls[1]})`);
    assert(`${document.body.textContent}`.includes('could not deliver'), 'the incremental brief updates the status band');
    assert(`${document.body.textContent}`.includes('Checked'), 'lastCheckedAt advances after the incremental read too');
    // A reply arriving while the pane is closed raises the badge from the same incremental merge.
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    stored.push(singleServerMessage('0002', 'Our team reviewed your list.'));
    await React.act(async () => boot.tick());
    assert(calls[2].includes('after=0001'), 'the cursor tracks the newest SERVER message, unchanged while nothing arrived');
    const badge = document.querySelector('button[aria-label*="unread"]');
    assert(badge, 'the incremental merge raises the closed-state unread badge');
    assert.match(badge.getAttribute('aria-label'), /1 unread/);
    await React.act(async () => boot.tick());
    assert(calls[3].includes('after=0002'), 'the cursor advances onto the merged reply for the next tick');
    assert(`${document.body.textContent}`.includes('Our team reviewed your list.') === false, 'the closed pane still exposes no message body');
  } finally { await boot.finish(); }
});

test('a full 30-message incremental page is re-paged immediately with the last id', async () => {
  const calls = [], stored = [{ _id: '0001', sender: 'customer', content: 'Opening details.', createdAt: '2026-11-06T12:00:00Z' }];
  global.fetch = async url => {
    calls.push(String(url));
    const after = /after=([^&]+)/.exec(String(url))?.[1];
    const page = after ? stored.filter(message => message._id.localeCompare(after) > 0).slice(0, 30) : stored;
    return conversation(page);
  };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    for (let index = 2; index <= 31; index++) stored.push(singleServerMessage(String(index).padStart(4, '0'), `Reply number ${index}.`));
    await React.act(async () => boot.tick());
    const afterCalls = calls.slice(1).filter(url => url.includes('after='));
    assert.equal(afterCalls.length, 2, `one full page triggers the follow-up read inside the same tick (${afterCalls})`);
    assert(afterCalls[0].includes('after=0001'));
    assert(afterCalls[1].includes('after=0031'), 'the follow-up read pages from the last returned id');
    for (let index = 32; index <= 33; index++) stored.push(singleServerMessage(String(index).padStart(4, '0'), `Reply number ${index}.`));
    calls.length = 0;
    await React.act(async () => boot.tick());
    assert.equal(calls.filter(url => url.includes('after=')).length, 1, 'a short page waits for the next tick instead of chaining');
    assert(`${document.body.textContent}`.includes('Reply number 33.'), 'every message from the chained reads lands in the log');
  } finally { await boot.finish(); }
});

test('an unclear incremental response falls back to the full read in the same tick', async () => {
  const calls = [], stored = [{ _id: '0001', sender: 'customer', content: 'Opening details.', createdAt: '2026-11-06T12:00:00Z' }];
  let tolerateAfter = true;
  global.fetch = async (url, options = {}) => {
    calls.push(`${options.method || 'GET'} ${url}`);
    if (tolerateAfter === false && String(url).includes('after=')) return conversation([...stored], 'pending');
    return conversation([...stored]);
  };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    stored.push(singleServerMessage('0002', 'Reply one.'));
    // The cursor is abandoned server-side: the after-call echoes the whole thread
    // (ids at-or-before the cursor) — semantics unclear → full read.
    tolerateAfter = false;
    await React.act(async () => boot.tick());
    const tickCalls = calls.slice(1);
    assert(tickCalls[0].includes('after=0001'), 'the tick still starts incremental');
    assert(!tickCalls[1].includes('after='), `the unclear response is followed by a full read (${tickCalls.join(' | ')})`);
    const badge = document.querySelector('button[aria-label*="unread"]');
    assert(badge && /1 unread/.test(badge.getAttribute('aria-label')), 'unread stays correct after the fallback');
  } finally { await boot.finish(); }
});

test('an errored incremental read degrades to the full read in the same tick', async () => {
  const calls = [], stored = [{ _id: '0001', sender: 'customer', content: 'Opening details.', createdAt: '2026-11-06T12:00:00Z' }];
  let breakAfter = true;
  global.fetch = async (url, options = {}) => {
    calls.push(String(url));
    if (breakAfter && String(url).includes('after=')) throw Error('Network blip');
    return conversation([...stored]);
  };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await React.act(async () => document.querySelector('[aria-label="Close conversation"]').click());
    stored.push(singleServerMessage('0002', 'Reply one.'));
    calls.length = 0;
    await React.act(async () => boot.tick());
    const tickCalls = calls.slice(0);
    assert(tickCalls[0].includes('after=0001'), 'the tick attempts the incremental read first');
    assert(!tickCalls[1].includes('after='), `the failed incremental read falls back to the full read (${tickCalls.join(' | ')})`);
    assert(!`${document.body.textContent}`.includes('Network blip'), 'the cheap poll degrades silently instead of erroring the page');
    const badge = document.querySelector('button[aria-label*="unread"]');
    assert(badge && /1 unread/.test(badge.getAttribute('aria-label')), 'unread stays correct after the degraded read');
  } finally { await boot.finish(); }
});

test('cursor math never consumes optimistic placeholders', async () => {
  const calls = [], stored = [{ _id: '0001', sender: 'customer', content: 'Opening details.', createdAt: '2026-11-06T12:00:00Z' }];
  const gates = [];
  global.fetch = async (url, options = {}) => {
    if (options.method === 'POST') {
      const input = JSON.parse(options.body);
      return new Promise(resolve => gates.push(() => resolve({ ok: true, json: async () => ({ success: true, data: { _id: '0003', sender: 'customer', content: input.content, createdAt: '2026-11-06T12:06:00Z' } }) })));
    }
    calls.push(String(url));
    const after = /after=([^&]+)/.exec(String(url))?.[1];
    const page = after ? stored.filter(message => message._id.localeCompare(after) > 0).slice(0, 30) : stored;
    return conversation(page);
  };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    await typeMessage(boot, 'Add 30 bottles.');
    await React.act(async () => document.querySelector('form').dispatchEvent(new boot.dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert(document.querySelector('[role=log]').textContent.includes('Sending…'), 'the optimistic bubble is queued');
    await React.act(async () => boot.tick());
    assert(calls.length && calls.every(url => !url.includes('after=local:')), `no local id ever reaches the cursor (${calls.join(' | ')})`);
    assert(calls.some(url => url.includes('after=0001')), `the poll pages from the newest SERVER id (${calls.join(' | ')})`);
    assert(document.querySelector('[role=log]').textContent.includes('Sending…'), 'the poll does not drop the pending bubble');
    gates[0]();
    await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    calls.length = 0;
    await React.act(async () => boot.tick());
    assert(calls.some(url => url.includes('after=0003')), `once the send confirms, the cursor advances past it (${calls.join(' | ')})`);
    assert(!document.querySelector('[role=log]').textContent.includes('Sending…'));
  } finally { await boot.finish(); }
});

test('auth failures offer a sign-in route back to the canonical conversation instead of dead-ending', async () => {
  global.fetch = async () => { throw Error('Please sign in to view this conversation.'); };
  const boot = start();
  const Chat = load('components/Occasions/chat/PostSendChat.tsx').default;
  try {
    await React.act(async () => boot.root.render(React.createElement(Chat, { reference, conversationId })));
    const link = document.querySelector('a[href*="/login"]');
    assert(link, 'the thread error band offers a sign-in path');
    assert.equal(link.textContent, 'Sign in to continue');
    assert.match(link.getAttribute('href'), /redirect=%2Fmy-account%2Fchat%2Fthread-chat/, 'signing in returns to the same conversation');
    assert(document.querySelector('[role=alert] button')?.textContent.includes('Reload'), 'the reload affordance stays alongside');
  } finally { await boot.finish(); }
});
