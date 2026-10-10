const test = require('node:test');
const assert = require('node:assert/strict');
const { getWebAnalyticsReport } = require('../services/webAnalyticsReport');
const methods = ['getOverview', 'getAcquisitionData', 'getDeviceSessions', 'getTrafficSources', 'getAudienceMetrics', 'getConversionsByLocation', 'getGoalAccomplished', 'getPageMetrics', 'getAccountRetention', 'getWebsiteChannels'];
test('all report metrics start concurrently and preserve their individual result shapes', async () => {
  const started = []; const releases = [];
  const service = Object.fromEntries(methods.map(method => [method, () => {
    started.push(method); return new Promise(resolve => releases.push(() => resolve({ metric: method })));
  }]));
  const report = getWebAnalyticsReport(service);
  assert.equal(started.length, 10);
  releases.forEach(release => release());
  const data = await report;
  assert.equal(data.overview.metric, 'getOverview'); assert.equal(data.retention.metric, 'getAccountRetention'); assert.equal(Object.keys(data).length, 10);
});
test('a failed metric rejects the entire report', async () => {
  const service = Object.fromEntries(methods.map(method => [method, async () => []]));
  service.getDeviceSessions = async () => { throw new Error('Device query failed'); };
  await assert.rejects(getWebAnalyticsReport(service), /Device query failed/);
});
