// routes/subproduct.routes.js

const express = require('express');
const router = express.Router();
const subProductController = require('../controllers/subproduct.controller');
const subProductImportController = require('../controllers/subProductImport.controller');
const {
  authenticate,
  attachTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');
const { 
  validateSubProductCreation,
  validateSubProductUpdate,
  validateStockBulkUpdate,
  validate 
} = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');
const SubProduct = require('../models/SubProduct');
const { checkSkuLimit } = require('../middleware/plan.middleware');
const { logPrivilegedAction } = require('../utils/auditLog');
// All SubProduct routes require authentication
router.use(authenticate);
router.use(attachTenant);

// ── Bulk import (CSV/Excel parsed client-side into rows) ─────────────────────
router.post('/import/preview', tenantAdminOrSuperAdmin, subProductImportController.previewImport);
router.post('/import/commit', tenantAdminOrSuperAdmin, subProductImportController.commitImport);

// ============================================================
// Tenant SubProduct Management
// ============================================================

/**
 * @route   GET /api/subproducts
 * @desc    Get tenant's SubProducts
 * @access  Private (Tenant admin or Super admin)
 */
router.get('/', tenantAdminOrSuperAdmin, subProductController.getMySubProducts);

/**
 * @route   POST /api/subproducts
 * @desc    Create new SubProduct (link product to tenant)
 * @access  Private (Tenant admin or Super admin)
 */
router.post(
  '/',
  tenantAdminOrSuperAdmin,
  checkSkuLimit,
  validateSubProductCreation,
  subProductController.createSubProduct
);

/**
 * @route   GET /api/subproducts/:id
 * @desc    Get single SubProduct details
 * @access  Private (Tenant admin or Super admin)
 */
router.get('/:id', tenantAdminOrSuperAdmin, subProductController.getSubProduct);

/**
 * @route   GET /api/subproducts/:id/stock-by-warehouse
 * @desc    Get a subproduct's stock broken down by warehouse
 * @access  Private (Tenant admin or Super admin)
 */
router.get('/:id/stock-by-warehouse', tenantAdminOrSuperAdmin, subProductController.getStockByWarehouse);

/**
 * @route   PATCH /api/subproducts/:id
 * @desc    Update SubProduct
 * @access  Private (Tenant admin or Super admin)
 */
router.patch(
  '/:id',
  tenantAdminOrSuperAdmin,
  validateSubProductUpdate,
  subProductController.updateSubProduct
);

/**
 * @route   PATCH /api/subproducts/:id/admin-status
 * @desc    Platform admin approve/decline any sub-product (bypasses tenant ownership)
 * @access  Private (tenantAdminOrSuperAdmin)
 */
router.patch(
  '/:id/admin-status',
  tenantAdminOrSuperAdmin,
  subProductController.adminSetStatus
);

/**
 * @route   DELETE /api/subproducts/:id
 * @desc    Delete SubProduct
 * @access  Private (Tenant admin or Super admin)
 */
router.delete('/:id', tenantAdminOrSuperAdmin, subProductController.deleteSubProduct);

/**
 * @route   POST /api/subproducts/:id/duplicate
 * @desc    Duplicate a SubProduct (and its sizes)
 * @access  Private (Tenant admin or Super admin)
 */
router.post('/:id/duplicate', tenantAdminOrSuperAdmin, subProductController.duplicate);

/**
 * @route   PATCH /api/subproducts/:id/archive
 * @desc    Archive a SubProduct (soft delete)
 * @access  Private (Tenant admin or Super admin)
 */
router.patch('/:id/archive', tenantAdminOrSuperAdmin, subProductController.archive);

/**
 * @route   PATCH /api/subproducts/:id/restore
 * @desc    Restore an archived SubProduct
 * @access  Private (Tenant admin or Super admin)
 */
router.patch('/:id/restore', tenantAdminOrSuperAdmin, subProductController.restore);

/**
 * @route   PATCH /api/subproducts/stock/bulk
 * @desc    Bulk update stock levels
 * @access  Private (Tenant admin or Super admin)
 */
router.patch(
  '/stock/bulk',
  tenantAdminOrSuperAdmin,
  validateStockBulkUpdate,
  subProductController.updateStockBulk
);

// ─────────────────────────────────────────────────────────────────────────────
// ~1050 lines of inline service and controller functions sat here until
// 2026-08-07, left over from the same three-draft concatenation that produced
// the 18 shadowed route declarations deleted the same day.
//
// They were unreachable twice over. Nothing outside could import them: the file
// carried THREE `module.exports` assignments and the last one — `module.exports
// = router` at the bottom — overwrote the two that exported these functions.
// And nothing inside referenced them either: every route handler in this file
// resolves through the real `../controllers/subproduct.controller` module
// required at the top, never the identically-named local consts.
//
// Deleting them changed no route and no guard — the router's full layer table,
// paths and handler chains included, is byte-identical before and after.
// ─────────────────────────────────────────────────────────────────────────────

// ============================================================
// Validation Schemas
// ============================================================

const bulkCreateValidation = [
  body('productIds')
    .isArray({ min: 1 })
    .withMessage('Product IDs must be a non-empty array'),
  body('productIds.*')
    .isMongoId()
    .withMessage('Each product ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
];

const transferValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  body('newTenantId')
    .isMongoId()
    .withMessage('New tenant ID must be a valid MongoDB ID'),
];

const updatePricingValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
  body('sizeId')
    .isMongoId()
    .withMessage('Size ID must be a valid MongoDB ID'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('costPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),
  body('compareAtPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Compare at price must be a positive number'),
  body('discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),
];

const effectivePriceValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  param('sizeId')
    .isMongoId()
    .withMessage('Size ID must be a valid MongoDB ID'),
];

const bulkDiscountValidation = [
  body('subProductIds')
    .isArray({ min: 1 })
    .withMessage('SubProduct IDs must be a non-empty array'),
  body('subProductIds.*')
    .isMongoId()
    .withMessage('Each SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
  body('discount.type')
    .isIn(['percentage', 'fixed'])
    .withMessage('Discount type must be percentage or fixed'),
  body('discount.value')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('discount.startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('discount.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

const removeDiscountValidation = [
  body('subProductIds')
    .isArray({ min: 1 })
    .withMessage('SubProduct IDs must be a non-empty array'),
  body('subProductIds.*')
    .isMongoId()
    .withMessage('Each SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
];

// ============================================================
// Routes
// ============================================================
//
// Every route below used to carry `protect, authorize('tenant_admin',
// 'super_admin')` while the tenant-scoped block at the top of the file used
// `tenantAdminOrSuperAdmin`. That split was a seam left by the three-draft
// concatenation, not a boundary anyone designed: it left tenant_owner — the
// role that owns the tenant — able to create, update, archive and delete a
// sub-product but not to add a size to one, adjust its stock, or read its own
// sales figures, and it excluded `admin` from handlers that branch on
// `['super_admin','admin'].includes(req.user.role)` (see bulk-promote below).
//
// Unified onto tenantAdminOrSuperAdmin on 2026-08-07. `protect` went with it:
// `protect === authenticate` and `router.use(authenticate)` already ran at the
// top of the file, so each of these was a second JWT verify and a second
// User.findById per request.
//
// Tenant scoping does not come from these guards — it comes from the JWT via
// attachTenant/getTenantId, and the two cross-tenant operations defend
// themselves independently (bulkCreateSubProducts and transferSubProduct both
// require the caller to be the target tenant's own admin, and cross-tenant
// transfer stays gated on `role === 'super_admin'` inside the service).
//
// subproductGuardConsistency.test.js fails if the seam reopens.

// Bulk operations
router.post(
  '/bulk',
  tenantAdminOrSuperAdmin,
  bulkCreateValidation,
  validate,
  subProductController.bulkCreate
);

// Transfer
router.post(
  '/:id/transfer',
  tenantAdminOrSuperAdmin,
  transferValidation,
  validate,
  subProductController.transfer
);

// Pricing
router.patch(
  '/:id/pricing',
  tenantAdminOrSuperAdmin,
  updatePricingValidation,
  validate,
  subProductController.updatePricing
);

// Effective price
//
// Labelled "public" until 2026-08-07, but it never was: router.use(authenticate)
// refuses an anonymous caller, so "public" only ever meant "any authenticated
// role, customer included". The storefront does not call it — nothing does — so
// it takes the same guard as the rest of the file. Same story for the four other
// reads that carried no role guard: /tenant/:tenantId, /product/:productId,
// /sku/:sku and /:id/stock-status.
router.get(
  '/:id/sizes/:sizeId/effective-price',
  tenantAdminOrSuperAdmin,
  effectivePriceValidation,
  validate,
  subProductController.getEffectivePrice
);

// Bulk discount
router.post(
  '/discount/apply',
  tenantAdminOrSuperAdmin,
  bulkDiscountValidation,
  validate,
  subProductController.applyDiscount
);

router.post(
  '/discount/remove',
  tenantAdminOrSuperAdmin,
  removeDiscountValidation,
  validate,
  subProductController.removeDiscount
);

// ── Pricelist bulk-promote / bulk-unpromote ───────────────────────────────────
// Applies saleDiscountValue/saleType/isOnSale directly on SubProduct documents
// (the fields read by computePOSPricing and computeStorePricing)
router.patch(
  '/bulk-promote',
  tenantAdminOrSuperAdmin,
  async (req, res, next) => {
    try {
      const { ids, saleType, saleDiscountValue, saleStartDate, saleEndDate, applyToAll } = req.body;
      const isAdmin = ['super_admin', 'admin'].includes(req.user.role);

      if (!saleType || !saleDiscountValue || saleDiscountValue <= 0) {
        return res.status(400).json({ success: false, message: 'saleType and saleDiscountValue are required' });
      }

      // Build tenant filter — super_admin with explicit applyToAll can go platform-wide
      let filter;
      if (isAdmin && applyToAll) {
        filter = {};
        // Audit: platform-wide bulk promotion affects ALL tenants — must be audited
        logPrivilegedAction(req, 'BULK_PROMOTE_ALL_TENANTS', 'bulk', {
          justification: `saleType=${saleType} discount=${saleDiscountValue} ids=${ids?.length || 'all'}`,
        });
      } else {
        const tenantId = req.tenant?._id || req.user?.tenant;
        if (!tenantId) {
          return res.status(403).json({ success: false, message: 'Tenant context required — specify a target tenant via x-tenant-slug or ?tenant= query' });
        }
        filter = { tenant: tenantId };
      }
      if (!applyToAll) {
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ success: false, message: 'ids required when applyToAll is false' });
        }
        filter._id = { $in: ids };
      }

      const update = {
        $set: {
          saleType,
          saleDiscountValue: Number(saleDiscountValue),
          isOnSale: true,
          ...(saleStartDate && { saleStartDate: new Date(saleStartDate) }),
          ...(saleEndDate   && { saleEndDate:   new Date(saleEndDate) }),
        },
      };

      const result = await SubProduct.updateMany(filter, update);
      res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
    } catch (err) { next(err); }
  }
);

router.patch(
  '/bulk-unpromote',
  tenantAdminOrSuperAdmin,
  async (req, res, next) => {
    try {
      const { ids, applyToAll } = req.body;
      const isAdmin = ['super_admin', 'admin'].includes(req.user.role);

      let filter;
      if (isAdmin && applyToAll) {
        filter = {};
      } else {
        const tenantId = req.tenant?._id || req.user?.tenant;
        if (!tenantId) {
          return res.status(403).json({ success: false, message: 'Tenant context required — specify a target tenant via x-tenant-slug or ?tenant= query' });
        }
        filter = { tenant: tenantId };
      }
      if (!applyToAll) {
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ success: false, message: 'ids required when applyToAll is false' });
        }
        filter._id = { $in: ids };
      }

      const result = await SubProduct.updateMany(filter, {
        $set:   { isOnSale: false, saleDiscountValue: 0 },
        $unset: { saleType: '', saleStartDate: '', saleEndDate: '' },
      });
      res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
    } catch (err) { next(err); }
  }
);

