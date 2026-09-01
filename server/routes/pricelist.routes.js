// routes/pricelist.routes.js
const express    = require('express');
const router     = express.Router();
const Pricelist  = require('../models/Pricelist');
const SubProduct = require('../models/SubProduct');
const { authenticate, attachTenant, tenantAdminOrSuperAdmin, requireOwnTenant } = require('../middleware/auth.middleware');
const { enforceSingleDefault } = require('../services/pricelist.service');
const { resequenceRules, rulesInSequenceOrder } = require('../services/pricelistPriority.service');

router.use(authenticate);
router.use(attachTenant);
// Tenant-owned module: POS, sales, purchases and inventory data belongs to a
// single tenant. requireOwnTenant takes the tenant from the JWT claim only —
// no x-tenant-slug/?tenant= pivot, no client-supplied tenantId, no admin bypass.
router.use(requireOwnTenant);

/**
 * Tenant-scoped Pricelist lookup (Workstream B — never bare findById).
 *
 * For tenant_owner/tenant_admin (tenant in JWT): scopes by { _id, tenant } so
 * a cross-tenant _id returns null → 404.
 *
 * For super_admin/admin: if req.tenant is resolved (via x-tenant-slug), scope
 * by it; otherwise fall back to bare findById (platform-wide — intentional per
 * tenant.middleware.js: "req.tenant = null is intentional for super_admin").
 *
 * @param {object} req  - Express request with req.tenant + req.user
 * @param {string} id   - Pricelist _id
 * @param {object} opts - { lean: boolean } — lean returns a plain object
 * @returns {Promise<object|null>} the pricelist doc or null (404)
 */
async function loadTenantPricelist(req, id, opts = {}) {
  const tenantId = req.tenant?._id;
  const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user?.role);
  if (tenantId) {
    const q = Pricelist.findOne({ _id: id, tenant: tenantId });
    return opts.lean ? q.lean() : q;
  }
  // super_admin/admin with no x-tenant-slug → platform-wide
  if (isPlatformAdmin) {
    const q = Pricelist.findById(id);
    return opts.lean ? q.lean() : q;
  }
  // No tenant context and not a platform admin — deny.
  return null;
}

/**
 * Whitelist of client-owned rule fields for add/update. Server-owned fields
 * (sequence, ruleCategory) are NEVER accepted from the client — they are
 * derived server-side (sequence = append-to-end on add; reorder endpoint owns
 * re-assignment; ruleCategory = derived from priceType).
 */
const RULE_FIELDS = [
  'subProduct', 'appliedOn', 'priceType',
  'fixedPrice', 'markupPercentage', 'markupBase',
  'discountType', 'discountPercentage', 'discountAmount',
  'flashSalePercentage', 'flashSaleQty',
  'bundleName', 'bundleQuantity', 'bundleDiscount', 'bundleDiscountType',
  'bundleMarkupBase', 'bundleUnitsMode',
  'bundleTargetSubProduct',
  'thresholdAmount',
  'minQuantity', 'startDate', 'endDate',
];

/** Derive ruleCategory from priceType (mirrors the schema default function). */
function deriveRuleCategory(priceType) {
  return ['fixed', 'formula'].includes(priceType) ? 'permanent' : 'dynamic';
}

/**
 * Sequence for a rule appended to the end of `rules`: one past the highest
 * sequence in use, 0 when there are none.
 *
 * Not `rules.length` — deleting a rule shrinks the array without renumbering
 * the survivors, so on a pricelist that has ever had a rule deleted the length
 * lands on a sequence that is still in use (delete sequence 0 of [0,1,2] and
 * the next add gets 2, tying with a live rule). Rules stack in sequence order,
 * so a tie makes the applied price depend on stored array order.
 */
function nextRuleSequence(rules) {
  const seqs = (rules || []).map(r => Number(r.sequence) || 0);
  return seqs.length ? Math.max(...seqs) + 1 : 0;
}

// `rulesInSequenceOrder` now lives in pricelistPriority.service — the pricing
// engine's bundle picker needs the same ordering, and two copies of a
// price-deciding comparator is exactly how the panel drifted from the engines.

