// services/cart.service.js

const Cart = require('../models/Cart');
const Product = require('../models/product');
const Size = require('../models/size');
const SubProduct = require('../models/subProduct');
const Tenant = require('../models/tenant');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');

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
    // Add new item
    const newItem = {
      product: productId,
      subproduct: subProductId,
      size: sizeId,
      tenant: subProduct.tenant._id,
      priceAtAddition: size.sellingPrice,
      quantity,
      maxAvailableAtAddition: size.stock,
      discountApplied: size.discountValue || 0,
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
    const User = require('../models/user');
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
  const cart = await Cart.findOne({ user: userId })
    .populate({
      path: 'items.product',
      select: 'name slug images type isAlcoholic abv status',
    })
    .populate({
      path: 'items.subproduct',
      select: 'sku baseSellingPrice status',
      populate: {
        path: 'tenant',
        select: 'name slug logo status subscriptionStatus',
      },
    })
    .populate({
      path: 'items.size',
      select: 'size displayName sellingPrice stock availability currency',
    })
    .lean();

  if (!cart) {
    // Return empty cart structure
    return {
      items: [],
      subtotal: 0,
      discountTotal: 0,
      estimatedTotal: 0,
      isEmpty: true,
    };
  }

  return {
    ...cart,
    isEmpty: cart.items.length === 0,
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
  if (!cart) {
    throw new NotFoundError('Cart not found');
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

module.exports = {
  addToCart,
  getCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  syncCart,
  replaceCart,
  recalculateCartTotals,
};