# Blog Live External Citations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI-written blog posts cite real external sources, every external link is verified to resolve before it ships, and links that die later are removed automatically.

**Architecture:** Anthropic's server-side `web_search` tool supplies real URLs during post generation. A new `server/services/blog.links.js` module live-checks every external href over HTTP and strips any that does not return 2xx (fail-closed — the anchor words stay, only the markup goes). Verified link state is persisted on the post, and a weekly cron re-checks published posts and strips links that have died.

**Tech Stack:** Node/Express + Mongoose (CommonJS, `'use strict'`), `@anthropic-ai/sdk`, `node-cron`, `node:test` + `node:assert`, Next.js/React + Tailwind on both client apps.

## Global Constraints

- Server code is CommonJS with `'use strict';` at the top of every file. No ESM, no TypeScript on the server.
- Server tests use `node:test` and `node:assert` — **not** jest. Run from `server/` with `npm test` (`node --test __tests__/`).
- Tests must never make a real network request. `verifyLiveUrls` takes an injectable `fetchImpl`; every test passes a fake.
- Verification is **fail-closed**: a URL not proven `2xx` within budget is treated as dead and stripped.
- Stripping a link removes only the markdown markup — the anchor text stays in the sentence verbatim.
- Anthropic search tool type string is exactly `web_search_20260209`, tool name exactly `web_search`.
- `SMART_MODEL` / `HAIKU_MODEL` in `blog.controller.js:23-25` are **not** changed by this work.
- External links render with `target="_blank" rel="noopener noreferrer"` and **no** `nofollow`.
- Blocked domains are never fetched — they are rejected before any HTTP request.
- Commit after every task using the message given in that task's final step.

---

### Task 1: Generalize the markdown-link helpers

The existing helpers only recognize leading-slash hrefs. Everything downstream needs
the same extract/strip machinery to work for `https://` hrefs too, without breaking
the internal-link behaviour or its existing tests.

**Files:**
- Modify: `server/services/blog.helpers.js:64-105` (the link section) and the
  `module.exports` block at `server/services/blog.helpers.js:135-149`
- Test: `server/__tests__/blog.links.test.js` (append; do not edit existing tests)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `extractLinks(content) -> Array<{ text: string, href: string }>` — every markdown link, internal or external.
  - `sanitizeLinks(content, isAllowed) -> ContentBlock[]` — replaces links where `isAllowed(href)` is false with their plain anchor text.
  - `extractInternalLinks(content)` and `sanitizeInlineLinks(content, isAllowed)` keep their current signatures and behaviour (leading-slash hrefs only).

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/blog.links.test.js`:

```js
const { extractLinks, sanitizeLinks } = require('../services/blog.helpers');

test('extractLinks finds internal and external links', () => {
  const content = [
    { type: 'p', text: 'See [NAFDAC](https://www.nafdac.gov.ng/) and [Moet](/product/moet).' },
    { type: 'ul', items: ['[Whisky.com](http://whisky.com/guide) is useful'] },
  ];
  const links = extractLinks(content);
  assert.deepStrictEqual(links.map((l) => l.href), [
    'https://www.nafdac.gov.ng/',
    '/product/moet',
    'http://whisky.com/guide',
  ]);
});

test('sanitizeLinks strips disallowed links but keeps the sentence intact', () => {
  const content = [
    { type: 'p', text: 'Per [NAFDAC](https://dead.example/x), the limit stands.' },
  ];
  const out = sanitizeLinks(content, (href) => href !== 'https://dead.example/x');
  assert.strictEqual(out[0].text, 'Per NAFDAC, the limit stands.');
});