// Price history
router.get(
  '/:id/price-history',
  tenantAdminOrSuperAdmin,
  param('id').isMongoId(),
  validate,
  subProductController.getPriceHistory
);

// ============================================================
// Existing Routes (from your file)
// ============================================================
//
// This file was assembled by concatenating three drafts, so later sections
// re-declared paths the tenant-scoped block at the top of the file had already
// claimed. Express matches layers in declaration order and a handler that sends
// a response never falls through, so every one of those later declarations was
// unreachable — including a second `POST /` guarded by
// authorize('tenant_admin','super_admin'), a *wider* role set than the
// tenantAdminOrSuperAdmin guard that actually runs. Reading that dead guard is
// what made the client permission map look under-enforced.
//
// The 18 shadowed declarations were deleted on 2026-08-07.
// routeDeclarationUniqueness.test.js now fails if one comes back.

/**
 * @route   GET /api/subproducts/tenant/:tenantId
 * @desc    Get SubProducts by tenant
 * @access  Private (Tenant admin or platform admin)
 */
router.get(
  '/tenant/:tenantId',
  tenantAdminOrSuperAdmin,
  subProductController.getSubProductsByTenant
);

/**
 * @route   GET /api/subproducts/product/:productId
 * @desc    Get SubProducts by product
 * @access  Private (Tenant admin or platform admin) — backs the admin
 *          listing-review panel; super_admin additionally sees pending ones
 */
