'use strict';

const express = require('express');
const router  = express.Router();
const {
  getMyCart, saveCart, validateCart, mergeMyCart, clearMyCart,
} = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth.middleware');

// Public — anonymous/guest carts validate too, no auth required.
router.post('/validate', validateCart);

router.get('/', protect, getMyCart);
router.post('/save', protect, saveCart);
router.post('/merge', protect, mergeMyCart);
router.delete('/', protect, clearMyCart);

module.exports = router;
