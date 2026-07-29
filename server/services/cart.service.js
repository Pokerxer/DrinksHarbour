// services/cart.service.js

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Tenant = require('../models/Tenant');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const { calculateSizePricing } = require('../utils/pricing');
const { buildCartItemId, buildCartLine, mergeCartLines } = require('../helpers/cart.helpers');

/**
 * Add item to cart
 */
const addToCart = async (data) => {
  const { userId, productId, subProductId, sizeId, tenantId, quantity = 1 } = data;

  // Validate quantity
  if (quantity < 1 || quantity > 100) {
    throw new ValidationError('Quantity must be between 1 and 100');
  }

  // Verify product exists and is approved
  const product = await Product.findOne({ _id: productId, status: 'approved' }).lean();
  if (!product) {
    throw new NotFoundError('Product not found or not available');
  }

  // Verify SubProduct exists and is active
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    product: productId,
    status: 'active',
  })
    .populate({
      path: 'tenant',
      match: {
        status: 'approved',
        subscriptionStatus: { $in: ['active', 'trialing'] },
      },
    })
    .lean();

  if (!subProduct || !subProduct.tenant) {
    throw new NotFoundError('Product variant not available from this seller');
  }

  // Verify tenantId matches if provided
  if (tenantId && subProduct.tenant._id.toString() !== tenantId.toString()) {
    throw new ValidationError('SubProduct does not belong to specified tenant');
  }

  // Verify Size exists and has stock
  const size = await Size.findOne({
    _id: sizeId,
    subproduct: subProductId,
  }).lean();

  if (!size) {
    throw new NotFoundError('Product size not found');
  }

  // Check availability
  if (size.availability === 'out_of_stock' || size.stock === 0) {
    throw new ConflictError('This product size is currently out of stock');
  }

  // Check if requested quantity is available
  if (size.stock < quantity) {
    throw new ValidationError(
      `Only ${size.stock} units available. Please reduce quantity.`
    );
  }

  // Check max order quantity
  if (size.maxOrderQuantity && quantity > size.maxOrderQuantity) {
    throw new ValidationError(
      `Maximum order quantity for this size is ${size.maxOrderQuantity}`
    );
  }

  // Check min order quantity
  if (size.minOrderQuantity && quantity < size.minOrderQuantity) {
    throw new ValidationError(
      `Minimum order quantity for this size is ${size.minOrderQuantity}`
    );
  }

  // Get or create cart
  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [],
      subtotal: 0,
      estimatedTotal: 0,
    });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(
    (item) =>
      item.product.toString() === productId.toString() &&
      item.subproduct.toString() === subProductId.toString() &&
      item.size.toString() === sizeId.toString()
  );

  let addedItem;

  if (existingItemIndex > -1) {
    // Update existing item quantity
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;

    // Verify new quantity doesn't exceed stock
    if (newQuantity > size.stock) {
      throw new ValidationError(
        `Cannot add ${quantity} more. Only ${size.stock - cart.items[existingItemIndex].quantity} additional units available.`
      );
    }

    // Verify max order quantity
    if (size.maxOrderQuantity && newQuantity > size.maxOrderQuantity) {
      throw new ValidationError(
        `Maximum order quantity is ${size.maxOrderQuantity}. You already have ${cart.items[existingItemIndex].quantity} in cart.`
      );
    }

    cart.items[existingItemIndex].quantity = newQuantity;
    addedItem = cart.items[existingItemIndex];
  } else {
    // Store the PLATFORM price, not the raw tenant-facing size.sellingPrice.
    // getCart reprices on read anyway, but a correct value here keeps
    // Cart.subtotal and any consumer reading the raw document honest.
    const addPricing = calculateSizePricing(
      size, product, subProduct.tenant, subProduct.costPrice, subProduct.baseSellingPrice,
    );

    // Add new item
    const newItem = {
      product: productId,
      subproduct: subProductId,
      size: sizeId,
      tenant: subProduct.tenant._id,
      priceAtAddition: addPricing.finalPrice,
      quantity,
      maxAvailableAtAddition: size.stock,
      discountApplied: 0,
      addedAt: new Date(),
    };

    cart.items.push(newItem);
    addedItem = newItem;
  }

  // Recalculate cart totals
  await recalculateCartTotals(cart);

  // Update user's cart item count
  await updateUserCartCount(userId, cart.items.length);

  // Save cart
  await cart.save();

  // Populate and return
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.product',
      select: 'name slug images type isAlcoholic abv',
    })
    .populate({
      path: 'items.subproduct',
      select: 'sku baseSellingPrice',
      populate: {
        path: 'tenant',
        select: 'name slug logo',
      },
    })
    .populate({
      path: 'items.size',
      select: 'size displayName sellingPrice stock availability currency',
    })
    .lean();

  return {
    cart: populatedCart,
    addedItem: populatedCart.items.find(
      (item) =>
        item.product._id.toString() === productId.toString() &&
        item.size._id.toString() === sizeId.toString()
    ),
  };
};

