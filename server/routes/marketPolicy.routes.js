'use strict';
const router = require('express').Router();
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/auth.middleware');
const service = require('../services/marketPolicy/management');
router.use(protect, (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', asyncHandler(async (req, res) => res.json({ success: true, data: await service.listPolicies({ actor: req.user }) })));
router.post('/', asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createPolicy({ actor: req.user, input: req.body }) })));
module.exports = router;
