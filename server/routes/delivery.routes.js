// routes/delivery.routes.js
const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const c = require('../controllers/delivery.controller');
const { validate } = require('../middleware/validation.middleware');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
  requireOwnTenant,
} = require('../middleware/auth.middleware');

router.use(protect);
router.use(attachTenant);
// Tenant-owned module, same posture as warehouses/purchases/POS: the tenant
// comes from the JWT claim only — no x-tenant-slug/?tenant= pivot, no
// client-supplied tenantId, no platform-admin bypass.
router.use(requireOwnTenant);

// Literal segments before '/:id' so they are not read as ids.
router.get('/dashboard', tenantAdminOrSuperAdmin, c.getDashboard);
router.get('/unassigned', tenantAdminOrSuperAdmin, c.getUnassigned);

router
  .route('/')
  .get(tenantAdminOrSuperAdmin, c.listDeliveries)
  .post(
    tenantAdminOrSuperAdmin,
    body('orderIds').isArray({ min: 1 }).withMessage('Select at least one order'),
    body('orderIds.*').isMongoId(),
    body('driverId').optional({ nullable: true }).isMongoId(),
    body('scheduledFor').optional({ nullable: true }).isISO8601(),
    validate,
    c.createDelivery
  );

router
  .route('/:id')
  .get(tenantAdminOrSuperAdmin, param('id').isMongoId(), validate, c.getDelivery)
  .patch(
    tenantAdminOrSuperAdmin,
    param('id').isMongoId(),
    body('driverId').optional({ nullable: true }).isMongoId(),
    body('scheduledFor').optional({ nullable: true }).isISO8601(),
    body('stopOrder').optional().isArray(),
    validate,
    c.updateDelivery
  );

router.post(
  '/:id/dispatch',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  validate,
  c.dispatchDelivery
);

router.patch(
  '/:id/stops/:stopId',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  param('stopId').isMongoId(),
  body('status').isIn(['delivered', 'failed']),
  body('failureReason').optional().trim(),
  body('codCollected').optional({ nullable: true }).isFloat({ min: 0 }),
  validate,
  c.resolveStop
);

router.post(
  '/:id/complete',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  validate,
  c.completeDelivery
);

router.post(
  '/:id/settle-cod',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  body('notes').optional().trim(),
  validate,
  c.settleCod
);

router.post(
  '/:id/cancel',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  body('reason').optional().trim(),
  validate,
  c.cancelDelivery
);

module.exports = router;
