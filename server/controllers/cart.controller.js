'use strict';

const cartService = require('../services/cart.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/cart
 * Authenticated — server-stored cart for the current user.
 */
exports.getMyCart = async (req, res) => {
  try {
    const cart = await cartService.getCart(req.user._id);
    return successResponse(res, { cart }, 'Cart fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch cart', 500, err);
  }
};

/**
 * POST /api/cart/save
 * Authenticated — replaces the server cart with the client's local cart.
 */
exports.saveCart = async (req, res) => {
  try {
    const { items } = req.body;
    const { cart, results } = await cartService.syncCart(req.user._id, items);
    return successResponse(res, { cart, results }, 'Cart saved');
  } catch (err) {
    return errorResponse(res, 'Failed to save cart', 500, err);
  }
};

/**
 * POST /api/cart/validate
 * Public — pre-checkout stock & price validation. Works for guest carts too.
 */
exports.validateCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'items array is required', 400);
    }
    const results = await cartService.validateCartItems(items);
    return successResponse(res, { items: results }, 'Cart validated');
  } catch (err) {
    return errorResponse(res, 'Failed to validate cart', 500, err);
  }
};
