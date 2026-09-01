'use strict';

const express = require('express');
const router  = express.Router();
const {
  getMyCart, saveCart, validateCart, mergeMyCart, clearMyCart,
} = require('../controllers/cart.controller');
const { listCartsForAdmin } = require('../controllers/adminCart.controller');
const {
  protect, attachTenant, tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

// Public — anonymous/guest carts validate too, no auth required.
router.post('/validate', validateCart);

// Staff read of the cart pipeline (admin Orders page → "Live Carts").
// Registered before '/' so the literal path can never be shadowed, and behind
// attachTenant because tenantAdminOrSuperAdmin requires req.tenant for the
// tenant roles. Scoping to the caller's own tenant happens in the controller.
router.get(
  '/admin/list',
  protect, attachTenant, tenantAdminOrSuperAdmin,
  listCartsForAdmin
);

router.get('/', protect, getMyCart);
router.post('/save', protect, saveCart);
router.post('/merge', protect, mergeMyCart);
router.delete('/', protect, clearMyCart);

module.exports = router;