/**
 * Strict numeric parse — returns NaN on garbage (not 0). Replaces Number(x) || 0
 * which silently zeroed '500abc' instead of rejecting it. Uses Number() (not
 * parseFloat) so '500abc' → NaN, not 500 (parseFloat parses leading prefixes).
 */
function parseFloatStrict(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Cross-field validation per priceType. Returns { errors } (field-keyed) or null.
 * Enforces the same invariants the client validates (pos-pricelists.tsx:568)
 * so a direct API caller gets a structured 400, not a silent no-op rule.
 */
function validateRuleFields(body) {
  const errors = {};
  const pt = body.priceType;

  if (pt === 'fixed') {
    const fp = parseFloatStrict(body.fixedPrice);
    if (Number.isNaN(fp) || fp <= 0) errors.fixedPrice = 'Enter a price';
  } else if (pt === 'formula') {
    const mp = parseFloatStrict(body.markupPercentage);
    if (Number.isNaN(mp) || mp <= 0) errors.markupPercentage = 'Enter a markup %';
    if (body.markupBase && !['cost', 'wholesale'].includes(body.markupBase))
      errors.markupBase = 'Invalid markup base';
  } else if (pt === 'discount') {
    if (body.discountType === 'fixed') {
      const amt = parseFloatStrict(body.discountAmount);
      if (Number.isNaN(amt) || amt <= 0) errors.discountAmount = 'Enter an amount';
    } else {
      const pct = parseFloatStrict(body.discountPercentage);
      if (Number.isNaN(pct) || pct <= 0) errors.discountPercentage = 'Enter a discount %';
    }
  } else if (pt === 'flash_sale') {
    const pct = parseFloatStrict(body.flashSalePercentage);
    if (Number.isNaN(pct) || pct <= 0) errors.flashSalePercentage = 'Enter a discount %';
  } else if (pt === 'bundle') {
    if (body.bundleUnitsMode !== 'pack') {
      const qty = parseFloatStrict(body.bundleQuantity);
      if (Number.isNaN(qty) || qty < 2) errors.bundleQuantity = 'Min 2 units';
    }
    if (body.bundleDiscountType !== 'no_discount') {
      const disc = parseFloatStrict(body.bundleDiscount);
      if (Number.isNaN(disc) || disc <= 0) {
        errors.bundleDiscount = body.bundleDiscountType === 'markup_on_cost'
          ? 'Enter a markup %' : 'Enter a discount';
      }
    }
    if (body.bundleMarkupBase && !['cost', 'wholesale'].includes(body.bundleMarkupBase))
      errors.bundleMarkupBase = 'Invalid markup base';
    if (body.bundleUnitsMode && !['manual', 'pack'].includes(body.bundleUnitsMode))
      errors.bundleUnitsMode = 'Invalid units mode';
    // A cross-product bundle needs a specific trigger product — "buy N of
    // (all products) → discount target" can never fire in the cart engine.
    if (body.bundleTargetSubProduct && !body.subProduct) {
      errors.subProduct = 'Pick the trigger product for a Buy X Get Y bundle';
    }
  } else if (pt === 'cart_threshold') {
    const thresh = parseFloatStrict(body.thresholdAmount);
    if (Number.isNaN(thresh) || thresh <= 0) errors.thresholdAmount = 'Enter a spend threshold';
    if (body.discountType === 'fixed') {
      const amt = parseFloatStrict(body.discountAmount);
      if (Number.isNaN(amt) || amt <= 0) errors.discountAmount = 'Enter an amount';
    } else {
      const pct = parseFloatStrict(body.discountPercentage);
      if (Number.isNaN(pct) || pct <= 0) errors.discountPercentage = 'Enter a discount %';
    }
  }

  // Date window: end must be after start (when both set).
  if (body.startDate && body.endDate) {
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
      errors.endDate = 'End must be after start';
    }
  }

  return Object.keys(errors).length ? errors : null;
}

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 100 } = req.query;
    const tenantId = req.tenant?._id;
    const filter = tenantId ? { tenant: tenantId } : {};
    if (search.trim()) filter.name = { $regex: search.trim(), $options: 'i' };

    const pageN = parseInt(page) || 1;
    const limitN = parseInt(limit) || 100;

    const [items, total] = await Promise.all([
      // Aggregation (instead of .select('-rules')) so list consumers can show
      // an accurate "N rules" label via a lightweight ruleCount — while still
      // never shipping the full rules payload to the list screen. The print
      // picker fetches a pricelist's actual rules through GET /:id on select.
      Pricelist.aggregate([
        { $match: filter },
        { $addFields: { ruleCount: { $size: { $ifNull: ['$rules', []] } } } },
        { $sort: { createdAt: -1 } },
        { $skip: (pageN - 1) * limitN },
        { $limit: limitN },
        { $project: { rules: 0 } },
      ]),
      Pricelist.countDocuments(filter),
    ]);
    res.json({ success: true, data: { pricelists: items, total } });
  } catch (err) { next(err); }
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id;
    const { name, currency, countryGroups, website, isSelectable, shops, warehouses, isDefault, customerTags } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const pl = await Pricelist.create({
      name: name.trim(), currency: currency || 'NGN',
      countryGroups: countryGroups || [], website: website || '',
      isSelectable: !!isSelectable,
      shops: Array.isArray(shops) ? shops.map(String) : [],
      warehouses: Array.isArray(warehouses) ? warehouses : [],
      customerTags: Array.isArray(customerTags) ? customerTags.map(String) : [],
      isDefault: !!isDefault,
      tenant: tenantId, rules: [],
    });
    if (pl.isDefault) await enforceSingleDefault(tenantId, pl._id);
    res.status(201).json({ success: true, data: pl });
  } catch (err) { next(err); }
});

