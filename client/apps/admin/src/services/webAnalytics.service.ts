const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface WebOverview {
  traffic: { current: number; previous: number; pctChange: number };
  bounceRate: { current: number; previous: number; pctChange: number };
  conversionRate: { current: number; previous: number; pctChange: number };
  avgSessionDuration: { current: number; previous: number; pctChange: number };
}

export interface AcquisitionPoint {
  day: string;
  bounceRate: number;
  pageSession: number;
}

export interface DeviceSessions {
  totals: { mobile: number; desktop: number; tablet: number };
  byDay: Array<{ day: string; mobile: number; desktop: number; others: number }>;
}

export interface TrafficSource {
  name: string;
  value: number;
}

export interface AudiencePoint {
  month: string;
  newUser: number;
  user: number;
  sessions: number;
}

export interface ConversionLocation {
  country: string;
  amount: number;
}

export interface GoalAccomplished {
  newCustomers: { value: number; percentage: number };
  conversionRate: { value: string; percentage: number };
  pageSession: { value: string; percentage: number };
}

export interface PageMetricItem {
  id: string;
  pages: string;
  trafficShare: number;
  uniquePreviews: number;
  chart: Array<{ label: string; count: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionPoint {
  day: string;
  expansions: number;
  cancellations: number;
}

export interface RetentionSummary {
  expansions: number;
  cancellations: number;
}

export interface ChannelMetric {
  id: string;
  channel: string;
  users: number;
  sessions: number;
  engagementRate: number;
  engagementTime: string;
  bounceRate: number;
  chart: Array<{ label: string; count: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface WebAnalyticsData {
  overview: WebOverview;
  acquisition: AcquisitionPoint[];
  devices: DeviceSessions;
  trafficSources: TrafficSource[];
  audience: AudiencePoint[];
  conversions: ConversionLocation[];
  goals: GoalAccomplished;
  pages: PageMetricItem[];
  retention: { data: RetentionPoint[]; summary: RetentionSummary };
  channels: ChannelMetric[];
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

type ApiResponse<T> = { success: boolean; data?: T; message?: string };

/** `/api/analytics/web-overview` — enough to identify the endpoint in a log. */
const endpointLabel = (url: string): string => url.replace(/^https?:\/\/[^/]+/, '');

/**
 * Fetch one analytics endpoint, or throw.
 *
 * The status and the `success` flag must both be checked. `errorResponse` sends
 * `{ success: false, message }` with **no `data` key**, so unwrapping
 * `json.data` unconditionally turned every 401/500 into `undefined` — and
 * `Promise.all` then assembled a truthy object from ten undefineds. The
 * dashboard's `if (!data)` skeleton guard could not catch that, and the first
 * component to dereference `data.overview` threw a TypeError three layers away
 * from the actual failure. Failing here lets the caller's `catch` put the
 * skeletons up instead.
 */
class AnalyticsRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function apiFetch<T>(url: string, headers: HeadersInit): Promise<T> {
  const label = endpointLabel(url);
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (cause) {
    throw new Error(`Analytics request to ${label} could not reach the server`, { cause });
  }

  // A gateway or proxy can answer with HTML; `res.json()` would then throw a
  // parse error naming neither the endpoint nor the status.
  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    json = null;
  }

  if (!res.ok || !json || json.success !== true) {
    const reason = json?.message ?? 'response was not a readable API envelope';
    throw new AnalyticsRequestError(`Analytics request to ${label} failed (HTTP ${res.status}): ${reason}`, res.status);
  }
  if (json.data === undefined || json.data === null) {
    throw new Error(`Analytics request to ${label} succeeded but returned no data`);
  }
  return json.data;
}

export async function getWebAnalyticsData(token: string): Promise<WebAnalyticsData> {
  const h = authHeaders(token);
  const base = `${API_URL}/api/analytics`;
  try {
    const report = await apiFetch<WebAnalyticsData>(`${base}/web-report`, h);
    const required: (keyof WebAnalyticsData)[] = ['overview', 'acquisition', 'devices', 'trafficSources', 'audience', 'conversions', 'goals', 'pages', 'retention', 'channels'];
    if (required.some(key => report[key] === undefined || report[key] === null)) {
      throw new Error('Analytics web-report returned an incomplete report');
    }
    return report;
  } catch (error) {
    // During rollout an older API can still serve the individual endpoints.
    // Authentication and aggregation failures must never trigger ten retries.
    if (!(error instanceof AnalyticsRequestError) || error.status !== 404) throw error;
  }

  const [
    overview,
    acquisition,
    devices,
    trafficSources,
    audience,
    conversions,
    goals,
    pages,
    retention,
    channels,
  ] = await Promise.all([
    apiFetch<WebOverview>(`${base}/web-overview`, h),
    apiFetch<AcquisitionPoint[]>(`${base}/acquisition`, h),
    apiFetch<DeviceSessions>(`${base}/devices`, h),
    apiFetch<TrafficSource[]>(`${base}/traffic-sources`, h),
    apiFetch<AudiencePoint[]>(`${base}/audience`, h),
    apiFetch<ConversionLocation[]>(`${base}/conversions`, h),
    apiFetch<GoalAccomplished>(`${base}/goals`, h),
    apiFetch<PageMetricItem[]>(`${base}/pages`, h),
    apiFetch<{ data: RetentionPoint[]; summary: RetentionSummary }>(`${base}/retention`, h),
    apiFetch<ChannelMetric[]>(`${base}/channels`, h),
  ]);

  return {
    overview,
    acquisition,
    devices,
    trafficSources,
    audience,
    conversions,
    goals,
    pages,
    retention,
    channels,
  };
}

// ---------------------------------------------------------------------------
// Period-based helpers
// ---------------------------------------------------------------------------

export async function getAudienceByPeriod(token: string, period: 'week' | 'month' | 'year'): Promise<AudiencePoint[]> {
  return apiFetch<AudiencePoint[]>(`${API_URL}/api/analytics/audience?period=${period}`, authHeaders(token));
}

export async function getConversionsByPeriod(token: string, period: 'week' | 'month' | 'year'): Promise<ConversionLocation[]> {
  return apiFetch<ConversionLocation[]>(`${API_URL}/api/analytics/conversions?period=${period}`, authHeaders(token));
}
