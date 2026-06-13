// routes/vendor.routes.js
const express = require('express');
const router = express.Router();
const {
  createVendor,
  searchVendors,
  getVendor,
  getAllVendors,
  updateVendor,
  deleteVendor,
  uploadVendorPhoto,
} = require('../controllers/vendor.controller');
const { protect, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../middleware/imageUpload.middleware');

// All routes require authentication and tenant context
router.use(protect);
router.use(attachTenant);

// Search vendors
router.get('/search', tenantAdminOrSuperAdmin, searchVendors);

// Get all vendors
router.get('/', tenantAdminOrSuperAdmin, getAllVendors);

// CRUD routes
router.route('/:id')
  .get(tenantAdminOrSuperAdmin, getVendor)
  .put(tenantAdminOrSuperAdmin, updateVendor)
  .delete(tenantAdminOrSuperAdmin, deleteVendor);

// Create vendor (must be separate from :id to avoid conflict)
router.post('/', tenantAdminOrSuperAdmin, createVendor);

// Upload vendor photo
router.post('/:id/photo', tenantAdminOrSuperAdmin, uploadAvatar, uploadVendorPhoto);

module.exports = router;
