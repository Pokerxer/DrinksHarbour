'use strict';

const express = require('express');
const router  = express.Router();
const { getMyCart, saveCart, validateCart } = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth.middleware');

// Public — anonymous/guest carts validate too, no auth required.
router.post('/validate', validateCart);

router.get('/', protect, getMyCart);
router.post('/save', protect, saveCart);

module.exports = router;