// ── Get one (rules + populated subproduct names + current promo state) ────────
router.get('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id;
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user?.role);
    let q;
    if (tenantId) {
      q = Pricelist.findOne({ _id: req.params.id, tenant: tenantId });
    } else if (isPlatformAdmin) {
      q = Pricelist.findById(req.params.id);
    } else {
      return res.status(404).json({ success: false, message: 'Pricelist not found' });
    }
    const pl = await q
      .populate({
        path: 'rules.subProduct',
        select: 'sku product baseSellingPrice costPrice saleType saleDiscountValue isOnSale flashSale bundleDeals',
        populate: { path: 'product', select: 'name' },
      })
      .populate({
        // Buy X Get Y target — without this the rule card can only render
        // "another product" instead of the target's name on initial view.
        path: 'rules.bundleTargetSubProduct',
        select: 'sku product',
        populate: { path: 'product', select: 'name' },
      })
      .lean();
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    // The reorder endpoint rewrites `sequence` in place and never reorders the
    // stored array, so the raw document order is not the priority order. Ship
    // the order the pricing engines actually apply, so no consumer has to know.
    res.json({ success: true, data: { ...pl, rules: rulesInSequenceOrder(pl.rules) } });
  } catch (err) { next(err); }
});

// ── Update meta ───────────────────────────────────────────────────────────────
router.patch('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { name, currency, countryGroups, website, isSelectable, shops, warehouses, isDefault, customerTags } = req.body;
    const $set = {};
    if (name          !== undefined) $set.name          = name;
    if (currency      !== undefined) $set.currency       = currency;
    if (countryGroups !== undefined) $set.countryGroups  = countryGroups;
    if (website       !== undefined) $set.website        = website;
    if (isSelectable  !== undefined) $set.isSelectable   = isSelectable;
    if (shops         !== undefined) $set.shops          = Array.isArray(shops) ? shops.map(String) : [];
    if (warehouses    !== undefined) $set.warehouses     = Array.isArray(warehouses) ? warehouses : [];
    if (customerTags  !== undefined) $set.customerTags   = Array.isArray(customerTags) ? customerTags.map(String) : [];
    if (isDefault     !== undefined) $set.isDefault      = !!isDefault;

    const tenantId = req.tenant?._id;
    const filter = tenantId
      ? { _id: req.params.id, tenant: tenantId }
      : ['super_admin', 'admin'].includes(req.user?.role)
        ? { _id: req.params.id }
        : null;
    if (!filter) return res.status(404).json({ success: false, message: 'Pricelist not found' });

    const pl = await Pricelist.findOneAndUpdate(filter, { $set }, { new: true, runValidators: true }).lean();
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    if ($set.isDefault === true) await enforceSingleDefault(tenantId || pl.tenant, pl._id);
    res.json({ success: true, data: pl });
  } catch (err) { next(err); }
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id;
    const filter = tenantId
      ? { _id: req.params.id, tenant: tenantId }
      : ['super_admin', 'admin'].includes(req.user?.role)
        ? { _id: req.params.id }
        : null;
    if (!filter) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    const result = await Pricelist.deleteOne(filter);
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Add rule ──────────────────────────────────────────────────────────────────
router.post('/:id/rules', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await loadTenantPricelist(req, req.params.id);
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });

    const body = req.body || {};

    // Cross-field validation per priceType — structured 400, not a silent no-op.
    const fieldErrors = validateRuleFields(body);
    if (fieldErrors) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the highlighted fields',
        errors: fieldErrors,
      });
    }

    const {
      subProduct, appliedOn, priceType,
      fixedPrice, markupPercentage, markupBase,
      discountType, discountPercentage, discountAmount,
      flashSalePercentage, flashSaleQty,
      bundleName, bundleQuantity, bundleDiscount, bundleDiscountType,
      bundleMarkupBase, bundleUnitsMode,
      bundleTargetSubProduct,
      thresholdAmount,
      minQuantity, startDate, endDate,
    } = body;

    // Force bundleDiscount = 0 when no_discount (client does this at
    // pos-pricelists.tsx:630, but a direct API caller could send a contradiction).
    const effectiveBundleDiscount = bundleDiscountType === 'no_discount'
      ? 0
      : (Number.isNaN(parseFloatStrict(bundleDiscount)) ? 0 : parseFloatStrict(bundleDiscount));

    pl.rules.push({
      subProduct, appliedOn, priceType,
      sequence: nextRuleSequence(pl.rules), // append to end; lower = higher priority
      ruleCategory: deriveRuleCategory(priceType),
      fixedPrice:          parseFloatStrict(fixedPrice)          || 0,
      markupPercentage:    parseFloatStrict(markupPercentage)    || 0,
      markupBase:          markupBase === 'wholesale' ? 'wholesale' : 'cost',
      discountType:        discountType                          || 'percentage',
      discountPercentage:  parseFloatStrict(discountPercentage)  || 0,
      discountAmount:      parseFloatStrict(discountAmount)      || 0,
      flashSalePercentage: parseFloatStrict(flashSalePercentage) || 0,
      flashSaleQty:        parseFloatStrict(flashSaleQty)        || 0,
      bundleName:          bundleName                            || '',
      bundleQuantity:      parseFloatStrict(bundleQuantity)      || 2,
      bundleDiscount:      effectiveBundleDiscount,
      bundleDiscountType:  bundleDiscountType                    || 'percentage',
      bundleMarkupBase:    bundleMarkupBase === 'wholesale' ? 'wholesale' : 'cost',
      bundleUnitsMode:     bundleUnitsMode === 'pack' ? 'pack' : 'manual',
      bundleTargetSubProduct: bundleTargetSubProduct || undefined,
      thresholdAmount:        parseFloatStrict(thresholdAmount)        || 0,
      minQuantity:         parseFloatStrict(minQuantity)         || 0,
      startDate, endDate,
    });
    resequenceRules(pl.rules); // priority is derived — see pricelistPriority.service
    await pl.save();
    res.status(201).json({ success: true, data: pl.rules[pl.rules.length - 1] });
  } catch (err) { next(err); }
});

