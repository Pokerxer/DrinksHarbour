// server/controllers/adClick.controller.js
// PUBLIC merchandising-ads endpoints (no auth): the dedupe/charge click
// pipeline and impression counting. Thin — all money logic lives in
// server/services/adClick.service.js; the client decides what a refusal
// means, so refusals return 200 JSON (only an unknown campaign is 404).
const asyncHandler = require('../utils/asyncHandler');
const adClickService = require('../services/adClick.service');

// Stable visitor key: the client's localStorage id when provided, else a
// sha256 hex slice of the caller IP (no new deps; dedupe only, not identity).
const visitorKeyOf = (req) => {
  const raw = req.body?.visitorKey;
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 128);
  return adClickService.hashVisitorKey(req.ip);
};

// POST /api/ads/clicks/:campaignId — dedupe + prepaid debit + redirect target.
exports.click = asyncHandler(async (req, res) => {
  const result = await adClickService.recordClick(
    req.params.campaignId,
    visitorKeyOf(req),
    req.ip
  );
  if (!result.ok && result.reason === 'not_found') {
    return res.status(404).json({ success: false, reason: 'not_found' });
  }
  return res.status(200).json({ success: Boolean(result.ok), ...result });
});

// POST /api/ads/impressions/:campaignId — fire-and-forget counter.
exports.impression = asyncHandler(async (req, res) => {
  await adClickService.recordImpression(req.params.campaignId);
  return res.status(200).json({ success: true });
});
