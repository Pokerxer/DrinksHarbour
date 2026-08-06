// routes/driver.routes.js
const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const c = require('../controllers/driver.controller');
const { validate } = require('../middleware/validation.middleware');
const { VEHICLE_TYPES, DRIVER_STATUSES } = require('../models/Driver');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
  requireOwnTenant,
} = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);
// Riders belong to one tenant — same posture as the deliveries they run.
router.use(requireOwnTenant);

router
  .route('/')
  .get(tenantAdminOrSuperAdmin, c.listDrivers)
  .post(
    tenantAdminOrSuperAdmin,
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('email').optional({ checkFalsy: true }).isEmail(),
    body('vehicle.type').optional({ checkFalsy: true }).isIn(VEHICLE_TYPES),
    body('status').optional().isIn(DRIVER_STATUSES),
    body('licenseExpiry').optional({ nullable: true }).isISO8601(),
    validate,
    c.createDriver
  );

router
  .route('/:id')
  .get(tenantAdminOrSuperAdmin, param('id').isMongoId(), validate, c.getDriver)
  .patch(
    tenantAdminOrSuperAdmin,
    param('id').isMongoId(),
    body('email').optional({ checkFalsy: true }).isEmail(),
    body('vehicle.type').optional({ checkFalsy: true }).isIn(VEHICLE_TYPES),
    body('status').optional().isIn(DRIVER_STATUSES),
    body('licenseExpiry').optional({ nullable: true }).isISO8601(),
    validate,
    c.updateDriver
  )
  .delete(tenantAdminOrSuperAdmin, param('id').isMongoId(), validate, c.deactivateDriver);

module.exports = router;
