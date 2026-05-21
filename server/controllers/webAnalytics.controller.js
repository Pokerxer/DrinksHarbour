'use strict';

const asyncHandler = require('express-async-handler');
const {
  recordPageView,
  updatePageDuration,
  getOverview,
  getAcquisitionData,
  getDeviceSessions,
  getTrafficSources,
  getAudienceMetrics,
  getConversionsByLocation,
  getGoalAccomplished,
  getPageMetrics,
  getAccountRetention,
  getWebsiteChannels,
} = require('../services/webAnalytics.service');

// ─── Source parser helper ─────────────────────────────────────────────────────

function parseSource(referrer = '', utmMedium = '', utmSource = '') {
  const ref = referrer.toLowerCase();

  if (utmMedium === 'email' || utmSource === 'email') return 'email';
  if (ref.includes('google'))                          return 'google';
  if (ref.includes('facebook') || ref.includes('fb.com')) return 'facebook';
  if (ref.includes('instagram'))                       return 'instagram';
  if (ref.includes('youtube') || ref.includes('youtu.be')) return 'youtube';
  if (ref.includes('twitter') || ref.includes('t.co')) return 'twitter';
  if (!ref || ref === '')                              return 'direct';
  return 'referral';
}

// ─── Device detection helper (server-side fallback) ──────────────────────────

function detectDeviceFromUA(ua = '') {
  if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet';
  if (/Mobile|Android|iPhone|iPod/.test(ua)) return 'mobile';
  return 'desktop';
}

// ─── 1. trackPageView — POST /api/analytics/track (public) ──────────────────

const trackPageView = asyncHandler(async (req, res) => {
  const {
    sessionId,
    page,
    title       = '',
    referrer    = '',
    source,
    medium      = '',
    os          = '',
    browser     = '',
    country     = 'Nigeria',
    state       = '',
    city        = '',
    isNewUser       = false,
    isFirstInSession = false,
    utmSource   = '',
    utmMedium   = '',
    utmCampaign = '',
    userId      = null,
  } = req.body;

  // Server-side device detection fallback
  const device = req.body.device || detectDeviceFromUA(req.headers['user-agent']);

  // Validate and clamp duration if provided
  let duration = req.body.duration;
  if (duration !== undefined && duration !== null) {
    duration = Number(duration);
    if (isNaN(duration) || duration < 0) duration = 0;
    if (duration > 3600) duration = 3600;
  }

  const resolvedSource = source || parseSource(referrer, utmMedium, utmSource);

  await recordPageView({
    sessionId,
    page,
    title,
    referrer,
    source:          resolvedSource,
    medium,
    device,
    os,
    browser,
    country,
    state,
    city,
    isNewUser,
    isFirstInSession,
    utmSource,
    utmMedium,
    utmCampaign,
    userId: userId || null,
    ...(duration !== undefined && duration !== null ? { duration } : {}),
  });

  res.json({ success: true });
});

// ─── 2. updateDuration — PATCH /api/analytics/track/duration (public) ────────

const updateDuration = asyncHandler(async (req, res) => {
  const { sessionId, page } = req.body;

  let duration = Number(req.body.duration);

  if (isNaN(duration) || duration <= 0) {
    return res.status(400).json({ success: false, message: 'duration must be a positive number' });
  }
  if (duration > 3600) duration = 3600;

  await updatePageDuration({ sessionId, page, duration });
  res.json({ success: true });
});

// ─── 3. getOverview — GET /api/analytics/web-overview (admin) ────────────────

const getOverviewController = asyncHandler(async (req, res) => {
  const period = parseInt(req.query.period, 10) || 30;
  const data   = await getOverview(period);
  res.json({ success: true, data });
});

// ─── 4. getAcquisition — GET /api/analytics/acquisition (admin) ──────────────

const getAcquisition = asyncHandler(async (req, res) => {
  const data = await getAcquisitionData();
  res.json({ success: true, data });
});

// ─── 5. getDevices — GET /api/analytics/devices (admin) ──────────────────────

const getDevices = asyncHandler(async (req, res) => {
  const data = await getDeviceSessions();
  res.json({ success: true, data });
});

// ─── 6. getTrafficSourcesController — GET /api/analytics/traffic-sources ─────

const getTrafficSourcesController = asyncHandler(async (req, res) => {
  const data = await getTrafficSources();
  res.json({ success: true, data });
});

// ─── 7. getAudience — GET /api/analytics/audience (admin) ────────────────────

const getAudience = asyncHandler(async (req, res) => {
  const period = req.query.period || 'year';
  const data = await getAudienceMetrics(period);
  res.json({ success: true, data });
});

// ─── 8. getConversions — GET /api/analytics/conversions (admin) ──────────────

const getConversions = asyncHandler(async (req, res) => {
  const period = req.query.period || 'year';
  const data = await getConversionsByLocation(period);
  res.json({ success: true, data });
});

// ─── 9. getGoals — GET /api/analytics/goals (admin) ──────────────────────────

const getGoals = asyncHandler(async (req, res) => {
  const data = await getGoalAccomplished();
  res.json({ success: true, data });
});

// ─── 10. getPages — GET /api/analytics/pages (admin) ─────────────────────────

const getPages = asyncHandler(async (req, res) => {
  const data = await getPageMetrics();
  res.json({ success: true, data });
});

// ─── 11. getRetention — GET /api/analytics/retention (admin) ─────────────────

const getRetention = asyncHandler(async (req, res) => {
  const data = await getAccountRetention();
  res.json({ success: true, data });
});

// ─── 12. getChannels — GET /api/analytics/channels (admin) ───────────────────

const getChannels = asyncHandler(async (req, res) => {
  const data = await getWebsiteChannels();
  res.json({ success: true, data });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  trackPageView,
  updateDuration,
  getOverview:        getOverviewController,
  getAcquisition,
  getDevices,
  getTrafficSources:  getTrafficSourcesController,
  getAudience,
  getConversions,
  getGoals,
  getPages,
  getRetention,
  getChannels,
};
