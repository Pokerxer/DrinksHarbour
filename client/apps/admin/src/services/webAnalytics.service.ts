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

type ApiResponse<T> = { success: boolean; data: T };

async function apiFetch<T>(url: string, headers: HeadersInit): Promise<T> {
  const res = await fetch(url, { headers });
  const json = (await res.json()) as ApiResponse<T>;
  return json.data;
}

export async function getWebAnalyticsData(token: string): Promise<WebAnalyticsData> {
  const h = authHeaders(token);
  const base = `${API_URL}/api/analytics`;

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
  const res = await fetch(`${API_URL}/api/analytics/audience?period=${period}`, { headers: authHeaders(token) });
  const json = await res.json() as ApiResponse<AudiencePoint[]>;
  return json.data;
}

export async function getConversionsByPeriod(token: string, period: 'week' | 'month' | 'year'): Promise<ConversionLocation[]> {
  const res = await fetch(`${API_URL}/api/analytics/conversions?period=${period}`, { headers: authHeaders(token) });
  const json = await res.json() as ApiResponse<ConversionLocation[]>;
  return json.data;
}
