// routes/cart.routes.js

const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateCartItem } = require('../middleware/validation.middleware');

// Save cart requires authentication
router.post('/save', protect, cartController.saveCart);

// Other routes use optional authentication
router.get('/', cartController.getCart);
router.post('/add', validateCartItem, cartController.addToCart);
router.post('/sync', cartController.syncCart);
router.put('/replace', cartController.replaceCart);
router.patch('/items/:itemId', cartController.updateCartItem);
router.delete('/items/:itemId', cartController.removeCartItem);
router.delete('/', cartController.clearCart);

module.exports = router;