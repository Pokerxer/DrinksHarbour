// server/utils/frontendUrl.js
//
// Single source of truth for "where does the customer come back to?".
//
// Payment gateways validate these strictly: Korapay rejects a charge with
// "redirect_url must be a valid uri" if the URL has no scheme, which surfaces to
// the shopper as the useless "One or more fields are invalid" 400. Env values in
// the wild routinely arrive as `drinksharbour.com`, with a trailing slash, or
// wrapped in quotes, so normalise instead of trusting them.

const DEFAULT_BASE_URL = 'http://localhost:3002';

/**
 * Coerce a config value into an absolute http(s) URL, or null if it can't be one.
 * Keeps path/query/hash; drops a bare trailing slash so joins stay clean.
 */
const normalizeUrl = (value) => {
  if (typeof value !== 'string') return null;

  const raw = value.trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!raw) return null;

  if (raw.startsWith('/')) return null; // a relative path can never be made absolute here

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  let url;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
  // Without a scheme the first segment could be anything ("payment/verify"), so
  // only accept it if it actually looks like a host.
  if (!hasScheme && !url.hostname.includes('.') && url.hostname !== 'localhost') return null;

  const out = url.toString();
  return out.endsWith('/') && !url.search && !url.hash ? out.slice(0, -1) : out;
};

/**
 * Public site origin, e.g. https://www.drinksharbour.com — first usable value
 * among the caller's preferences, then the configured env vars, then localhost.
 */
const frontendBaseUrl = (...preferred) => {
  const candidates = [
    ...preferred,
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.PLATFORM_URL,
    DEFAULT_BASE_URL,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_BASE_URL;
};

/**
 * Absolute URL for a path on the public site: frontendUrl('/payment/verify').
 */
const frontendUrl = (path = '') => {
  const base = frontendBaseUrl();
  const suffix = String(path || '').replace(/^\/+/, '');
  return suffix ? `${base}/${suffix}` : base;
};

module.exports = { normalizeUrl, frontendBaseUrl, frontendUrl, DEFAULT_BASE_URL };