test('extractInternalLinks still ignores external links', () => {
  const content = [
    { type: 'p', text: '[a](https://example.com/x) and [b](/product/b)' },
  ];
  assert.deepStrictEqual(extractInternalLinks(content), [
    { text: 'b', href: '/product/b' },
  ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx node --test __tests__/blog.links.test.js`
Expected: FAIL — `extractLinks is not a function`.

- [ ] **Step 3: Generalize the helpers**

In `server/services/blog.helpers.js`, replace the block from the
`// Inline internal links use markdown syntax...` comment through the end of
`sanitizeInlineLinks` (currently lines 64-105) with:

```js
// Inline links use markdown syntax. Internal hrefs start with "/"; external
// hrefs are absolute http(s) URLs:
//   [anchor words](/product/some-slug)
//   [NAFDAC](https://www.nafdac.gov.ng/)
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g;

function isInternalHref(href) {
  return typeof href === 'string' && href.startsWith('/');
}

// Collect every markdown link across a content array (for logging / validation).
function extractLinks(content) {
  const blocks = Array.isArray(content) ? content : [];
  const out = [];
  const scan = (text) => {
    if (typeof text !== 'string') return;
    const re = new RegExp(LINK_RE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) out.push({ text: m[1], href: m[2] });
  };
  blocks.forEach((b) => {
    if (!b) return;
    scan(b.text);
    (Array.isArray(b.items) ? b.items : []).forEach(scan);
  });
  return out;
}

// Internal-only view, kept for callers that only care about catalog links.
function extractInternalLinks(content) {
  return extractLinks(content).filter((l) => isInternalHref(l.href));
}

function stripDisallowedLinks(text, isAllowed) {
  if (typeof text !== 'string') return text;
  return text.replace(new RegExp(LINK_RE.source, 'g'), (full, anchor, href) =>
    isAllowed(href) ? full : anchor
  );
}

// Replace links whose href fails `isAllowed(href)` with their plain anchor text,
// so hallucinated or dead URLs never ship as broken links. Only the markup is
// removed — the anchor words stay in the sentence.
function sanitizeLinks(content, isAllowed) {
  const blocks = Array.isArray(content) ? content : [];
  return blocks.map((b) => {
    if (!b) return b;
    return {
      ...b,
      text: typeof b.text === 'string' ? stripDisallowedLinks(b.text, isAllowed) : b.text,
      items: Array.isArray(b.items) ? b.items.map((it) => stripDisallowedLinks(it, isAllowed)) : b.items,
    };
  });
}

// Internal-only sanitize: external links are left untouched here, because
// external verification runs as its own pass.
function sanitizeInlineLinks(content, isAllowed) {
  return sanitizeLinks(content, (href) => (isInternalHref(href) ? isAllowed(href) : true));
}
```

Then add `extractLinks`, `sanitizeLinks` and `isInternalHref` to `module.exports`
alongside the existing `extractInternalLinks` and `sanitizeInlineLinks`.

- [ ] **Step 4: Run the whole server suite**

Run: `cd server && npm test`
Expected: PASS, including the pre-existing `blog.links.test.js` and
`blog.helpers.test.js` tests, unchanged.

- [ ] **Step 5: Commit**

```bash
git add server/services/blog.helpers.js server/__tests__/blog.links.test.js
git commit -m "refactor(blog): generalize markdown link helpers to handle external hrefs"
```

---

### Task 2: Domain policy and link partitioning

**Files:**
- Create: `server/services/blog.links.js`
- Test: `server/__tests__/blog.externalLinks.test.js`

**Interfaces:**
- Consumes: `extractLinks`, `isInternalHref` from Task 1.
- Produces:
  - `BLOCKED_DOMAINS: string[]`
  - `hostOf(href) -> string` (lowercased hostname, `''` when unparseable)
  - `isBlockedUrl(href) -> boolean` — true for non-http(s) schemes, unparseable URLs, and any host equal to or a subdomain of a blocked domain.
  - `partitionExternalLinks(content) -> { external: string[], blocked: string[] }` — deduped absolute-URL hrefs found in the content.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/blog.externalLinks.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { isBlockedUrl, hostOf, partitionExternalLinks } = require('../services/blog.links');

test('hostOf lowercases the hostname and tolerates junk', () => {
  assert.strictEqual(hostOf('https://WWW.Nafdac.GOV.ng/page'), 'www.nafdac.gov.ng');
  assert.strictEqual(hostOf('not a url'), '');
});

test('isBlockedUrl rejects blocked hosts and their subdomains', () => {
  assert.strictEqual(isBlockedUrl('https://www.jumia.com.ng/whisky'), true);
  assert.strictEqual(isBlockedUrl('https://shop.konga.com/x'), true);
  assert.strictEqual(isBlockedUrl('https://drinksharbour.com/blog/x'), true);
});

test('isBlockedUrl does not match lookalike hosts', () => {
  assert.strictEqual(isBlockedUrl('https://notjumia.com.ng/x'), false);
  assert.strictEqual(isBlockedUrl('https://www.nafdac.gov.ng/'), false);
});

test('isBlockedUrl rejects non-http schemes and unparseable urls', () => {
  assert.strictEqual(isBlockedUrl('javascript:alert(1)'), true);
  assert.strictEqual(isBlockedUrl('ftp://example.com/x'), true);
  assert.strictEqual(isBlockedUrl('https://'), true);
});

test('partitionExternalLinks dedupes and separates blocked hosts', () => {
  const content = [
    { type: 'p', text: '[a](https://www.nafdac.gov.ng/) [b](/product/x) [c](https://www.jumia.com.ng/y)' },
    { type: 'ul', items: ['[d](https://www.nafdac.gov.ng/)'] },
  ];
  const { external, blocked } = partitionExternalLinks(content);
  assert.deepStrictEqual(external, ['https://www.nafdac.gov.ng/']);
  assert.deepStrictEqual(blocked, ['https://www.jumia.com.ng/y']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx node --test __tests__/blog.externalLinks.test.js`
Expected: FAIL — `Cannot find module '../services/blog.links'`.

- [ ] **Step 3: Create the module**

Create `server/services/blog.links.js`:

```js
// services/blog.links.js — external-citation policy and live URL verification
// for the blog module. The only place in the blog code that talks to the open
// internet; every network call goes through `verifyLiveUrls`, which takes an
// injectable fetch so tests never leave the process.
'use strict';

const { extractLinks, isInternalHref } = require('./blog.helpers');

// Hosts we never cite: competing retailers/marketplaces, social networks (not
// authoritative, and often paywalled to crawlers), and our own domains — a link
// to ourselves is an internal link and belongs in the catalog pipeline.
const BLOCKED_DOMAINS = [
  'jumia.com.ng',
  'jumia.com',
  'konga.com',
  'drinks.ng',
  'amazon.com',
  'aliexpress.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'pinterest.com',
  'drinksharbour.com',
  'backend.drinksharbour.com',
];

function hostOf(href) {
  try {
    return new URL(String(href)).hostname.toLowerCase();
  } catch (_) {
    return '';
  }
}

// True when the URL must never be cited: bad scheme, unparseable, or a host that
// is (or sits under) a blocked domain. Suffix matching is anchored on a dot so
// "notjumia.com.ng" does not match "jumia.com.ng".
function isBlockedUrl(href) {
  let url;
  try {
    url = new URL(String(href));
  } catch (_) {
    return true;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  const host = url.hostname.toLowerCase();
  if (!host) return true;
  return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

// Split the absolute-URL links in a content array into citable candidates and
// blocked ones. Deduped, order preserved.
function partitionExternalLinks(content) {
  const external = [];
  const blocked = [];
  const seen = new Set();
  extractLinks(content).forEach(({ href }) => {
    if (isInternalHref(href) || seen.has(href)) return;
    seen.add(href);
    (isBlockedUrl(href) ? blocked : external).push(href);
  });
  return { external, blocked };
}

module.exports = {
  BLOCKED_DOMAINS,
  hostOf,
  isBlockedUrl,
  partitionExternalLinks,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx node --test __tests__/blog.externalLinks.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add server/services/blog.links.js server/__tests__/blog.externalLinks.test.js
git commit -m "feat(blog): add external-link domain policy and partitioning"
```

---

### Task 3: Live URL verification

**Files:**
- Modify: `server/services/blog.links.js`
- Test: `server/__tests__/blog.externalLinks.test.js` (append)

**Interfaces:**
- Consumes: nothing from Task 2 beyond the module it extends.
- Produces:
  - `verifyLiveUrls(hrefs, opts) -> Promise<Map<string, { ok: boolean, status: number }>>`
    where `opts = { fetchImpl, timeoutMs, concurrency, cache, ttlMs, now }`, all optional.
  - `makeExternalLinkValidator(verdicts) -> (href) => boolean` — internal hrefs always pass; external hrefs pass only when `verdicts.get(href).ok` is true. This is the fail-closed gate.
  - `clearUrlCache()` — test hook.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/blog.externalLinks.test.js`:

```js
const { verifyLiveUrls, makeExternalLinkValidator, clearUrlCache } = require('../services/blog.links');

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, method: options.method });
    const route = routes[url];
    if (typeof route === 'function') return route(options);
    if (route === undefined) throw new Error('network down');
    return { status: route };
  };
  impl.calls = calls;
  return impl;
}

test('verifyLiveUrls marks 2xx alive and everything else dead', async () => {
  clearUrlCache();
  const fetchImpl = fakeFetch({
    'https://a.example/ok': 200,
    'https://b.example/gone': 404,
    'https://c.example/boom': undefined,
  });
  const out = await verifyLiveUrls(
    ['https://a.example/ok', 'https://b.example/gone', 'https://c.example/boom'],
    { fetchImpl }
  );
  assert.strictEqual(out.get('https://a.example/ok').ok, true);
  assert.strictEqual(out.get('https://b.example/gone').ok, false);
  assert.strictEqual(out.get('https://b.example/gone').status, 404);
  assert.strictEqual(out.get('https://c.example/boom').ok, false);
  assert.strictEqual(out.get('https://c.example/boom').status, 0);
});

test('verifyLiveUrls retries with GET when HEAD is rejected', async () => {
  clearUrlCache();
  const fetchImpl = fakeFetch({
    'https://d.example/head-hostile': (options) => ({
      status: options.method === 'HEAD' ? 405 : 200,
    }),
  });
  const out = await verifyLiveUrls(['https://d.example/head-hostile'], { fetchImpl });
  assert.strictEqual(out.get('https://d.example/head-hostile').ok, true);
  assert.deepStrictEqual(fetchImpl.calls.map((c) => c.method), ['HEAD', 'GET']);
});

test('verifyLiveUrls dedupes and caches within the TTL', async () => {
  clearUrlCache();
  const fetchImpl = fakeFetch({ 'https://e.example/x': 200 });
  await verifyLiveUrls(['https://e.example/x', 'https://e.example/x'], { fetchImpl });
  await verifyLiveUrls(['https://e.example/x'], { fetchImpl });
  assert.strictEqual(fetchImpl.calls.length, 1);
});

test('makeExternalLinkValidator is fail-closed for unknown external urls', () => {
  const verdicts = new Map([['https://a.example/ok', { ok: true, status: 200 }]]);
  const isAllowed = makeExternalLinkValidator(verdicts);
  assert.strictEqual(isAllowed('https://a.example/ok'), true);
  assert.strictEqual(isAllowed('https://never-checked.example/x'), false);
  assert.strictEqual(isAllowed('/product/moet'), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx node --test __tests__/blog.externalLinks.test.js`
Expected: FAIL — `verifyLiveUrls is not a function`.

- [ ] **Step 3: Implement verification**

In `server/services/blog.links.js`, insert before `module.exports`:

```js
// Some origins reject HEAD outright (405/501) or bot-shaped requests (403);
// a browser-like UA plus a GET retry keeps those from reading as dead.
const BROWSER_UA =
  'Mozilla/5.0 (compatible; DrinksHarbourLinkCheck/1.0; +https://drinksharbour.com)';
const RETRY_WITH_GET = new Set([403, 405, 501]);
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

// Process-local memo so the same authority URL is not re-fetched once per post.
const urlCache = new Map();
function clearUrlCache() {
  urlCache.clear();
}

async function probeUrl(href, fetchImpl, timeoutMs) {
  const base = {
    redirect: 'follow',
    headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
  };
  try {
    let res = await fetchImpl(href, {
      ...base,
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (RETRY_WITH_GET.has(res.status)) {
      res = await fetchImpl(href, {
        ...base,
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });
    }
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (_) {
    // Timeout, DNS failure, TLS error — indistinguishable from dead, and we
    // fail closed either way.
    return { ok: false, status: 0 };
  }
}

/**
 * Check whether each URL resolves. Deduped, memoized for `ttlMs`, and capped at
 * `concurrency` in-flight requests. Never throws: an unreachable URL comes back
 * as `{ ok: false, status: 0 }`.
 */
async function verifyLiveUrls(hrefs, opts = {}) {
  const {
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    concurrency = DEFAULT_CONCURRENCY,
    cache = urlCache,
    ttlMs = DEFAULT_TTL_MS,
    now = Date.now,
  } = opts;

  const results = new Map();
  const pending = [];
  const at = now();

  [...new Set(Array.isArray(hrefs) ? hrefs : [])].forEach((href) => {
    const hit = cache.get(href);
    if (hit && at - hit.checkedAt < ttlMs) results.set(href, hit.verdict);
    else pending.push(href);
  });

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const href = pending[cursor++];
      const verdict = await probeUrl(href, fetchImpl, timeoutMs);
      cache.set(href, { verdict, checkedAt: now() });
      results.set(href, verdict);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, worker)
  );

  return results;
}

// Fail-closed gate for `sanitizeLinks`: internal hrefs are someone else's
// problem (the catalog validator already ran); an external href survives only
// with a positive verdict in hand.
function makeExternalLinkValidator(verdicts) {
  return (href) => {
    if (isInternalHref(href)) return true;
    const verdict = verdicts.get(href);
    return Boolean(verdict && verdict.ok);
  };
}
```

Add `verifyLiveUrls`, `makeExternalLinkValidator` and `clearUrlCache` to
`module.exports`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx node --test __tests__/blog.externalLinks.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add server/services/blog.links.js server/__tests__/blog.externalLinks.test.js
git commit -m "feat(blog): live-verify external URLs with fail-closed validator"
```

---

### Task 4: Read text from multi-block tool-use responses

Declaring a server-side tool makes the response content array lead with
`server_tool_use` and `web_search_tool_result` blocks. `callHaikuJson` reads
`message.content?.[0]?.text` (`server/controllers/blog.controller.js:302`), which
would be `undefined` — every generation would 502. Fix this before enabling search.

**Files:**
- Modify: `server/services/blog.helpers.js` (add helper + export)
- Modify: `server/controllers/blog.controller.js:293-303` (`callHaikuJson`)
- Test: `server/__tests__/blog.helpers.test.js` (append)

**Interfaces:**
- Produces: `textFromMessage(message) -> string` — concatenation of the `text` of every `type === 'text'` content block, `''` when there are none.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/blog.helpers.test.js`:

```js
const { textFromMessage } = require('../services/blog.helpers');

test('textFromMessage joins text blocks and ignores tool blocks', () => {
  const message = {
    content: [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
      { type: 'text', text: '{"title":"a"' },
      { type: 'text', text: ',"excerpt":"b"}' },
    ],
  };
  assert.strictEqual(textFromMessage(message), '{"title":"a","excerpt":"b"}');
});

test('textFromMessage returns empty string when there is no text block', () => {
  assert.strictEqual(textFromMessage({ content: [{ type: 'server_tool_use' }] }), '');
  assert.strictEqual(textFromMessage(undefined), '');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx node --test __tests__/blog.helpers.test.js`
Expected: FAIL — `textFromMessage is not a function`.

- [ ] **Step 3: Add the helper and use it**

In `server/services/blog.helpers.js`, add above `module.exports`:

```js
// With server-side tools declared, a response's content array leads with
// server_tool_use / web_search_tool_result blocks and may split the answer over
// several text blocks — content[0].text is not the answer.
function textFromMessage(message) {
  const blocks = Array.isArray(message?.content) ? message.content : [];
  return blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
}
```

Export it, then in `server/controllers/blog.controller.js` add `textFromMessage`
to the destructured require from `../services/blog.helpers` and replace the last
line of `callHaikuJson`:

```js
  return textFromMessage(message);
```

- [ ] **Step 4: Run the full suite**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/blog.helpers.js server/controllers/blog.controller.js server/__tests__/blog.helpers.test.js
git commit -m "fix(blog): read AI text from all content blocks, not just the first"
```

---

### Task 5: Cite real sources during post generation

**Files:**
- Modify: `server/controllers/blog.controller.js` — requires at the top, the
  prompt in `generatePost` (currently ends at line 338), and the sanitize step at
  line 349.

**Interfaces:**
- Consumes: `partitionExternalLinks`, `verifyLiveUrls`, `makeExternalLinkValidator` (Tasks 2-3); `sanitizeLinks` (Task 1); `textFromMessage` (Task 4).
- Produces: `applyExternalCitations(content, opts) -> Promise<{ content, kept, stripped, blocked }>` — exported from `blog.controller.js` for reuse by Tasks 7 and 9. `opts` is forwarded to `verifyLiveUrls`.

- [ ] **Step 1: Add the requires and the shared citation pass**

In `server/controllers/blog.controller.js`, extend the existing destructured
require from `../services/blog.helpers` with `sanitizeLinks`, and add below it:

```js
const {
  partitionExternalLinks,
  verifyLiveUrls,
  makeExternalLinkValidator,
} = require('../services/blog.links');
```

Add above `generatePost`:

```js
// The external half of the link pipeline: drop blocked hosts without touching
// the network, live-check the rest, and strip everything that did not come back
// 2xx. Fail-closed — a link we could not prove is a link we do not ship.
async function applyExternalCitations(content, opts = {}) {
  const { external, blocked } = partitionExternalLinks(content);
  if (!external.length && !blocked.length) {
    return { content, kept: 0, stripped: 0, blocked: 0 };
  }
  const verdicts = external.length ? await verifyLiveUrls(external, opts) : new Map();
  const isAllowed = makeExternalLinkValidator(verdicts);
  const kept = external.filter((href) => isAllowed(href)).length;
  return {
    content: sanitizeLinks(content, isAllowed),
    kept,
    stripped: external.length - kept,
    blocked: blocked.length,
  };
}
```

- [ ] **Step 2: Declare the search tool**

Change `callHaikuJson` (`server/controllers/blog.controller.js:293`) to accept
tools and pass them through:

```js
async function callHaikuJson(prompt, maxTokens, model = HAIKU_MODEL, tools) {
  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system:
      'You are an expert drinks & lifestyle content writer for DrinksHarbour, a Nigerian online drinks marketplace. Respond with ONLY valid JSON — no markdown code fences, no explanation, no preamble.',
    messages: [{ role: 'user', content: prompt }],
    ...(tools ? { tools } : {}),
  });
  if (message.stop_reason === 'refusal') throw new Error('Claude declined the request');
  return textFromMessage(message);
}
```

Add above it:

```js
// Anthropic's server-side search tool. Claude runs the searches on Anthropic's
// infrastructure and cites URLs taken from real results, so there is no
// recall-from-memory step for it to hallucinate a URL in.
const WEB_SEARCH_TOOL = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }];
```

- [ ] **Step 3: Ask for citations in the prompt**

In `generatePost`, append this to the template literal immediately after
`${catalogToPrompt(catalog)}` (currently `server/controllers/blog.controller.js:338`):

```js
${EXTERNAL_CITATION_PROMPT}`;
```

and define above `generatePost`:

```js
const EXTERNAL_CITATION_PROMPT = `

EXTERNAL CITATIONS: use the web_search tool to find 2-4 authoritative sources that genuinely support claims in the post, and cite them inline with the same markdown syntax: [anchor words](https://full-url).
- Every cited URL MUST come from a search result you actually received. Never write a URL from memory.
- Cite only authoritative, non-commercial sources: official producer/distillery/winery sites, regulators and standards bodies (NAFDAC, WHO, EU/US labelling authorities), established reference works and trade publications.
- NEVER link to a competing retailer, marketplace, or online shop.
- The anchor must be natural words inside a sentence (e.g. "the [NAFDAC labelling rules](https://...) require"), never a bare URL and never "click here".
- Cite each source at most once, and place citations in paragraph, list or tip text — never in a heading.`;
```

- [ ] **Step 4: Pass the tool and run the citation pass**

In `generatePost`, change the generation call:

```js
    data = parseAiJson(await callHaikuJson(prompt, 4096, SMART_MODEL, WEB_SEARCH_TOOL));
```

and replace the sanitize block (currently lines 348-351) with:

```js
  // Strip any hallucinated product links, keeping only real catalog URLs.
  const internalSafe = sanitizeInlineLinks(
    sanitizeContentBlocks(data.content),
    makeLinkValidator(catalog.allowed)
  );
  const cited = await applyExternalCitations(internalSafe);
  const content = cited.content;
  console.log(
    `generatePost "${topic}": ${extractInternalLinks(content).length} internal link(s), ` +
      `${cited.kept} external citation(s) kept, ${cited.stripped} dead stripped, ${cited.blocked} blocked`
  );
```

- [ ] **Step 5: Export the shared pass**

Add `applyExternalCitations` to the `module.exports` object at the bottom of
`server/controllers/blog.controller.js`.

- [ ] **Step 6: Verify the module still loads and the suite is green**

Run: `cd server && node -e "require('./controllers/blog.controller')" && npm test`
Expected: no output from the `node -e`, then PASS.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/blog.controller.js
git commit -m "feat(blog): cite web-searched sources in generated posts, verified live"
```

---

### Task 6: Persist verified link state on the post

**Files:**
- Modify: `server/models/BlogPost.js`
- Modify: `server/services/blog.links.js`
- Modify: `server/controllers/blog.controller.js` (`createPost`, `updatePost`)
- Test: `server/__tests__/blog.externalLinks.test.js` (append)

**Interfaces:**
- Produces: `buildExternalLinkRecords(content, verdicts) -> Array<{ url, domain, httpStatus, state, lastCheckedAt }>`. `state` is `'blocked'` for blocked hosts, `'ok'` / `'dead'` when a verdict exists, `'ok'` with `lastCheckedAt: null` when unverified (the cron picks those up first).

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/blog.externalLinks.test.js`:

```js
const { buildExternalLinkRecords } = require('../services/blog.links');

test('buildExternalLinkRecords records domain, state and check time', () => {
  const content = [
    { type: 'p', text: '[a](https://www.nafdac.gov.ng/x) [b](https://www.jumia.com.ng/y) [c](https://gone.example/z)' },
  ];
  const verdicts = new Map([
    ['https://www.nafdac.gov.ng/x', { ok: true, status: 200 }],
    ['https://gone.example/z', { ok: false, status: 404 }],
  ]);
  const records = buildExternalLinkRecords(content, verdicts);
  assert.deepStrictEqual(
    records.map((r) => [r.url, r.domain, r.state, r.httpStatus]),
    [
      ['https://www.nafdac.gov.ng/x', 'www.nafdac.gov.ng', 'ok', 200],
      ['https://www.jumia.com.ng/y', 'www.jumia.com.ng', 'blocked', 0],
      ['https://gone.example/z', 'gone.example', 'dead', 404],
    ]
  );
  assert.ok(records[0].lastCheckedAt instanceof Date);
});

test('buildExternalLinkRecords leaves unverified links unchecked', () => {
  const content = [{ type: 'p', text: '[a](https://fresh.example/x)' }];
  const [record] = buildExternalLinkRecords(content, new Map());
  assert.strictEqual(record.state, 'ok');
  assert.strictEqual(record.lastCheckedAt, null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx node --test __tests__/blog.externalLinks.test.js`
Expected: FAIL — `buildExternalLinkRecords is not a function`.

- [ ] **Step 3: Implement the record builder**

In `server/services/blog.links.js`, add before `module.exports` (and export it):

```js
/**
 * Snapshot the external links in a content array for storage on the post, in
 * document order. A record with `lastCheckedAt: null` has never been verified —
 * that is the cron's queue, since a null sorts ahead of every date.
 */
function buildExternalLinkRecords(content, verdicts = new Map()) {
  const now = new Date();
  const seen = new Set();
  const records = [];
  extractLinks(content).forEach(({ href }) => {
    if (isInternalHref(href) || seen.has(href)) return;
    seen.add(href);
    const domain = hostOf(href);
    if (isBlockedUrl(href)) {
      records.push({ url: href, domain, httpStatus: 0, state: 'blocked', lastCheckedAt: now });
      return;
    }
    const verdict = verdicts.get(href);
    records.push(
      verdict
        ? {
            url: href,
            domain,
            httpStatus: verdict.status,
            state: verdict.ok ? 'ok' : 'dead',
            lastCheckedAt: now,
          }
        : { url: href, domain, httpStatus: 0, state: 'ok', lastCheckedAt: null }
    );
  });
  return records;
}
```

`extractLinks` and `isInternalHref` are already required at the top of the file
from Task 2 — no change needed there.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx node --test __tests__/blog.externalLinks.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Add the schema fields**

In `server/models/BlogPost.js`, add above `blogPostSchema`:

```js
const externalLinkSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    domain: { type: String, default: '' },
    httpStatus: { type: Number, default: 0 },
    state: { type: String, enum: ['ok', 'dead', 'blocked'], default: 'ok' },
    lastCheckedAt: { type: Date, default: null },
  },
  { _id: false }
);
```

and inside `blogPostSchema`, after `publishedAt: { type: Date },`:

```js
    // Snapshot of the outbound citations in `content`, refreshed on save and by
    // the weekly link-check cron.
    externalLinks: { type: [externalLinkSchema], default: [] },
    linksCheckedAt: { type: Date, default: null },
```

- [ ] **Step 6: Populate them on save**

In `server/controllers/blog.controller.js`, add `buildExternalLinkRecords` to the
`require('../services/blog.links')` destructure. In `createPost`, after
`data.readTime = computeReadTime(data.content);`:

```js
  data.externalLinks = buildExternalLinkRecords(data.content);
```

In `updatePost`, add to the `Object.assign(post, { ... })` call, after
`readTime: computeReadTime(data.content),`:

```js
    externalLinks: buildExternalLinkRecords(data.content),
```

- [ ] **Step 7: Run the full suite**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/models/BlogPost.js server/services/blog.links.js server/controllers/blog.controller.js server/__tests__/blog.externalLinks.test.js
git commit -m "feat(blog): persist external citation state on posts"
```

---

### Task 7: Add citations to an existing post

**Files:**
- Modify: `server/controllers/blog.controller.js` (new `addCitations` handler + export)
- Modify: `server/routes/blog.routes.js:19,30`
- Modify: `client/apps/admin/src/services/blog.service.ts:88`
- Modify: `client/apps/admin/src/app/shared/blog/ai-bar.tsx`

**Interfaces:**
- Consumes: `applyExternalCitations` (Task 5), `sanitizeContentBlocks`, `callHaikuJson`, `WEB_SEARCH_TOOL`.
- Produces: `POST /api/blog/admin/ai/add-citations` with body `{ post: { title, category, content } }`, responding `{ content, kept, stripped }`.

- [ ] **Step 1: Write the handler**

In `server/controllers/blog.controller.js`, add after `generateSeo`:

```js
// Weave verified outbound citations into a post that already exists — AI-written
// or hand-written. Same search + live-check pipeline as generatePost; the model
// is told to insert links only, so the diff is markup rather than prose.
const addCitations = asyncHandler(async (req, res) => {
  if (!anthropic) return res.status(503).json({ message: 'AI is not configured (ANTHROPIC_API_KEY missing)' });
  const content = sanitizeContentBlocks(req.body?.post?.content);
  if (!content.length) return res.status(400).json({ message: 'Post has no content to cite' });

  const prompt = `You are adding source citations to an existing DrinksHarbour blog post (Nigerian drinks & lifestyle magazine).
Post title: "${req.body.post?.title || ''}"
Category: ${req.body.post?.category || 'unknown'}

Here is the post content as a JSON array of blocks:
${JSON.stringify(content)}

Return ONLY {"content": [...]} — the SAME array of blocks, in the same order, with the same block types, with citations inserted.

Rules:
- Do NOT rewrite, reorder, add or delete any block, sentence or word. The ONLY change allowed is turning existing words into markdown links.
- Preserve every existing link exactly as it is, internal ("/path") and external alike.
${EXTERNAL_CITATION_PROMPT}`;

  let data;
  try {
    data = parseAiJson(await callHaikuJson(prompt, 4096, SMART_MODEL, WEB_SEARCH_TOOL));
  } catch (err) {
    console.error('addCitations AI error:', err.message);
    return res.status(502).json({ message: 'AI returned an unusable response — try again' });
  }

  const cited = await applyExternalCitations(sanitizeContentBlocks(data.content));
  if (cited.content.length !== content.length) {
    return res.status(502).json({ message: 'AI changed the post structure — no citations applied' });
  }
  console.log(`addCitations: ${cited.kept} kept, ${cited.stripped} dead stripped, ${cited.blocked} blocked`);
  res.json({ content: cited.content, kept: cited.kept, stripped: cited.stripped });
});
```

Add `addCitations` to `module.exports`.

- [ ] **Step 2: Route it**

In `server/routes/blog.routes.js`, add `addCitations` to the destructured require
and register it with the other AI routes, above the `/admin/:id` routes:

```js
router.post('/admin/ai/add-citations', authenticate, addCitations);
```

- [ ] **Step 3: Add the client call**

In `client/apps/admin/src/services/blog.service.ts`, add to the `blogService`
object after `generateBlock`:

```ts
  addCitations(body: { post: any }, token: string) {
    return request('/api/blog/admin/ai/add-citations', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
```

- [ ] **Step 4: Add the editor button**

In `client/apps/admin/src/app/shared/blog/ai-bar.tsx`, add `PiLinkBold` to the
`react-icons/pi` import, then add this exported component at the end of the file:

```tsx
export function AddCitationsButton({
  token,
  post,
  onApply,
}: {
  token: string;
  post: any;
  onApply: (content: any[]) => void;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!post?.content?.length) return toast.error('Write some content first');
    setBusy(true);
    try {
      const data: any = await blogService.addCitations({ post }, token);
      onApply(data.content);
      toast.success(
        data.kept
          ? `Added ${data.kept} verified source link${data.kept === 1 ? '' : 's'}`
          : 'No verifiable sources found for this post'
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      isLoading={busy}
      onClick={run}
      className="border-violet-200 text-violet-700 hover:bg-violet-50"
    >
      <PiLinkBold className="me-1.5 h-4 w-4" /> Add sources
    </Button>
  );
}
```

- [ ] **Step 5: Mount the button**

In `client/apps/admin/src/app/shared/blog/create-edit.tsx`, change the import at
line 29 to:

```tsx
import AiBar, { AddCitationsButton } from './ai-bar';
```

and render the button beside the existing `<AiBar token={token} onApply={applyAi} />`
at line 284:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <AiBar token={token} onApply={applyAi} />
        <AddCitationsButton
          token={token}
          post={post}
          onApply={(content) => {
            setPost((p: any) => ({ ...p, content }));
            setDirty(true);
          }}
        />
      </div>
```

`post`, `setPost` and `setDirty` are the existing state hooks at lines 56 and 63.
If wrapping `<AiBar>` in a flex row disturbs the page layout, render
`<AddCitationsButton>` on its own line directly below instead — the button only
needs `token`, `post` and `onApply`.

- [ ] **Step 6: Verify both sides compile**

Run: `cd server && node -e "require('./routes/blog.routes')" && npm test`
Expected: no output from `node -e`, then PASS.

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: a count no higher than the pre-existing baseline (479 source errors —
`.next/types` errors are noise and are excluded from that baseline). If the count
went up, the increase is yours to fix.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/blog.controller.js server/routes/blog.routes.js client/apps/admin/src/services/blog.service.ts client/apps/admin/src/app/shared/blog/ai-bar.tsx client/apps/admin/src/app/shared/blog/create-edit.tsx
git commit -m "feat(blog): add verified source citations to existing posts on demand"
```

---

### Task 8: Stop block rewrites from inventing links

`generateBlock` asks the model to "Preserve any Markdown links"
(`server/controllers/blog.controller.js:492`) with nothing enforcing it. A rewrite
can silently invent a URL or mangle a real one.

**Files:**
- Modify: `server/services/blog.links.js`
- Modify: `server/controllers/blog.controller.js` (`generateBlock`)
- Test: `server/__tests__/blog.externalLinks.test.js` (append)

**Interfaces:**
- Produces: `keepOnlyKnownLinks(outputBlocks, inputBlock) -> ContentBlock[]` — strips any link in the output whose href did not appear in the input block.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/blog.externalLinks.test.js`:

```js
const { keepOnlyKnownLinks } = require('../services/blog.links');

test('keepOnlyKnownLinks drops links the rewrite invented', () => {
  const input = { type: 'p', text: 'Try [Moet](/product/moet) tonight.' };
  const output = [
    { type: 'p', text: 'Try [Moet](/product/moet) with [ice](https://invented.example/ice).' },
  ];
  const [block] = keepOnlyKnownLinks(output, input);
  assert.strictEqual(block.text, 'Try [Moet](/product/moet) with ice.');
});

test('keepOnlyKnownLinks checks list items on both sides', () => {
  const input = { type: 'ul', items: ['See [NAFDAC](https://www.nafdac.gov.ng/x)'] };
  const output = [
    { type: 'ul', items: ['See [NAFDAC](https://www.nafdac.gov.ng/x)', 'And [fake](https://fake.example/y)'] },
  ];
  const [block] = keepOnlyKnownLinks(output, input);
  assert.deepStrictEqual(block.items, [
    'See [NAFDAC](https://www.nafdac.gov.ng/x)',
    'And fake',
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx node --test __tests__/blog.externalLinks.test.js`
Expected: FAIL — `keepOnlyKnownLinks is not a function`.

- [ ] **Step 3: Implement it**

In `server/services/blog.links.js`, add `sanitizeLinks` to the
`require('./blog.helpers')` destructure, then add before `module.exports` (and
export it):

```js
// A rewrite may only preserve links, never introduce them: any href in the
// output that was not in the input is dropped back to plain text.
function keepOnlyKnownLinks(outputBlocks, inputBlock) {
  const known = new Set(extractLinks([inputBlock]).map((l) => l.href));
  return sanitizeLinks(outputBlocks, (href) => known.has(href));
}
```

- [ ] **Step 4: Wire it into generateBlock**

In `server/controllers/blog.controller.js`, add `keepOnlyKnownLinks` to the
`require('../services/blog.links')` destructure. In `generateBlock`'s `try`
block, replace the response handling so both branches route through it:

```js
    const data = parseAiJson(await callHaikuJson(prompt, 1024));
    if (isList) {
      const items = Array.isArray(data.items) ? data.items.map((s) => String(s).trim()).filter(Boolean) : [];
      if (!items.length) throw new Error('AI returned no list items');
      const [safe] = keepOnlyKnownLinks([{ type: block.type, items }], block);
      const cited = await applyExternalCitations([safe]);
      return res.json({ items: cited.content[0].items });
    }
    const text = String(data.text || '').trim();
    if (!text) throw new Error('AI returned empty text');
    const [safe] = keepOnlyKnownLinks([{ type: block.type, text }], block);
    const cited = await applyExternalCitations([safe]);
    return res.json({ text: cited.content[0].text });
```

- [ ] **Step 5: Run the full suite**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/blog.links.js server/controllers/blog.controller.js server/__tests__/blog.externalLinks.test.js
git commit -m "fix(blog): block rewrites can no longer invent or resurrect links"
```

---

### Task 9: Weekly link-check cron

**Files:**
- Create: `server/jobs/blogLinkCheck.job.js`
- Modify: `server/server.js:348-355`
- Test: `server/__tests__/blogLinkCheck.job.test.js`

**Interfaces:**
- Consumes: `verifyLiveUrls`, `makeExternalLinkValidator`, `buildExternalLinkRecords`, `partitionExternalLinks` (Tasks 2, 3, 6); `sanitizeLinks` (Task 1).
- Produces:
  - `scanBlogLinks({ model, fetchImpl, limit }) -> Promise<{ scanned: number, stripped: number }>` — `model` defaults to the `BlogPost` model, injectable for tests.
  - `startBlogLinkCheckCron()`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/blogLinkCheck.job.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx node --test __tests__/blogLinkCheck.job.test.js`
Expected: FAIL — `Cannot find module '../jobs/blogLinkCheck.job'`.

- [ ] **Step 3: Write the job**

Create `server/jobs/blogLinkCheck.job.js`:

```js
// server/jobs/blogLinkCheck.job.js
// Keeps outbound citations honest after publication. Blog posts are written once
// and read for years; the sources they cite move and disappear. This re-checks
// every external link in published posts and strips the dead ones — stripping
// removes the markdown markup only, so the sentence still reads exactly as
// written, minus a link that would have 404'd.
'use strict';

const cron = require('node-cron');
const BlogPost = require('../models/BlogPost');
const { sanitizeLinks } = require('../services/blog.helpers');
const {
  partitionExternalLinks,
  verifyLiveUrls,
  makeExternalLinkValidator,
  buildExternalLinkRecords,
} = require('../services/blog.links');

// Bounded per run so one pass never turns into an hour of outbound requests.
const DEFAULT_LIMIT = 40;

/**
 * Re-verify external links on published posts, oldest check first (a null
 * `linksCheckedAt` sorts ahead of every date, so posts never checked go first).
 * Rewrites content only when a link actually failed.
 */
async function scanBlogLinks(opts = {}) {
  const { model = BlogPost, fetchImpl, limit = DEFAULT_LIMIT } = opts;

  const posts = await model
    .find({ status: 'published', 'externalLinks.0': { $exists: true } })
    .sort({ linksCheckedAt: 1 })
    .limit(limit)
    .lean();

  let stripped = 0;
  for (const post of posts) {
    const { external } = partitionExternalLinks(post.content);
    if (!external.length) continue;

    const verdicts = await verifyLiveUrls(external, fetchImpl ? { fetchImpl } : {});
    const isAllowed = makeExternalLinkValidator(verdicts);
    const dead = external.filter((href) => !isAllowed(href));

    const content = dead.length ? sanitizeLinks(post.content, isAllowed) : post.content;
    dead.forEach((url) => {
      console.log(`blog link check: stripped dead link ${url} from /blog/${post.slug}`);
    });
    stripped += dead.length;

    await model.updateOne(
      { _id: post._id },
      {
        $set: {
          content,
          externalLinks: buildExternalLinkRecords(content, verdicts),
          linksCheckedAt: new Date(),
        },
      }
    );
  }

  return { scanned: posts.length, stripped };
}

/** Start the link-check cron (guarded by the caller). Runs weekly, Monday 04:00. */
function startBlogLinkCheckCron() {
  cron.schedule('0 4 * * 1', () => {
    scanBlogLinks().catch((e) => console.error('blog link check cron error:', e.message));
  });
  console.log('   Cron:        blog external link check (weekly, Mon 04:00)');
}

module.exports = { scanBlogLinks, startBlogLinkCheckCron };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx node --test __tests__/blogLinkCheck.job.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Register the cron**

In `server/server.js`, inside the existing
`if (process.env.ENABLE_CRON === 'true' || process.env.NODE_ENV === 'production')`
block (line 348), after the `startBannerScheduleCron();` line:

```js
      const { startBlogLinkCheckCron } = require('./jobs/blogLinkCheck.job');
      startBlogLinkCheckCron();
```

- [ ] **Step 6: Run the full suite**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/jobs/blogLinkCheck.job.js server/server.js server/__tests__/blogLinkCheck.job.test.js
git commit -m "feat(blog): weekly cron strips external links that have gone dead"
```

---

### Task 10: Render external links on both surfaces

Both renderers match leading-slash hrefs only, so an external citation would show
as the literal string `[NAFDAC](https://...)`. Without this task the whole feature
is invisible.

**Files:**
- Modify: `client/apps/platform/src/app/blog/blog-content.tsx:11-31`
- Modify: `client/apps/admin/src/app/shared/blog/blog-preview.tsx:14` and its link branch

- [ ] **Step 1: Widen the platform renderer**

In `client/apps/platform/src/app/blog/blog-content.tsx`, replace the comment and
regex at lines 7-11 with:

```tsx
// Parse inline markdown into styled nodes, leaving surrounding text intact:
//   [anchor](/internal/path)      → internal Next link
//   [anchor](https://example.com) → external link, new tab
//   **bold**                      → <strong>
//   *italic*                      → <em>
const INLINE_TOKEN_RE =
  /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

const LINK_CLASS =
  'font-semibold text-red-700 underline decoration-red-300 underline-offset-2 transition-colors hover:decoration-red-600';
```

Then replace the `if (m[2])` branch (lines 22-31) with:

```tsx
    if (m[2]) {
      parts.push(
        m[2].startsWith('/') ? (
          <Link key={`lnk-${key++}`} href={m[2]} className={LINK_CLASS}>
            {m[1]}
          </Link>
        ) : (
          // Citations point off-site: open in a new tab, and no nofollow —
          // these are deliberate links to authorities.
          <a
            key={`lnk-${key++}`}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {m[1]}
            <Icon.PiArrowUpRightBold
              aria-hidden
              className="ms-0.5 inline h-3 w-3 align-baseline"
            />
          </a>
        ),
      );
    } else if (m[3] !== undefined) {
```

- [ ] **Step 2: Mirror it in the admin preview**

Apply the same two changes to
`client/apps/admin/src/app/shared/blog/blog-preview.tsx`: widen the
`INLINE_TOKEN_RE` at line 14 to the identical pattern, and branch the link case
on `m[2].startsWith('/')` exactly as above, matching that file's existing link
classNames rather than copying the platform ones. If it does not already import
from `react-icons/pi`, add `import { PiArrowUpRightBold } from 'react-icons/pi';`
and use the bare component name.

- [ ] **Step 3: Typecheck both apps**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "\.next/types" | wc -l`
Expected: `0`.

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "\.next/types" | wc -l`
Expected: no higher than the 479-error baseline.

- [ ] **Step 4: Commit**

```bash
git add client/apps/platform/src/app/blog/blog-content.tsx client/apps/admin/src/app/shared/blog/blog-preview.tsx
git commit -m "feat(blog): render external citations as new-tab links on blog and preview"
```

---

### Task 11: End-to-end smoke test

Everything above is unit-tested with fakes. This is the only step that proves the
search tool, the live checker and the renderer work against reality.

**Files:** none — verification only.

- [ ] **Step 1: Start the server with cron enabled**

Run from `server/`: `ENABLE_CRON=true npm run dev` (or the repo's usual start
command). Confirm the startup log includes the blog link-check cron line.

- [ ] **Step 2: Generate a post through the admin UI**

In the admin blog editor, generate a post on a topic with real external
sources — e.g. "How Nigerian wine labelling rules affect imported reds". Watch the
server log for the line:

```
generatePost "...": N internal link(s), M external citation(s) kept, K dead stripped, B blocked
```

Expected: `M >= 1`.

- [ ] **Step 3: Verify every cited URL by hand**

Open each external link in the generated draft. Every one must load. If any 404s,
the verification pass has a hole — stop and debug rather than continuing.

- [ ] **Step 4: Check the rendering**

Save and publish the post, open it on the platform blog, and confirm external
citations render as links with the arrow icon, open in a new tab, and that
internal catalog links still work.

- [ ] **Step 5: Exercise the cron path once**

Run from `server/`:

```bash
node -e "require('dotenv').config(); const m=require('mongoose'); m.connect(process.env.MONGODB_URI).then(async()=>{ const {scanBlogLinks}=require('./jobs/blogLinkCheck.job'); console.log(await scanBlogLinks({limit:5})); process.exit(0); });"
```

Expected: a `{ scanned, stripped }` summary, `stripped: 0` for healthy
posts, and no content changes to a post whose links are all alive.

Note: Atlas blocks connections from unrecognized IPs — if this fails to connect,
run it from a permitted host rather than assuming the job is broken.

- [ ] **Step 6: Commit nothing, report results**

Report which steps passed and paste the `generatePost` log line. If step 3 found a
dead link, that is a bug in Task 3 or 5, not an acceptable outcome.
