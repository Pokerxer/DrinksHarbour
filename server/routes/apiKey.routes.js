'use strict';
const router = require('express').Router();
const ApiKey = require('../models/ApiKey');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError } = require('../utils/errors');
const { protect, attachTenant, requireOwnTenant, authorizeTenantAction } = require('../middleware/auth.middleware');
const { requireCapability } = require('../middleware/plan.middleware');
const { issueKey, PUBLIC_FIELDS } = require('../services/apiKey.service');
router.use(protect, attachTenant, requireOwnTenant, requireCapability('api_access'));
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/', authorizeTenantAction('settings:read'), asyncHandler(async (req, res) => {
  const keys = await ApiKey.find({ tenant: req.user.tenant }).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { keys } });
}));
router.post('/', authorizeTenantAction('settings:write'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await issueKey(req.tenant, req.user._id, req.body) });
}));
router.delete('/:id', authorizeTenantAction('settings:write'), asyncHandler(async (req, res) => {
  const result = await ApiKey.updateOne({ _id: req.params.id, tenant: req.user.tenant },
    { $set: { revokedAt: new Date() } });
  if (!result.matchedCount) throw new NotFoundError('API key not found');
  res.json({ success: true });
}));
module.exports = router;
