// scripts/lib/api-client.js
//
// Thin HTTP client for the seeder.
//
// Why Bearer-only, never cookies: server/middleware/csrf.middleware.js applies
// double-submit CSRF to every mutating /api request that carries the dh_access
// cookie, but explicitly exempts requests authenticated with an
// `Authorization: Bearer` header. Sending the token in the header instead of
// letting cookies ride along sidesteps CSRF entirely — no token juggling, and
// it exercises the same path the mobile client uses.

const DEFAULT_TIMEOUT_MS = 30_000;

class ApiError extends Error {
  constructor(message, { status, body, method, path }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.method = method;
    this.path = path;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ApiClient {
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl        e.g. http://localhost:5000
   * @param {string} [opts.token]        Bearer token for authenticated calls
   * @param {number} [opts.retries]      retry attempts for transient failures
   * @param {number} [opts.timeoutMs]
   * @param {(msg: string) => void} [opts.onRetry]
   */
  constructor({ baseUrl, token = null, retries = 3, timeoutMs = DEFAULT_TIMEOUT_MS, onRetry = () => {} }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.token = token;
    this.retries = retries;
    this.timeoutMs = timeoutMs;
    this.onRetry = onRetry;
  }

  /** Return a copy of this client bound to a different token. */
  withToken(token) {
    return new ApiClient({
      baseUrl: this.baseUrl,
      token,
      retries: this.retries,
      timeoutMs: this.timeoutMs,
      onRetry: this.onRetry,
    });
  }

  async request(method, path, { body, query, token } = {}) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }

    const authToken = token !== undefined ? token : this.token;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    let lastError;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      let response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
          // Explicitly do not send or store cookies — see the CSRF note above.
          redirect: 'follow',
        });
      } catch (err) {
        // Network-level failure (connection refused, DNS, timeout).
        lastError = new ApiError(`Network failure: ${err.message}`, {
          status: 0, body: null, method, path,
        });
        if (attempt < this.retries) {
          const wait = 500 * 2 ** attempt;
          this.onRetry(`${method} ${path} network error, retrying in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        throw lastError;
      }

      const text = await response.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { raw: text };
      }

      if (response.ok) return parsed;

      const message = parsed?.message || parsed?.error || `HTTP ${response.status}`;
      lastError = new ApiError(message, {
        status: response.status, body: parsed, method, path,
      });

      // 429 is a rate limiter, not a transient blip. Honour Retry-After when the
      // limiter sends one, otherwise back off hard. Never hammer.
      if (response.status === 429 && attempt < this.retries) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 5_000 * 2 ** attempt;
        this.onRetry(`${method} ${path} rate limited (429), waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }

      // 5xx is worth retrying; 4xx is a contract error and will not fix itself.
      if (response.status >= 500 && attempt < this.retries) {
        const wait = 500 * 2 ** attempt;
        this.onRetry(`${method} ${path} returned ${response.status}, retrying in ${wait}ms`);
        await sleep(wait);
        continue;
      }

      throw lastError;
    }

    throw lastError;
  }

  get(path, opts)   { return this.request('GET', path, opts); }
  post(path, body, opts) { return this.request('POST', path, { ...opts, body }); }
  put(path, body, opts)  { return this.request('PUT', path, { ...opts, body }); }
  patch(path, body, opts){ return this.request('PATCH', path, { ...opts, body }); }
}

module.exports = { ApiClient, ApiError, sleep };
