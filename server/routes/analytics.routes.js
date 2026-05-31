const express = require('express');
const router  = express.Router();
const { getDashboard } = require('../controllers/analytics.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.get('/dashboard', protect, attachTenant, tenantAdminOrSuperAdmin, getDashboard);

module.exports = router;