/**
 * Sync entire cart from localStorage to server
 * Replaces server cart with items from local cart
 */
const syncCart = async (userId, items) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { cart: await getCart(userId), results: { added: 0, skipped: 0, errors: [] } };
  }

  const results = {
    added: 0,
    skipped: 0,
    errors: [],
  };

  // Clear existing cart first
  const existingCart = await Cart.findOne({ user: userId });
  if (existingCart && existingCart.items.length > 0) {
    existingCart.items = [];
    existingCart.subtotal = 0;
    existingCart.estimatedTotal = 0;
    existingCart.discountTotal = 0;
    await existingCart.save();
    await updateUserCartCount(userId, 0);
  }

  // Add each item from local cart
  for (const item of items) {
    try {
      const { productId, subProductId, sizeId, tenantId, quantity, price } = item;

      if (!productId || !subProductId || !sizeId || !tenantId) {
        results.errors.push({
          item: { productId, subProductId, sizeId, tenantId },
          error: 'Missing required fields (productId, subProductId, sizeId, tenantId)',
        });
        continue;
      }

      // Verify product exists
      const product = await Product.findOne({ _id: productId, status: 'approved' }).lean();
      if (!product) {
        results.errors.push({ item: { productId }, error: 'Product not found or not available' });
        continue;
      }

      // Verify subProduct exists and belongs to product
      const subProduct = await SubProduct.findOne({
        _id: subProductId,
        product: productId,
        status: 'active',
      })
        .populate({
          path: 'tenant',
          match: { status: 'approved' },
        })
        .lean();

      if (!subProduct) {
        results.errors.push({ item: { subProductId }, error: 'Product variant not available' });
        continue;
      }

      // Verify tenant matches
      if (tenantId && subProduct.tenant && subProduct.tenant._id.toString() !== tenantId.toString()) {
        results.errors.push({ item: { subProductId, tenantId }, error: 'Tenant mismatch' });
        continue;
      }

      // Verify size exists
      const size = await Size.findOne({
        _id: sizeId,
        subproduct: subProductId,
      }).lean();

      if (!size) {
        results.errors.push({ item: { sizeId }, error: 'Size not found' });
        continue;
      }

      // Check stock
      if (size.availability === 'out_of_stock' || size.stock === 0) {
        results.errors.push({ item: { sizeId }, error: 'Item out of stock' });
        continue;
      }

      // Check quantity limits
      const validQuantity = Math.min(Math.max(1, quantity || 1), size.maxOrderQuantity || 99);
      
      if (validQuantity > size.stock) {
        results.errors.push({
          item: { productId, sizeId },
          error: `Only ${size.stock} units available`,
        });
        continue;
      }

      // Add to cart using the main addToCart function
      await addToCart({
        userId,
        productId,
        subProductId,
        sizeId,
        tenantId: tenantId || subProduct.tenant?._id,
        quantity: validQuantity,
      });

      results.added++;
    } catch (error) {
      results.errors.push({ item: { productId: item.productId }, error: error.message });
    }
  }

  // Get updated cart
  const cart = await getCart(userId);

  return { cart, results };
};

/**
 * Replace entire cart with new items
 */
const replaceCart = async (userId, items) => {
  // Clear cart
  let cart = await Cart.findOne({ user: userId });
  
  if (cart) {
    cart.items = [];
    cart.subtotal = 0;
    cart.estimatedTotal = 0;
    cart.discountTotal = 0;
    cart.coupon = null;
    await cart.save();
  }

  await updateUserCartCount(userId, 0);

  // Add items
  const results = {
    added: 0,
    skipped: 0,
    errors: [],
  };

  for (const item of items || []) {
    try {
      const { productId, subProductId, sizeId, tenantId, quantity } = item;
      
      await addToCart({
        userId,
        productId,
        subProductId,
        sizeId,
        tenantId,
        quantity: quantity || 1,
      });
      
      results.added++;
    } catch (error) {
      results.errors.push({ item, error: error.message });
    }
  }

  cart = await getCart(userId);
  return { cart, results };
};

/**
 * Recalculate cart totals
 */
const recalculateCartTotals = async (cart) => {
  let subtotal = 0;

  for (const item of cart.items) {
    const itemTotal = item.priceAtAddition * item.quantity;
    subtotal += itemTotal;
  }

  cart.subtotal = Math.round(subtotal * 100) / 100;

  // Simple estimated total (before shipping, tax, etc.)
  cart.estimatedTotal = cart.subtotal - (cart.discountTotal || 0);

  return cart;
};

