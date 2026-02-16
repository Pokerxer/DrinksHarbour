// services/wishlist.service.js

const Wishlist = require('../models/Wishlist');
const Product = require('../models/product');
const SubProduct = require('../models/subProduct');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Add product to wishlist
 */
const addToWishlist = async (data) => {
  const { userId, productId, subProductId, note, priority = 'medium' } = data;

  // Validate priority
  const validPriorities = ['high', 'medium', 'low', 'gift'];
  if (!validPriorities.includes(priority)) {
    throw new ValidationError(
      `Priority must be one of: ${validPriorities.join(', ')}`
    );
  }

  // Verify product exists and is approved
  const product = await Product.findOne({ _id: productId, status: 'approved' })
    .select('_id name slug')
    .lean();

  if (!product) {
    throw new NotFoundError('Product not found or not available');
  }

  // If subProductId provided, verify it exists
  if (subProductId) {
    const subProduct = await SubProduct.findOne({
      _id: subProductId,
      product: productId,
      status: 'active',
    }).lean();

    if (!subProduct) {
      throw new NotFoundError('Product variant not found');
    }
  }

  // Get or create wishlist
  let wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: userId,
      items: [],
      itemCount: 0,
    });
  }

  // Check if product already in wishlist
  const existingItemIndex = wishlist.items.findIndex(
    (item) => item.product.toString() === productId.toString()
  );

  let isNew = false;
  let item;

  if (existingItemIndex > -1) {
    // Product already in wishlist - update it
    item = wishlist.items[existingItemIndex];
    
    if (note) {
      item.note = note;
    }
    if (priority) {
      item.priority = priority;
    }
    if (subProductId) {
      item.addedFromSubproduct = subProductId;
    }
  } else {
    // Add new item
    isNew = true;
    const newItem = {
      product: productId,
      addedFromSubproduct: subProductId || undefined,
      addedAt: new Date(),
      note: note || undefined,
      priority,
      notifyWhenAvailable: false,
    };

    wishlist.items.push(newItem);
    item = newItem;
  }

  // Update counts
  wishlist.itemCount = wishlist.items.length;
  wishlist.lastUpdated = new Date();

  // Update user's wishlist count
  await updateUserWishlistCount(userId, wishlist.items.length);

  await wishlist.save();

  // Populate and return
  const populatedWishlist = await Wishlist.findById(wishlist._id)
    .populate({
      path: 'items.product',
      select: 'name slug images type isAlcoholic abv brand category priceRange',
      populate: [
        { path: 'brand', select: 'name slug logo' },
        { path: 'category', select: 'name slug' },
      ],
    })
    .populate({
      path: 'items.addedFromSubproduct',
      select: 'sku baseSellingPrice',
      populate: {
        path: 'tenant',
        select: 'name slug logo',
      },
    })
    .lean();

  return {
    wishlist: populatedWishlist,
    item,
    isNew,
  };
};

/**
 * Remove product from wishlist
 */
const removeFromWishlist = async (userId, productId) => {
  const wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    throw new NotFoundError('Wishlist not found');
  }

  const itemIndex = wishlist.items.findIndex(
    (item) => item.product.toString() === productId.toString()
  );

  if (itemIndex === -1) {
    throw new NotFoundError('Product not found in wishlist');
  }

  wishlist.items.splice(itemIndex, 1);
  wishlist.itemCount = wishlist.items.length;
  wishlist.lastUpdated = new Date();

  // Update user's wishlist count
  await updateUserWishlistCount(userId, wishlist.items.length);

  await wishlist.save();

  return wishlist;
};

/**
 * Get user's wishlist
 */
const getWishlist = async (userId) => {
  const wishlist = await Wishlist.findOne({ user: userId })
    .populate({
      path: 'items.product',
      select: 'name slug images type isAlcoholic abv brand category status',
      populate: [
        { path: 'brand', select: 'name slug logo' },
        { path: 'category', select: 'name slug' },
      ],
    })
    .populate({
      path: 'items.addedFromSubproduct',
      select: 'sku baseSellingPrice status',
      populate: {
        path: 'tenant',
        select: 'name slug logo',
      },
    })
    .lean();

  if (!wishlist) {
    return {
      items: [],
      itemCount: 0,
      isEmpty: true,
    };
  }

  return {
    ...wishlist,
    isEmpty: wishlist.items.length === 0,
  };
};

/**
 * Update wishlist item
 */
const updateWishlistItem = async (userId, productId, updates) => {
  const { note, priority, notifyWhenAvailable } = updates;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    throw new NotFoundError('Wishlist not found');
  }

  const item = wishlist.items.find(
    (item) => item.product.toString() === productId.toString()
  );

  if (!item) {
    throw new NotFoundError('Product not found in wishlist');
  }

  // Update fields
  if (note !== undefined) {
    item.note = note;
  }
  if (priority !== undefined) {
    const validPriorities = ['high', 'medium', 'low', 'gift'];
    if (!validPriorities.includes(priority)) {
      throw new ValidationError('Invalid priority value');
    }
    item.priority = priority;
  }
  if (notifyWhenAvailable !== undefined) {
    item.notifyWhenAvailable = notifyWhenAvailable;
  }

  wishlist.lastUpdated = new Date();
  await wishlist.save();

  return wishlist;
};

/**
 * Clear wishlist
 */
const clearWishlist = async (userId) => {
  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    throw new NotFoundError('Wishlist not found');
  }

  wishlist.items = [];
  wishlist.itemCount = 0;
  wishlist.lastUpdated = new Date();

  await updateUserWishlistCount(userId, 0);
  await wishlist.save();

  return wishlist;
};

/**
 * Update user's wishlist count
 */
const updateUserWishlistCount = async (userId, itemCount) => {
  try {
    const User = require('../models/user');
    await User.findByIdAndUpdate(userId, {
      wishlistCount: itemCount,
      lastWishlistUpdate: new Date(),
    });
  } catch (error) {
    console.error('Error updating user wishlist count:', error);
    // Don't throw - this is a soft failure
  }
};

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  updateWishlistItem,
  clearWishlist,
};