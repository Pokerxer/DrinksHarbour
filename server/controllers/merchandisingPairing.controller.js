// server/controllers/merchandisingPairing.controller.js
// Tenant-dashboard CRUD for manual upsell pairings (capability-gated).
const asyncHandler = require('../utils/asyncHandler');
const pairingService = require('../services/merchandisingPairing.service');

// Tenant comes from the JWT (Workstream A) — req.user.tenant. A user without
// a tenant (platform staff) has no pairings by definition. Belt and braces:
// the router already sits behind requireOwnTenant, which refuses the same
// requests earlier with a clearer message.
const tenantOf = (req) => {
  if (!req.user?.tenant) {
    const err = new Error('Tenant context required');
    err.status = 403;
    throw err;
  }
  return req.user.tenant;
};

exports.listPairings = asyncHandler(async (req, res) => {
  const rows = await pairingService.listPairings(tenantOf(req));
  res.status(200).json({ success: true, data: rows });
});

exports.upsertPairing = asyncHandler(async (req, res) => {
  const { sourceProduct, suggestedProducts, active } = req.body || {};
  const row = await pairingService.upsertPairing(tenantOf(req), req.user._id, {
    sourceProduct, suggestedProducts, active,
  });
  res.status(200).json({ success: true, data: row });
});

exports.deletePairing = asyncHandler(async (req, res) => {
  const row = await pairingService.deletePairing(tenantOf(req), req.params.id);
  res.status(200).json({ success: true, data: row });
});