/**
 * Update user's cart item count
 */
const updateUserCartCount = async (userId, itemCount) => {
  try {
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      activeCartItemCount: itemCount,
      lastCartUpdate: new Date(),
    });
  } catch (error) {
    console.error('Error updating user cart count:', error);
    // Don't throw - this is a soft failure
  }
};

/**
 * Get user's cart
 */
const getCart = async (userId) => {
  // The selects below are wide because calculateSizePricing reads all of these.
  // Trimming them silently prices every line at 0.
  const cart = await Cart.findOne({ user: userId })
    .populate({
      path: 'items.product',
      select: 'name slug images type isAlcoholic abv status platformMarkup platformDiscount',
    })
    .populate({
      path: 'items.subproduct',
      select: 'sku costPrice baseSellingPrice status',
      populate: {
        path: 'tenant',
        select: 'name slug logo status subscriptionStatus revenueModel markupPercentage commissionPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits',
      },
    })
    .populate({
      path: 'items.size',
      select: 'size displayName sellingPrice costPrice stock availability currency unitsPerPack maxOrderQuantity minOrderQuantity discountValue discountType discountStart discountEnd platformMarkupOverridePct packPlatformMarkupOverridePct',
    })
    .lean();

  if (!cart) {
    return { items: [], subtotal: 0, discountTotal: 0, estimatedTotal: 0, isEmpty: true };
  }

  // Reprice every line through the platform pipeline. A cart loaded a week
  // later must show today's price, not the price snapshotted at add time.
  const items = (cart.items || [])
    .map((item) => {
      if (!item.product || !item.subproduct || !item.subproduct.tenant || !item.size) return null;
      const pricing = calculateSizePricing(
        item.size,
        item.product,
        item.subproduct.tenant,
        item.subproduct.costPrice,
        item.subproduct.baseSellingPrice,
      );
      return buildCartLine(item, pricing);
    })
    .filter(Boolean);

  const subtotal = items.reduce((sum, line) => {
    const unit = line.packUnitPrice && line.packThreshold && line.quantity >= line.packThreshold
      ? line.packUnitPrice
      : line.price;
    return sum + unit * line.quantity;
  }, 0);

  return {
    items,
    subtotal,
    discountTotal: cart.discountTotal || 0,
    estimatedTotal: subtotal - (cart.discountTotal || 0),
    isEmpty: items.length === 0,
  };
};

/**
 * Update cart item quantity
 */
const updateCartItemQuantity = async (userId, itemId, quantity) => {
  if (quantity < 1 || quantity > 100) {
    throw new ValidationError('Quantity must be between 1 and 100');
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === itemId.toString()
  );

  if (itemIndex === -1) {
    throw new NotFoundError('Item not found in cart');
  }

  // Verify stock availability
  const size = await Size.findById(cart.items[itemIndex].size).lean();
  if (!size) {
    throw new NotFoundError('Product size no longer available');
  }

  if (quantity > size.stock) {
    throw new ValidationError(
      `Only ${size.stock} units available. Please reduce quantity.`
    );
  }

  if (size.maxOrderQuantity && quantity > size.maxOrderQuantity) {
    throw new ValidationError(
      `Maximum order quantity for this size is ${size.maxOrderQuantity}`
    );
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity;

  // Recalculate totals
  await recalculateCartTotals(cart);
  await cart.save();

  return cart;
};

/**
 * Remove item from cart
 */
const removeFromCart = async (userId, itemId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === itemId.toString()
  );

  if (itemIndex === -1) {
    throw new NotFoundError('Item not found in cart');
  }

  cart.items.splice(itemIndex, 1);

  // Recalculate totals
  await recalculateCartTotals(cart);

  // Update user cart count
  await updateUserCartCount(userId, cart.items.length);

  await cart.save();

  return cart;
};

/**
 * Clear entire cart
 */
const clearCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId });
  // Clearing an already-empty cart is a no-op, not an error — the checkout
  // flow calls this after every order, including a user's first one.
  if (!cart) {
    return { items: [], subtotal: 0, estimatedTotal: 0 };
  }

  cart.items = [];
  cart.subtotal = 0;
  cart.discountTotal = 0;
  cart.estimatedTotal = 0;
  cart.coupon = null;

  await updateUserCartCount(userId, 0);
  await cart.save();

  return cart;
};

/**
 * Validate cart items against current stock & pricing (pre-checkout safety check).
 * Public — works for guest and logged-in carts alike, no userId needed.
 */