router.get(
  '/product/:productId',
  tenantAdminOrSuperAdmin,
  subProductController.getSubProductsByProduct
);

/**
 * @route   GET /api/subproducts/sku/:sku
 * @desc    Get SubProduct by SKU
 * @access  Private (Tenant admin or platform admin)
 */
router.get(
  '/sku/:sku',
  tenantAdminOrSuperAdmin,
  subProductController.getSubProductBySKU
);

/**
 * @route   POST /api/subproducts/:id/sizes
 * @desc    Add size to SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/sizes',
  tenantAdminOrSuperAdmin,
  subProductController.addSize
);

/**
 * @route   PATCH /api/subproducts/:id/sizes/:sizeId
 * @desc    Update size
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id/sizes/:sizeId',
  tenantAdminOrSuperAdmin,
  subProductController.updateSize
);

/**
 * @route   DELETE /api/subproducts/:id/sizes/:sizeId
 * @desc    Delete size
 * @access  Private (Tenant Admin, Super Admin)
 */
router.delete(
  '/:id/sizes/:sizeId',
  tenantAdminOrSuperAdmin,
  subProductController.deleteSize
);

/**
 * @route   PATCH /api/subproducts/:id/stock
 * @desc    Update stock for SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id/stock',
  tenantAdminOrSuperAdmin,
  subProductController.updateStock
);

/**
 * @route   GET /api/subproducts/:id/stock-status
 * @desc    Get stock status for SubProduct
 * @access  Private (Tenant admin or platform admin)
 */
