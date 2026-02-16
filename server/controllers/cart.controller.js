// controllers/cart.controller.js (EXTENDED)

const Cart = require('../models/Cart');
const User = require('../models/user');
const asyncHandler = require('../utils/asyncHandler');
const cartService = require('../services/cart.service');

/**
 * @desc    Add item to cart
 * @route   POST /api/cart/add
 * @access  Private
 */
const addToCart = asyncHandler(async (req, res) => {
  const { productId, subProductId, sizeId, quantity, tenantId } = req.body;
  console.log(req.body);
  const userId = req.user._id;

  const result = await cartService.addToCart({
    userId,
    productId,
    subProductId,
    sizeId,
    tenantId,
    quantity,
  });

  res.status(200).json({
    success: true,
    message: 'Product added to cart successfully',
    data: {
      cart: result.cart,
      item: result.addedItem,
    },
  });
});

/**
 * @desc    Get user's cart
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const cart = await cartService.getCart(req.user._id);

  res.status(200).json({
    success: true,
    data: { cart },
  });
});

/**
 * @desc    Update cart item quantity
 * @route   PATCH /api/cart/items/:itemId
 * @access  Private
 */
const updateCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  const cart = await cartService.updateCartItemQuantity(
    req.user._id,
    itemId,
    quantity
  );

  res.status(200).json({
    success: true,
    message: 'Cart item updated successfully',
    data: { cart },
  });
});

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/items/:itemId
 * @access  Private
 */
const removeCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const cart = await cartService.removeFromCart(req.user._id, itemId);

  res.status(200).json({
    success: true,
    message: 'Item removed from cart successfully',
    data: { cart },
  });
});

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart
 * @access  Private
 */
const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Cart cleared successfully',
    data: { cart },
  });
});

/**
 * @desc    Sync local cart items to server cart
 * @route   POST /api/cart/sync
 * @access  Private
 */
const syncCart = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      message: 'Items must be an array',
    });
  }

  const userId = req.user._id;

  const { cart, results } = await cartService.syncCart(userId, items);

  res.status(200).json({
    success: true,
    message: 'Cart synced successfully',
    data: {
      cart,
      results,
    },
  });
});

/**
 * @desc    Replace server cart with local cart items
 * @route   PUT /api/cart/replace
 * @access  Private
 */
const replaceCart = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      message: 'Items must be an array',
    });
  }

  const userId = req.user._id;

  const { cart, results } = await cartService.replaceCart(userId, items);

  res.status(200).json({
    success: true,
    message: 'Cart replaced successfully',
    data: {
      cart,
      results,
    },
  });
});

/**
 * @desc    Save local cart to server (simplified, no validation)
 * @route   POST /api/cart/save
 * @access  Public (optional auth)
 */
const saveCart = asyncHandler(async (req, res) => {
  console.log('🔵 POST /api/cart/save called');
  console.log('   User:', req.user ? req.user.email || req.user._id : 'GUEST');
  console.log('   Items count:', req.body.items?.length || 0);

  const { items, guestId } = req.body;

  if (!items || !Array.isArray(items)) {
    console.log('   ❌ Items is not an array');
    return res.status(400).json({
      success: false,
      message: 'Items must be an array',
    });
  }

  let userId = req.user?._id;

  // For guest users, use guestId from request or create temp user
  if (!userId) {
    if (guestId) {
      userId = guestId;
      console.log('   Using guestId:', userId);
    } else {
      console.log('   ❌ No user ID available');
      return res.status(400).json({
        success: false,
        message: 'User ID or guestId required',
      });
    }
  }

  console.log('   ✅ User ID:', userId);

  let cart = await Cart.findOne({ user: userId });
  console.log('   Existing cart:', cart ? 'Found' : 'Not found');

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [],
      subtotal: 0,
      estimatedTotal: 0,
    });
    console.log('   ✅ Created new cart');
  }

  cart.items = [];

  const results = {
    added: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      const { productId, subProductId, sizeId, tenantId, quantity, price } = item;

      if (!productId) {
        results.errors.push({ error: 'Missing productId' });
        continue;
      }

      console.log('   Adding item:', { productId, subProductId, sizeId, tenantId, quantity });

      cart.items.push({
        product: productId,
        subproduct: subProductId || productId,
        size: sizeId || productId,
        tenant: tenantId || productId,
        priceAtAddition: price || 0,
        quantity: quantity || 1,
        maxAvailableAtAddition: 999,
        discountApplied: 0,
        addedAt: new Date(),
      });

      results.added++;
    } catch (error) {
      results.errors.push({ error: error.message });
    }
  }

  console.log('   Items to save:', results.added);
  console.log('   Unique tenants:', [...new Set(cart.items.map(i => i.tenant?.toString()))]);

  let subtotal = 0;
  for (const item of cart.items) {
    subtotal += (item.priceAtAddition || 0) * (item.quantity || 1);
  }
  cart.subtotal = Math.round(subtotal * 100) / 100;
  cart.estimatedTotal = cart.subtotal;

  await cart.save();
  console.log('   ✅ Cart saved, ID:', cart._id, 'Items:', cart.items.length);
  console.log('   Saved tenants:', [...new Set(cart.items.map(i => i.tenant?.toString()))]);
  console.log('   Saved sizes:', [...new Set(cart.items.map(i => i.size?.toString()))]);
  console.log('   Saved subproducts:', [...new Set(cart.items.map(i => i.subproduct?.toString()))]);

  // Update user cart count only if real user
  if (req.user?._id) {
    await User.findByIdAndUpdate(req.user._id, {
      activeCartItemCount: cart.items.length,
      lastCartUpdate: new Date(),
    });
  }

  const populatedCart = await Cart.findById(cart._id)
    .populate('items.product', 'name slug images')
    .populate('items.subproduct', 'sku')
    .populate('items.size', 'size displayName')
    .populate('items.tenant', 'name')
    .lean();

  res.status(200).json({
    success: true,
    message: 'Cart saved successfully',
    data: {
      cart: populatedCart,
      results,
    },
  });
});

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
  replaceCart,
  saveCart,
};