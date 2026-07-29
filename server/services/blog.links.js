// services/blog.links.js — external-citation policy and live URL verification
// for the blog module. The only place in the blog code that talks to the open
// internet; every network call goes through `verifyLiveUrls`, which takes an
// injectable fetch so tests never leave the process.
'use strict';

const { extractLinks, sanitizeLinks, isInternalHref } = require('./blog.helpers');

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

// A rewrite may only preserve links, never introduce them: any href in the
// output that was not in the input is dropped back to plain text.
function keepOnlyKnownLinks(outputBlocks, inputBlock) {
  const known = new Set(extractLinks([inputBlock]).map((l) => l.href));
  return sanitizeLinks(outputBlocks, (href) => known.has(href));
}

module.exports = {
  BLOCKED_DOMAINS,
  hostOf,
  isBlockedUrl,
  partitionExternalLinks,
  verifyLiveUrls,
  makeExternalLinkValidator,
  clearUrlCache,
  buildExternalLinkRecords,
  keepOnlyKnownLinks,
};
