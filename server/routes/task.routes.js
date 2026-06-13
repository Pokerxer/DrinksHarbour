const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTask, deleteTask } = require('../controllers/task.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);

router.route('/').get(tenantAdminOrSuperAdmin, getTasks).post(tenantAdminOrSuperAdmin, createTask);
router.route('/:id').put(tenantAdminOrSuperAdmin, updateTask).delete(tenantAdminOrSuperAdmin, deleteTask);

module.exports = router;
