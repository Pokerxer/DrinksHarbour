'use strict';
const webAnalytics = require('./webAnalytics.service');
// Same default windows/shapes as the ten original analytics GET endpoints.
async function getWebAnalyticsReport(service = webAnalytics) {
  const [overview, acquisition, devices, trafficSources, audience, conversions, goals, pages, retention, channels] = await Promise.all([
    service.getOverview(30), service.getAcquisitionData(), service.getDeviceSessions(),
    service.getTrafficSources(), service.getAudienceMetrics(), service.getConversionsByLocation(),
    service.getGoalAccomplished(), service.getPageMetrics(), service.getAccountRetention(), service.getWebsiteChannels(),
  ]);
  return { overview, acquisition, devices, trafficSources, audience, conversions, goals, pages, retention, channels };
}
module.exports = { getWebAnalyticsReport };