// ── Reorder rules (drag-to-sequence) ─────────────────────────────────────────
// MUST stay above PATCH /:id/rules/:ruleId. Express matches in declaration
// order and both patterns are three segments, so a reorder declared after the
// update-rule route is matched as ruleId='reorder' → pl.rules.id('reorder') →
// null → 404 "Rule not found". Declared last, this endpoint was unreachable:
// every ↑/↓ press in the panel 404'd, which is why no pricelist in the
// database has ever had a non-default sequence order.
router.patch('/:id/rules/reorder', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, message: 'orderedIds array required' });

    const pl = await loadTenantPricelist(req, req.params.id);
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });

    // Atomic batch: assign all sequences in one save to prevent duplicate sequences
    const sequenceMap = new Map(orderedIds.map((id, i) => [String(id), i]));
    pl.rules.forEach(rule => {
      const seq = sequenceMap.get(String(rule._id));
      if (seq !== undefined) rule.sequence = seq;
    });

    await pl.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Update rule ───────────────────────────────────────────────────────────────
router.patch('/:id/rules/:ruleId', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await loadTenantPricelist(req, req.params.id);
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    const rule = pl.rules.id(req.params.ruleId);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    // Cross-field validation — merge the patch over the existing rule so the
    // validator sees the effective priceType/discountType/etc.
    const merged = { ...rule.toObject ? rule.toObject() : rule, ...req.body };
    const fieldErrors = validateRuleFields(merged);
    if (fieldErrors) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the highlighted fields',
        errors: fieldErrors,
      });
    }

    // Whitelist: only client-owned rule fields are applied. Server-owned
    // sequence (owned by the reorder endpoint) and ruleCategory (derived from
    // priceType) are NEVER copied from req.body — Object.assign was replaced
    // to prevent clients from hijacking them.
    for (const field of RULE_FIELDS) {
      if (req.body[field] !== undefined) {
        rule[field] = req.body[field];
      }
    }
    // Re-derive ruleCategory from the (possibly changed) priceType.
    if (req.body.priceType !== undefined) {
      rule.ruleCategory = deriveRuleCategory(req.body.priceType);
    }
    // Force bundleDiscount = 0 when no_discount (server-side, defense-in-depth).
    if (req.body.bundleDiscountType === 'no_discount') {
      rule.bundleDiscount = 0;
    }

    // priceType / minQuantity / subProduct all decide where a rule ranks, so a
    // successful edit can move it — re-rank rather than leave a stale sequence.
    resequenceRules(pl.rules);
    await pl.save();
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

