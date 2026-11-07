'use strict';
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { saveChannel, listChannels, channelView } = require('../services/salesChannels/management');
router.use(protect);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: { channels: await listChannels(req.user) } });
}));
router.post('/', authorize('super_admin'), asyncHandler(async (req, res) => {
  const row = await saveChannel(req.body, req.user);
  res.status(201).json({ success: true, data: { channel: channelView(row, true) } });
}));
router.put('/:id', authorize('super_admin'), asyncHandler(async (req, res) => {
  const row = await saveChannel(req.body, req.user, req.params.id);
  res.json({ success: true, data: { channel: channelView(row, true) } });
}));
module.exports = router;
