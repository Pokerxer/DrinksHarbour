// routes/wishlist.routes.js

const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/add', wishlistController.addToWishlist);
router.patch('/items/:productId', wishlistController.updateWishlistItem);
router.delete('/items/:productId', wishlistController.removeFromWishlist);
router.delete('/', wishlistController.clearWishlist);

module.exports = router;