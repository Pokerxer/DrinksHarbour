const express = require('express');
const router = express.Router();
const { getMeetings, createMeeting, updateMeeting, deleteMeeting } = require('../controllers/meeting.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router.route('/').get(tenantAdminOrSuperAdmin, getMeetings).post(tenantAdminOrSuperAdmin, createMeeting);
router.route('/:id').put(tenantAdminOrSuperAdmin, updateMeeting).delete(tenantAdminOrSuperAdmin, deleteMeeting);

module.exports = router;