router.get(
  '/:id/stock-status',
  tenantAdminOrSuperAdmin,
  subProductController.getStockStatus
);

// ============================================================
// Inventory Management Routes
// ============================================================

/**
 * @route   GET /api/subproducts/:id/inventory
 * @desc    Get comprehensive inventory for SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/inventory',
  tenantAdminOrSuperAdmin,
  subProductController.getInventory
);

/**
 * @route   POST /api/subproducts/:id/sizes/:sizeId/adjust-stock
 * @desc    Adjust stock for a specific size
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/sizes/:sizeId/adjust-stock',
  tenantAdminOrSuperAdmin,
  subProductController.adjustStock
);

/**
 * @route   GET /api/subproducts/:id/stock-movements
 * @desc    Get stock movement history
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/stock-movements',
  tenantAdminOrSuperAdmin,
  subProductController.getStockMovements
);

/**
 * @route   GET /api/subproducts/tenant/:tenantId/low-stock
 * @desc    Get SubProducts with low stock
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/tenant/:tenantId/low-stock',
  tenantAdminOrSuperAdmin,
  subProductController.getLowStock
);

/**
 * @route   GET /api/subproducts/tenant/:tenantId/out-of-stock
 * @desc    Get SubProducts that are out of stock
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/tenant/:tenantId/out-of-stock',
  tenantAdminOrSuperAdmin,
  subProductController.getOutOfStock
);

/**
 * @route   POST /api/subproducts/:id/reorder-points
 * @desc    Set reorder points for SubProduct sizes
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/reorder-points',
  tenantAdminOrSuperAdmin,
  subProductController.setReorderPoints
);

// ============================================================
// Sales & Analytics Routes
// ============================================================

/**
 * @route   GET /api/subproducts/:id/sales
 * @desc    Get sales data for SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/sales',
  tenantAdminOrSuperAdmin,
  subProductController.getSales
);

/**
 * @route   GET /api/subproducts/:id/revenue
 * @desc    Get revenue data with profit breakdown
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/revenue',
  tenantAdminOrSuperAdmin,
  subProductController.getRevenue
);

/**
 * @route   GET /api/subproducts/tenant/:tenantId/top-selling
 * @desc    Get top selling SubProducts for tenant
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/tenant/:tenantId/top-selling',
  tenantAdminOrSuperAdmin,
  subProductController.getTopSelling
);

/**
 * @route   GET /api/subproducts/:id/conversion-rate
 * @desc    Get conversion rate metrics
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/conversion-rate',
  tenantAdminOrSuperAdmin,
  subProductController.getConversionRate
);

/**
 * @route   GET /api/subproducts/:id/average-order-value
 * @desc    Get average order value metrics
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/average-order-value',
  tenantAdminOrSuperAdmin,
  subProductController.getAverageOrderValue
);

module.exports = router;