const validateCartItems = async (items) => {
  return Promise.all((items || []).map(async (item) => {
    const { subProductId, sizeId, quantity = 1, price: oldPrice = 0 } = item;
    const base = { subProductId, sizeId: sizeId || null, oldPrice };
    const unavailable = (extra = {}) => ({
      ...base, status: 'unavailable', available: false, currentPrice: 0,
      priceDiff: -oldPrice, stockStatus: 'unavailable', maxQuantity: 0, isLowStock: false, ...extra,
    });

    const subProduct = await SubProduct.findOne({ _id: subProductId, status: 'active' })
      .populate({ path: 'tenant', select: 'status subscriptionStatus revenueModel markupPercentage commissionPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits' })
      .populate({ path: 'product', select: 'platformMarkup platformDiscount' });

    if (!subProduct || !subProduct.tenant ||
        subProduct.tenant.status !== 'approved' ||
        !['active', 'trialing'].includes(subProduct.tenant.subscriptionStatus)) {
      return unavailable();
    }

    const size = sizeId ? await Size.findOne({ _id: sizeId, subproduct: subProductId }) : null;
    if (!size) return unavailable();

    // Platform selling price (markup/commission + product discount) — same pipeline
    // the storefront product page uses, NOT the raw tenant-facing Size.sellingPrice.
    // Quantity-aware: at quantity >= packThreshold the whole line pays packUnitPrice.
    const sizePricing = calculateSizePricing(
      size, subProduct.product, subProduct.tenant,
      subProduct.costPrice, subProduct.baseSellingPrice
    );
    const packApplied = sizePricing.packUnitPrice != null &&
      sizePricing.packThreshold != null && quantity >= sizePricing.packThreshold;
    const currentPrice = packApplied ? sizePricing.packUnitPrice : sizePricing.finalPrice;
    const packInfo = {
      baseUnitPrice: sizePricing.finalPrice,
      packUnitPrice: sizePricing.packUnitPrice,
      packThreshold: sizePricing.packThreshold,
      packSavingsPct: sizePricing.packSavingsPct,
      packApplied,
    };
    const stock         = size.availableStock || size.stock || 0;

    if (size.availability === 'out_of_stock' || stock <= 0) {
      return { ...base, ...packInfo, status: 'out_of_stock', available: false, currentPrice,
        priceDiff: currentPrice - oldPrice, stockStatus: 'out_of_stock', maxQuantity: 0, isLowStock: false };
    }

    const maxQuantity = size.maxOrderQuantity ? Math.min(stock, size.maxOrderQuantity) : stock;
    const isLowStock  = size.isLowStock;

    if (quantity > maxQuantity) {
      return { ...base, ...packInfo, status: 'quantity_reduced', available: true, currentPrice,
        priceDiff: currentPrice - oldPrice, stockStatus: size.availability, maxQuantity, isLowStock };
    }

    if (Math.round(currentPrice) !== Math.round(oldPrice)) {
      return { ...base, ...packInfo, status: 'price_changed', available: true, currentPrice,
        priceDiff: currentPrice - oldPrice, stockStatus: size.availability, maxQuantity, isLowStock };
    }

    return { ...base, ...packInfo, status: 'ok', available: true, currentPrice, priceDiff: 0,
      stockStatus: size.availability, maxQuantity, isLowStock };
  }));
};

/**
 * Merge the browser's cart into the stored cart on login.
 * Union keyed by cartItemId, HIGHER quantity wins (never the sum). Stock and
 * maxOrderQuantity clamping is inherited from syncCart, which re-validates
 * every line it writes.
 */
const mergeCart = async (userId, localItems) => {
  const stored = await getCart(userId);

  // Normalise the client payload to the same identity scheme getCart emits.
  const localLines = (localItems || [])
    .filter((item) => item.subProductId && item.sizeId && item.productId)
    .map((item) => ({
      cartItemId: buildCartItemId(
        String(item.productId), item.size || '', item.vendor || '', item.color || '',
      ),
      selectedProductId: String(item.productId),
      selectedSubProductId: String(item.subProductId),
      selectedSizeId: String(item.sizeId),
      selectedVendorId: item.tenantId ? String(item.tenantId) : null,
      quantity: item.quantity || 1,
      price: item.price,
    }));

  const merged = mergeCartLines(stored.items, localLines);

  // syncCart replaces the stored cart and re-validates stock per line.
  return syncCart(userId, merged.map((line) => ({
    productId:    line.selectedProductId,
    subProductId: line.selectedSubProductId,
    sizeId:       line.selectedSizeId,
    tenantId:     line.selectedVendorId,
    quantity:     line.quantity,
    price:        line.price,
  })));
};

module.exports = {
  addToCart,
  getCart,
  mergeCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  syncCart,
  replaceCart,
  recalculateCartTotals,
  validateCartItems,
};