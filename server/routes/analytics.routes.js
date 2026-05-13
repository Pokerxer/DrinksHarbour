const express = require('express');
const router  = express.Router();
const { getDashboard } = require('../controllers/analytics.controller');
const { protect, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.get('/dashboard', protect, tenantAdminOrSuperAdmin, getDashboard);

module.exports = router;
