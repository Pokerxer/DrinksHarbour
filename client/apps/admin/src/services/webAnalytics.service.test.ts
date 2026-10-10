// services/webAnalytics.service.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebAnalyticsData } from './webAnalytics.service';

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** The shape server/utils/response.js#errorResponse sends — note: no `data` key. */
const err = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const OVERVIEW = { traffic: { current: 1200, previous: 1000, pctChange: 20 } };

/** Every endpoint healthy except the ones named. */
function stubAnalytics(broken: Record<string, Response> = {}) {
  return vi.fn(async (url: string) => {
    // Older backends lack the combined report; verify the compatibility path.
    if (String(url).includes('/web-report')) return err(404, 'Report route unavailable');
    for (const [fragment, response] of Object.entries(broken)) {
      if (String(url).includes(fragment)) return response;
    }
    if (String(url).includes('web-overview')) return ok(OVERVIEW);
    if (String(url).includes('retention')) return ok({ data: [], summary: { expansions: 0, cancellations: 0 } });
    if (String(url).includes('acquisition') || String(url).includes('traffic-sources')
      || String(url).includes('audience') || String(url).includes('conversions')
      || String(url).includes('pages') || String(url).includes('channels')) return ok([]);
    return ok({ totals: { mobile: 1, desktop: 2, tablet: 3 }, byDay: [] });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('getWebAnalyticsData', () => {
  it('returns the assembled payload when every endpoint is healthy', async () => {
    vi.stubGlobal('fetch', stubAnalytics());
    const data = await getWebAnalyticsData('token');
    expect(data.overview).toEqual(OVERVIEW);
  });

  it('rejects rather than returning undefined parts when the API errors', async () => {
    // The crash this fixes: `apiFetch` returned `json.data` without checking
    // `res.ok` or `success`, so an error envelope — which has no `data` key —
    // resolved to `undefined`. Promise.all then built a truthy object from ten
    // undefineds, `if (!data)` never fired, and StatCards dereferenced
    // `overview.traffic` on it.
    vi.stubGlobal('fetch', stubAnalytics({ 'web-overview': err(500, 'boom') }));
    await expect(getWebAnalyticsData('token')).rejects.toThrow(/boom/);
  });

  it('rejects on an unauthorized response instead of half-populating', async () => {
    vi.stubGlobal('fetch', stubAnalytics({ 'web-overview': err(401, 'Not authorized') }));
    await expect(getWebAnalyticsData('token')).rejects.toThrow(/Not authorized/);
  });

  it('rejects on a success flag of false even with a 200 status', async () => {
    // errorResponse always sets the status, but a 200 carrying success:false is
    // still a failure and must not be unwrapped as data.
    vi.stubGlobal(
      'fetch',
      stubAnalytics({
        'web-overview': new Response(JSON.stringify({ success: false, message: 'nope' }), { status: 200 }),
      })
    );
    await expect(getWebAnalyticsData('token')).rejects.toThrow(/nope/);
  });

  it('rejects when an endpoint returns success with no data at all', async () => {
    // A partial payload must never be presented as a whole report.
    vi.stubGlobal(
      'fetch',
      stubAnalytics({ 'web-overview': new Response(JSON.stringify({ success: true }), { status: 200 }) })
    );
    await expect(getWebAnalyticsData('token')).rejects.toThrow(/web-overview/);
  });

  it('surfaces a non-JSON body as a failure, not a silent empty payload', async () => {
    // A proxy or gateway HTML error page; `res.json()` would throw a parse
    // error that says nothing about which endpoint failed.
    vi.stubGlobal(
      'fetch',
      stubAnalytics({ 'web-overview': new Response('<html>502</html>', { status: 502 }) })
    );
    await expect(getWebAnalyticsData('token')).rejects.toThrow(/web-overview/);
  });

  it('names the endpoint that failed so the log is actionable', async () => {
    vi.stubGlobal('fetch', stubAnalytics({ '/devices': err(500, 'device query failed') }));
    await expect(getWebAnalyticsData('token')).rejects.toThrow(/\/devices/);
  });

  it('fails cleanly on the route-not-found 404 this dashboard actually gets', async () => {
    // The literal live condition: none of the ten endpoints this service calls
    // are registered, so every one answers 404 with the custom handler's
    // envelope, which carries no `data` key. Unwrapped blindly, all ten resolved
    // to `undefined` and the dashboard rendered a truthy-but-empty object.
    const routeNotFound = new Response(
      JSON.stringify({
        success: false,
        message: 'Route GET /api/analytics/web-overview not found',
        availableRoutes: ['GET /health'],
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
    vi.stubGlobal('fetch', vi.fn(async () => routeNotFound));
    await expect(getWebAnalyticsData('token')).rejects.toThrow(/HTTP 404/);
  });
});

const REPORT = { overview: OVERVIEW, acquisition: [], devices: { totals: {}, byDay: [] }, trafficSources: [], audience: [], conversions: [], goals: {}, pages: [], retention: { data: [], summary: {} }, channels: [] };
it('loads a complete website report in one authenticated request', async () => {
  const fetch = vi.fn(async (_url: string, _options: unknown) => ok(REPORT));
  vi.stubGlobal('fetch', fetch);
  expect(await getWebAnalyticsData('token')).toEqual(REPORT);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain('/api/analytics/web-report');
});
it('never fans out after the combined report rejects authentication', async () => {
  const fetch = vi.fn(async () => err(401, 'Not authorized'));
  vi.stubGlobal('fetch', fetch);
  await expect(getWebAnalyticsData('token')).rejects.toThrow(/Not authorized/);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('rejects an incomplete combined report instead of displaying partial metrics', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ok({ overview: OVERVIEW })));
  await expect(getWebAnalyticsData('token')).rejects.toThrow(/incomplete/);
});
