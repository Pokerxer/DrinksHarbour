// controllers/cart.controller.js (EXTENDED)

const Cart = require('../models/Cart');
const User = require('../models/User');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Tenant = require('../models/Tenant');
const asyncHandler = require('../utils/asyncHandler');
const cartService = require('../services/cart.service');
const {
  calcPlatformCostPrice,
  calcPlatformSellingPrice,
  isDiscountActive,
  DEFAULT_PLATFORM_MARKUP,
} = require('../utils/pricing');

/**
 * Compute the live websitePrice for one SubProduct + optional Size,
 * using the same pipeline as store.routes.js:
 *   platformCostPrice → platformSellingPrice → apply sale discount
 */
function computeLivePrice(subProduct, sizeDoc, tenant, product) {
  const revenueModel    = tenant?.revenueModel         ?? 'markup';
  const markupPct       = tenant?.markupPercentage     ?? 25;
  const commissionPct   = tenant?.commissionPercentage ?? 12;
  const platformMarkupPct = product?.platformMarkup    ?? DEFAULT_PLATFORM_MARKUP;

  const productDiscount = product?.platformDiscount?.value > 0 && product?.platformDiscount?.type
    ? { value: product.platformDiscount.value, type: product.platformDiscount.type,
        start: product.platformDiscount.start,  end: product.platformDiscount.end }
    : null;

  const costPrice    = sizeDoc?.costPrice    ?? subProduct.costPrice        ?? 0;
  const sellingPrice = sizeDoc?.sellingPrice ?? subProduct.baseSellingPrice ?? 0;

  if (costPrice <= 0 && sellingPrice <= 0) return 0;

  const platformCostPrice    = calcPlatformCostPrice(costPrice, sellingPrice, revenueModel, markupPct, commissionPct);
  let   platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount);

  // Apply SubProduct-level sale discount
  const now        = new Date();
  const saleStart  = subProduct.saleStartDate ? new Date(subProduct.saleStartDate) : null;
  const saleEnd    = subProduct.saleEndDate   ? new Date(subProduct.saleEndDate)   : null;
  const saleActive = subProduct.isOnSale &&
    (!saleStart || now >= saleStart) &&
    (!saleEnd   || now <= saleEnd);

  if (saleActive && subProduct.saleDiscountValue > 0) {
    const dtype = subProduct.saleType || 'percentage';
    if (dtype === 'percentage' || dtype === 'flash_sale') {
      platformSellingPrice = parseFloat((platformSellingPrice * (1 - subProduct.saleDiscountValue / 100)).toFixed(2));
    } else if (dtype === 'fixed') {
      platformSellingPrice = Math.max(0, parseFloat((platformSellingPrice - subProduct.saleDiscountValue).toFixed(2)));
    }
  }

  return platformSellingPrice;
}

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

/**
 * @desc    Validate cart items: check live stock + recompute current prices
 * @route   POST /api/cart/validate
 * @access  Public (works for both guests and logged-in users)
 *
 * Request body:
 *   { items: [{ subProductId, sizeId?, tenantId?, quantity, price }] }
 *
 * Response per item:
 *   status: 'ok' | 'price_changed' | 'out_of_stock' | 'quantity_reduced' | 'unavailable'
 */
const validateCart = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items array is required' });
  }

  // Batch-fetch all SubProducts + their Products in one go
  const subProductIds = [...new Set(items.map(i => i.subProductId).filter(Boolean))];
  const sizeIds       = [...new Set(items.map(i => i.sizeId).filter(Boolean))];
  const tenantIds     = [...new Set(items.map(i => i.tenantId).filter(Boolean))];

  const [subProducts, sizes, tenants] = await Promise.all([
    SubProduct.find({ _id: { $in: subProductIds } })
      .select('product costPrice baseSellingPrice status availableStock isOnSale saleType saleDiscountValue saleStartDate saleEndDate')
      .populate({ path: 'product', select: 'name slug status platformMarkup platformDiscount' })
      .lean(),
    sizeIds.length > 0
      ? Size.find({ _id: { $in: sizeIds } })
          .select('costPrice sellingPrice stock subproduct')
          .lean()
      : [],
    tenantIds.length > 0
      ? Tenant.find({ _id: { $in: tenantIds } })
          .select('revenueModel markupPercentage commissionPercentage')
          .lean()
      : [],
  ]);

  const spMap     = Object.fromEntries(subProducts.map(sp => [sp._id.toString(), sp]));
  const sizeMap   = Object.fromEntries(sizes.map(s => [s._id.toString(), s]));
  const tenantMap = Object.fromEntries(tenants.map(t => [t._id.toString(), t]));

  const results  = [];
  let hasChanges = false;

  for (const item of items) {
    const { subProductId, sizeId, tenantId, quantity = 1, price: clientPrice = 0 } = item;

    // ── 1. SubProduct must exist and its product must be approved ─────────────
    const sp = subProductId ? spMap[subProductId] : null;
    if (!sp || !sp.product || sp.product.status !== 'approved') {
      results.push({ subProductId, sizeId, status: 'unavailable', available: false,
        currentPrice: 0, oldPrice: clientPrice });
      hasChanges = true;
      continue;
    }

    // ── 2. Stock status ───────────────────────────────────────────────────────
    const inStock = ['active', 'low_stock'].includes(sp.status);
    if (!inStock) {
      results.push({ subProductId, sizeId, status: 'out_of_stock', available: false,
        currentPrice: 0, oldPrice: clientPrice, stockStatus: sp.status });
      hasChanges = true;
      continue;
    }

    // ── 3. Quantity cap ───────────────────────────────────────────────────────
    const sizeDoc   = sizeId ? sizeMap[sizeId] : null;
    const stockQty  = sizeDoc?.stock ?? sp.availableStock ?? null; // null = unlimited
    const maxQty    = stockQty != null ? stockQty : Infinity;

    // ── 4. Live price ─────────────────────────────────────────────────────────
    const tenant       = tenantId ? tenantMap[tenantId] : null;
    const currentPrice = computeLivePrice(sp, sizeDoc, tenant, sp.product);

    // ── 5. Decide status ──────────────────────────────────────────────────────
    // Allow 1% tolerance for floating-point drift (rounds to nearest naira)
    const priceDiff    = Math.abs(currentPrice - clientPrice);
    const priceChanged = currentPrice > 0 && priceDiff > Math.max(1, clientPrice * 0.01);

    let status = 'ok';
    if (maxQty === 0) {
      status = 'out_of_stock';
      hasChanges = true;
    } else if (maxQty !== Infinity && quantity > maxQty) {
      status = 'quantity_reduced';
      hasChanges = true;
    } else if (priceChanged) {
      status = 'price_changed';
      hasChanges = true;
    }

    results.push({
      subProductId,
      sizeId: sizeId || null,
      status,
      available : status !== 'out_of_stock',
      currentPrice,
      oldPrice   : clientPrice,
      priceDiff  : priceChanged ? Math.round(currentPrice - clientPrice) : 0,
      stockStatus: sp.status,
      maxQuantity: stockQty,
    });
  }

  res.json({ success: true, data: { items: results, hasChanges } });
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
  validateCart,
};