// ── Delete rule ───────────────────────────────────────────────────────────────
router.delete('/:id/rules/:ruleId', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await loadTenantPricelist(req, req.params.id);
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    const rule = pl.rules.id(req.params.ruleId);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    const tenantId = req.tenant?._id;
    const spFilter = rule.subProduct
      ? { _id: rule.subProduct }
      : tenantId ? { tenant: tenantId } : null;

    // Revert the rule's effect on products
    if (spFilter) {
      if (rule.priceType === 'discount') {
        await SubProduct.updateMany(spFilter, {
          $set:   { isOnSale: false, saleDiscountValue: 0 },
          $unset: { saleType: '', saleStartDate: '', saleEndDate: '' },
        });
      } else if (rule.priceType === 'flash_sale') {
        await SubProduct.updateMany(spFilter, {
          $set: { 'flashSale.isActive': false, isOnSale: false },
        });
      } else if (rule.priceType === 'bundle') {
        const dt = rule.bundleDiscountType || 'percentage';
        const bundleName = rule.bundleName || (
          dt === 'markup_on_cost' ? `Buy ${rule.bundleQuantity}+ · Cost +${rule.bundleDiscount || 0}% markup`
          : dt === 'no_discount'  ? `Buy ${rule.bundleQuantity}+ · No discount`
          : dt === 'fixed'        ? `Buy ${rule.bundleQuantity}+ · ₦${rule.bundleDiscount || 0} off`
          : `Buy ${rule.bundleQuantity}+ · ${rule.bundleDiscount || 0}% off`
        );
        await SubProduct.updateMany(spFilter, {
          $pull: { bundleDeals: { name: bundleName } },
        });
      }
      // fixed / formula: base price was overridden; cannot safely revert without original value
    }

    pl.rules.pull({ _id: req.params.ruleId });
    resequenceRules(pl.rules); // close the gap the removed rule left
    await pl.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Coverage — pricelists affecting a specific sub-product ───────────────────
router.get('/coverage/:subProductId', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id;
    const filter   = tenantId ? { tenant: tenantId } : {};
    const sid      = String(req.params.subProductId);

    const all = await Pricelist.find(filter)
      .select('name currency isSelectable rules')
      .lean();

    // Keep pricelists that have ≥1 rule matching this product or targeting all products
    const coverage = all
      .filter(pl => pl.rules.some(r => !r.subProduct || String(r.subProduct) === sid))
      .map(pl => ({
        _id:          pl._id,
        name:         pl.name,
        currency:     pl.currency,
        isSelectable: pl.isSelectable,
        // Only return the rules that actually apply to this product
        rules: pl.rules
          .filter(r => !r.subProduct || String(r.subProduct) === sid)
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0)),
      }));

    res.json({ success: true, data: { pricelists: coverage } });
  } catch (err) { next(err); }
});

