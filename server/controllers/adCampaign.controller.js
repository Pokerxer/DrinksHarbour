// server/controllers/adCampaign.controller.js
// Tenant-dashboard CRUD for self-serve ad campaigns. Ads are an a-la-carte
// revenue stream for any paying tenant — there is NO plan capability gate;
// the prepaid ad wallet is the gate (activation refuses without funds, see
// the service).
const asyncHandler = require('../utils/asyncHandler');
const adCampaignService = require('../services/adCampaign.service');

// Tenant comes from the JWT (Workstream A) — req.user.tenant. A user without
// a tenant (platform staff acting alone) has no campaigns by definition.
// Belt and braces: the router already sits behind tenantAdminOrSuperAdmin.
const tenantOf = (req) => {
  if (!req.user?.tenant) {
    const err = new Error('Tenant context required');
    err.status = 403;
    throw err;
  }
  return req.user.tenant;
};

exports.listCampaigns = asyncHandler(async (req, res) => {
  const rows = await adCampaignService.listCampaigns(tenantOf(req));
  res.status(200).json({ success: true, data: rows });
});

exports.createCampaign = asyncHandler(async (req, res) => {
  const row = await adCampaignService.createCampaign(tenantOf(req), req.user._id, req.body || {});
  res.status(201).json({ success: true, data: row });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const row = await adCampaignService.updateCampaignStatus(tenantOf(req), req.params.id, req.body?.status);
  res.status(200).json({ success: true, data: row });
});

exports.deleteCampaign = asyncHandler(async (req, res) => {
  const row = await adCampaignService.deleteCampaign(tenantOf(req), req.params.id);
  res.status(200).json({ success: true, data: row });
});

exports.getSummary = asyncHandler(async (req, res) => {
  const summary = await adCampaignService.getCampaignSummary(tenantOf(req));
  res.status(200).json({ success: true, data: summary });
});
