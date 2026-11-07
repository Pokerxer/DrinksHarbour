'use strict';
const crypto = require('node:crypto');
const { computePOSPricing } = require('../posPricing');
const { resolveLineTaxRate } = require('../posTax.service');
const { findMatchingPriceRules, applyPriceRules } = require('../pricelistPricing.service');
const { fail, requireId } = require('./errors'); const { id } = require('./eligibility');
const { choiceSignature } = require('./menu-modifiers');
function minor(value) { const amount = Math.round(Number(value) * 100); if (!Number.isSafeInteger(amount) || amount < 0) fail('INVALID_MONEY', 'Invalid monetary amount', 400); return amount; }
function validateCart(cart) {
  if (['tipAmount', 'discountValue', 'discount', 'discountTotal', 'tipAmountMinor'].some(k => Number(cart[k] || 0) !== 0)
    || ['appliedRewards', 'combos', 'coupons'].some(k => cart[k]?.length) || cart.linkedSalesOrderId || cart.comboRef || cart.bxgyRef) fail('VENUE_UNSUPPORTED_CART', 'Unsupported venue cart rule; remove tips, promotions, credit or linked quotations', 422);
}
function assertVenueProduct(product) { if (!product || !require('../../constants/catalogKind').isVenueServiceProduct(product)) fail('VENUE_UNSUPPORTED_CART', 'Item is not eligible in venue service', 422); }
function priceAcceptedLine({ sp, size = null, tenant, input, actor, rules = [], now = new Date() }) {
  validateCart(input);
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) fail('INVALID_QUANTITY', 'Quantity must be an integer from 1 to 100', 400);
  const pricing = computePOSPricing(sp, size, tenant);
  const matches = findMatchingPriceRules(rules, id(sp), input.quantity);
  let unitPriceMinor = minor(applyPriceRules(pricing.sellingPrice, pricing.costPrice || 0, matches, Number(size?.wholesalePrice) || 0));
  if (input.override) {
    if (!actor.permissions?.includes('pos:price_override') || typeof input.override.reason !== 'string' || !input.override.reason.trim()) fail('VENUE_PERMISSION_DENIED', 'Price override permission and reason required', 403);
    if (!Number.isSafeInteger(input.override.unitPriceMinor) || input.override.unitPriceMinor <= 0) fail('INVALID_MONEY', 'Invalid override price', 400);
    unitPriceMinor = input.override.unitPriceMinor;
  }
  if (unitPriceMinor <= 0) fail('INVALID_MONEY', 'Configure a positive selling price', 400);
  const netMinor = unitPriceMinor * input.quantity;
  const taxRate = resolveLineTaxRate({ tenantPosSettings: tenant.posSettings });
  const taxMinor = Math.round(netMinor * taxRate / 100);
  if (![netMinor, taxMinor].every(Number.isSafeInteger)) fail('INVALID_MONEY');
  return { lineId: crypto.randomUUID(), revision: 1, product: sp.product?._id || sp.product, subproduct: sp._id, size: size?._id,
    name: sp.product?.name || 'Beverage', quantity: input.quantity, unitPriceMinor, netMinor, taxRate, taxMinor,
    costMinor: size?.servingSchemaVersion === 2 ? (size.costPrice == null ? null : minor(size.costPrice)) : minor(pricing.costPrice || 0), acceptedAt: now, priceRule: input.override ? { overrideReason: input.override.reason.trim() } : matches[0] ? { ruleId: matches[0]._id } : undefined, firedQuantity: 0 };
}
function validateVenueLineInputs(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) fail('INVALID_LINES', 'Choose 1–100 beverage lines', 400);
  const seen = new Set();
  for (const input of lines) {
    if (!input || typeof input !== 'object') fail('INVALID_LINES', 'Invalid beverage line', 400);
    requireId(input.subProductId); requireId(input.sizeId); validateCart(input);
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) fail('INVALID_QUANTITY', 'Quantity must be an integer from 1 to 100', 400);
    // Phase 3 S1: optional choices/note are shape-checked here only; the
    // semantic validation against the published menu lives in lines.js via
    // menu-modifiers (CHOICE_REQUIRED / CHOICE_NOT_OFFERED / CHOICE_INCOMPATIBLE).
    if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 200)) fail('INVALID_INPUT', 'Note must be at most 200 characters', 400);
    if (input.choices !== undefined && (!Array.isArray(input.choices) || input.choices.some(c => !c || typeof c !== 'object' || typeof c.groupId !== 'string' || typeof c.optionId !== 'string'))) fail('INVALID_INPUT', 'Invalid choice selection', 400);
    // Phase 3 S3: optional course membership — free-form short id (≤50), NOT part
    // of the merge identity (same code below): two identical parents stay one
    // line regardless of course; the course lock is enforced in lines.js.
    if (input.courseId !== undefined && (typeof input.courseId !== 'string' || !input.courseId.trim() || input.courseId.length > 50)) fail('INVALID_INPUT', 'Course id must be a short id of at most 50 characters', 400);
    // Merge identity includes the choice signature so identical parents merge
    // while differing selections stay distinct lines (same code as the 'p'
    // fallback used by setSessionLines for previously accepted plain lines).
    const key = `${input.subProductId.toLowerCase()}:${input.sizeId.toLowerCase()}:${input.choices?.length ? 'c:' + choiceSignature(input.choices) : 'p'}`;
    if (seen.has(key)) fail('INVALID_LINES', 'Combine duplicate beverage lines', 400); seen.add(key);
  }
}
async function priceVenueLines({ tenant, location, actor, lines, mongoSession, now = new Date() }) {
  validateVenueLineInputs(lines);
  const lists = await require('../../models/Pricelist').find({ tenant: tenant._id }).session(mongoSession).lean();
  const { resolved } = require('../pricelist.service').pickPricelistForShop({ pricelists: lists, warehouseId: id(location), shopId: actor.posShopId });
  if (resolved?.rules?.some(rule => ['bundle', 'cart_threshold'].includes(rule.priceType))) fail('VENUE_UNSUPPORTED_CART', 'Unsupported bundle/cart-threshold pricelist for canonical venue checkout', 422);
  const result = [];
  for (const input of lines) {
    const sp = await require('../../models/SubProduct').findOne({ _id: input.subProductId, tenant: tenant._id, visibleInPOS: { $ne: false }, status: { $nin: ['discontinued', 'hidden', 'archived'] } }).populate('product', 'name isAlcoholic type catalogKind').session(mongoSession).lean();
    const size = await require('../../models/Size').findOne({ _id: input.sizeId, tenant: tenant._id, subproduct: input.subProductId }).session(mongoSession).lean();
    if (!sp || !size) fail('NOT_FOUND', 'Beverage or size not found', 404);
    assertVenueProduct(sp.product);
    result.push(priceAcceptedLine({ sp, size, tenant, input, actor, rules: resolved?.rules || [], now }));
  }
  return result;
}
module.exports = { validateVenueLineInputs, assertVenueProduct, minor, validateCart, priceAcceptedLine, priceVenueLines };