// ── Apply pricelist ───────────────────────────────────────────────────────────
// Pushes each rule's config into the actual SubProduct promotion fields.
// Rules without subProduct reference apply to ALL SubProducts for the tenant.
router.post('/:id/apply', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await loadTenantPricelist(req, req.params.id, { lean: true });
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });

    const tenantId = req.tenant?._id;
    const now = new Date();
    const results = { modified: 0, skipped: 0, errors: [] };

    for (const rule of pl.rules) {
      try {
        // Skip rules whose end date has already passed
        if (rule.endDate && new Date(rule.endDate) < now) {
          results.skipped++; continue;
        }

        // Build SubProduct filter: specific product OR all tenant products
        const spFilter = rule.subProduct
          ? { _id: rule.subProduct }
          : tenantId ? { tenant: tenantId } : null;
        if (!spFilter) { results.skipped++; continue; }

        // ── Fixed price ─────────────────────────────────────────────────────
        // Sets baseSellingPrice directly and clears all active sale/discount state
        // so the pricing engine shows only the new base price.
        if (rule.priceType === 'fixed') {
          if (!rule.fixedPrice || rule.fixedPrice <= 0) { results.skipped++; continue; }

          // Save original prices before overwriting (skip already-saved)
          const needBackup = await SubProduct.find(
            { ...spFilter, basePriceBeforePricelist: { $exists: false } },
          ).select('_id baseSellingPrice').lean();
          if (needBackup.length > 0) {
            await SubProduct.bulkWrite(
              needBackup.map(sp => ({
                updateOne: {
                  filter: { _id: sp._id },
                  update: { $set: { basePriceBeforePricelist: sp.baseSellingPrice } },
                },
              }))
            );
          }

          const r = await SubProduct.updateMany(spFilter, {
            $set: {
              baseSellingPrice: rule.fixedPrice,
              isOnSale: false,
              saleDiscountValue: 0,
              'flashSale.isActive': false,
            },
            $unset: { saleType: '', saleStartDate: '', saleEndDate: '' },
          });
          results.modified += r.modifiedCount;

        // ── Formula (markup on cost price) ──────────────────────────────────
        // Computes baseSellingPrice per product from its costPrice.
        // Clears discount state — the price change IS the promotion.
        } else if (rule.priceType === 'formula') {
          if (!rule.markupPercentage || rule.markupPercentage <= 0) { results.skipped++; continue; }
          const useWholesale = rule.markupBase === 'wholesale';

          const products = await SubProduct.find(spFilter)
            .select('_id costPrice baseSellingPrice basePriceBeforePricelist defaultSize sizes')
            .populate('sizes', 'wholesalePrice costPrice isDefault')
            .lean();
          let changed = 0;
          for (const sp of products) {
            // Resolve the markup base: cost, or the default size's wholesale price.
            let basis = useWholesale ? 0 : (Number(sp.costPrice) || 0);
            if (useWholesale) {
              const sizes = Array.isArray(sp.sizes) ? sp.sizes : [];
              basis = Number(sizes.find((s) => s.isDefault)?.wholesalePrice) || 0;
              if (basis <= 0) basis = Number(sizes.find((s) => Number(s.wholesalePrice) > 0)?.wholesalePrice) || 0;
            }
            if (!basis || basis <= 0) continue;
            // Save original price on first apply
            if (!sp.basePriceBeforePricelist && sp.baseSellingPrice > 0) {
              await SubProduct.findByIdAndUpdate(sp._id, {
                $set: { basePriceBeforePricelist: sp.baseSellingPrice },
              });
            }
            await SubProduct.findByIdAndUpdate(sp._id, {
              $set: {
                baseSellingPrice: Math.round(basis * (1 + rule.markupPercentage / 100) * 100) / 100,
                isOnSale: false,
                saleDiscountValue: 0,
                'flashSale.isActive': false,
              },
              $unset: { saleType: '', saleStartDate: '', saleEndDate: '' },
            });
            changed++;
          }
          if (changed === 0) results.skipped++;
          else results.modified += changed;

        // ── Discount / Flash sale / Bundle — DYNAMIC ONLY ────────────────────
        // These rules are runtime policies: they activate when this pricelist is
        // selected in a POS session and vanish when deselected. Writing them to
        // product fields causes them to bleed into every session regardless of
        // which pricelist is selected (isolation violation). They are NOT pushed
        // to the database here — select the pricelist in the POS sell screen.
        } else if (
          rule.priceType === 'discount' ||
          rule.priceType === 'flash_sale' ||
          rule.priceType === 'bundle'
        ) {
          results.dynamic = (results.dynamic || 0) + 1;

        } else {
          results.skipped++;
        }

      } catch (ruleErr) {
        results.errors.push({ rule: rule._id, error: ruleErr.message });
      }
    }

    const dynamic = results.dynamic || 0;
    const skippedNote = results.skipped > 0
      ? ` (${results.skipped} rule${results.skipped !== 1 ? 's' : ''} skipped)`
      : '';
    const dynamicNote = dynamic > 0
      ? ` · ${dynamic} dynamic rule${dynamic !== 1 ? 's' : ''} active when pricelist is selected in POS`
      : '';
    res.json({
      success: true,
      data: {
        modified: results.modified,
        dynamic,
        skipped:  results.skipped,
        errors:   results.errors,
        total:    pl.rules.length,
        message:  `${results.modified} product${results.modified !== 1 ? 's' : ''} updated${skippedNote}${dynamicNote}`,
      },
    });
  } catch (err) { next(err); }
});

