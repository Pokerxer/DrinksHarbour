// controllers/wishlist.controller.js (EXTENDED)

const asyncHandler = require('../utils/asyncHandler');
const wishlistService = require('../services/wishlist.service');

/**
 * @desc    Add product to wishlist
 * @route   POST /api/wishlist/add
 * @access  Private
 */
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId, subProductId, note, priority } = req.body;
  const userId = req.user._id;

  const result = await wishlistService.addToWishlist({
    userId,
    productId,
    subProductId,
    note,
    priority,
  });

  res.status(200).json({
    success: true,
    message: result.isNew
      ? 'Product added to wishlist successfully'
      : 'Product already in wishlist - updated',
    data: {
      wishlist: result.wishlist,
      item: result.item,
    },
  });
});

/**
 * @desc    Get user's wishlist
 * @route   GET /api/wishlist
 * @access  Private
 */
const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.getWishlist(req.user._id);

  res.status(200).json({
    success: true,
    data: { wishlist },
  });
});

/**
 * @desc    Update wishlist item
 * @route   PATCH /api/wishlist/items/:productId
 * @access  Private
 */
const updateWishlistItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { note, priority, notifyWhenAvailable } = req.body;

  const wishlist = await wishlistService.updateWishlistItem(req.user._id, productId, {
    note,
    priority,
    notifyWhenAvailable,
  });

  res.status(200).json({
    success: true,
    message: 'Wishlist item updated successfully',
    data: { wishlist },
  });
});

/**
 * @desc    Remove product from wishlist
 * @route   DELETE /api/wishlist/items/:productId
 * @access  Private
 */
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const wishlist = await wishlistService.removeFromWishlist(req.user._id, productId);

  res.status(200).json({
    success: true,
    message: 'Product removed from wishlist successfully',
    data: { wishlist },
  });
});

/**
 * @desc    Clear wishlist
 * @route   DELETE /api/wishlist
 * @access  Private
 */
const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.clearWishlist(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Wishlist cleared successfully',
    data: { wishlist },
  });
});

module.exports = {
  addToWishlist,
  getWishlist,
  updateWishlistItem,
  removeFromWishlist,
  clearWishlist,
};