// ── Revert applied pricelist prices ─────────────────────────────────────────
// Restores baseSellingPrice from basePriceBeforePricelist for all products
// that had a pricelist applied. Clears the backup field after restore so
// future applies will save the current price as the new original.
router.post('/revert-applied', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id;
    const filter = tenantId
      ? { tenant: tenantId, basePriceBeforePricelist: { $exists: true, $gt: 0 } }
      : { basePriceBeforePricelist: { $exists: true, $gt: 0 } };

    const toRevert = await SubProduct.find(filter)
      .select('_id baseSellingPrice basePriceBeforePricelist')
      .lean();

    if (toRevert.length === 0) {
      return res.json({
        success: true,
        data: { modified: 0, message: 'No applied pricelist prices to revert' },
      });
    }

    const bulkOps = toRevert.map(sp => ({
      updateOne: {
        filter: { _id: sp._id },
        update: {
          $set: { baseSellingPrice: sp.basePriceBeforePricelist },
          $unset: { basePriceBeforePricelist: '' },
        },
      },
    }));

    await SubProduct.bulkWrite(bulkOps);

    res.json({
      success: true,
      data: {
        modified: toRevert.length,
        message: `${toRevert.length} product${toRevert.length !== 1 ? 's' : ''} reverted to original prices`,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
