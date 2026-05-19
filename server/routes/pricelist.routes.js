// routes/pricelist.routes.js
const express    = require('express');
const router     = express.Router();
const Pricelist  = require('../models/Pricelist');
const SubProduct = require('../models/SubProduct');
const { authenticate, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(attachTenant);

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 100 } = req.query;
    const tenantId = req.tenant?._id;
    const filter = tenantId ? { tenant: tenantId } : {};
    if (search.trim()) filter.name = { $regex: search.trim(), $options: 'i' };

    const [items, total] = await Promise.all([
      Pricelist.find(filter)
        .select('-rules')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean(),
      Pricelist.countDocuments(filter),
    ]);
    res.json({ success: true, data: { pricelists: items, total } });
  } catch (err) { next(err); }
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id;
    const { name, currency, countryGroups, website, isSelectable } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const pl = await Pricelist.create({
      name: name.trim(), currency: currency || 'NGN',
      countryGroups: countryGroups || [], website: website || '',
      isSelectable: !!isSelectable, tenant: tenantId, rules: [],
    });
    res.status(201).json({ success: true, data: pl });
  } catch (err) { next(err); }
});

// ── Get one (rules + populated subproduct names + current promo state) ────────
router.get('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await Pricelist.findById(req.params.id)
      .populate({
        path: 'rules.subProduct',
        select: 'sku product baseSellingPrice costPrice saleType saleDiscountValue isOnSale flashSale bundleDeals',
        populate: { path: 'product', select: 'name' },
      })
      .lean();
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    res.json({ success: true, data: pl });
  } catch (err) { next(err); }
});

// ── Update meta ───────────────────────────────────────────────────────────────
router.patch('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { name, currency, countryGroups, website, isSelectable } = req.body;
    const $set = {};
    if (name         !== undefined) $set.name          = name;
    if (currency     !== undefined) $set.currency       = currency;
    if (countryGroups!== undefined) $set.countryGroups  = countryGroups;
    if (website      !== undefined) $set.website        = website;
    if (isSelectable !== undefined) $set.isSelectable   = isSelectable;

    const pl = await Pricelist.findByIdAndUpdate(req.params.id, { $set }, { new: true, runValidators: true }).lean();
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    res.json({ success: true, data: pl });
  } catch (err) { next(err); }
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    await Pricelist.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Add rule ──────────────────────────────────────────────────────────────────
router.post('/:id/rules', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await Pricelist.findById(req.params.id);
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });

    const {
      subProduct, appliedOn, priceType,
      fixedPrice, markupPercentage,
      discountType, discountPercentage, discountAmount,
      flashSalePercentage, flashSaleQty,
      bundleName, bundleQuantity, bundleDiscount, bundleDiscountType,
      minQuantity, startDate, endDate,
    } = req.body;

    pl.rules.push({
      subProduct, appliedOn, priceType,
      sequence: pl.rules.length, // append to end; lower = higher priority
      ruleCategory: ['fixed', 'formula'].includes(priceType) ? 'permanent' : 'dynamic',
      fixedPrice:          Number(fixedPrice)          || 0,
      markupPercentage:    Number(markupPercentage)    || 0,
      discountType:        discountType                || 'percentage',
      discountPercentage:  Number(discountPercentage)  || 0,
      discountAmount:      Number(discountAmount)      || 0,
      flashSalePercentage: Number(flashSalePercentage) || 0,
      flashSaleQty:        Number(flashSaleQty)        || 0,
      bundleName:          bundleName                  || '',
      bundleQuantity:      Number(bundleQuantity)      || 2,
      bundleDiscount:      Number(bundleDiscount)      || 10,
      bundleDiscountType:  bundleDiscountType          || 'percentage',
      minQuantity:         Number(minQuantity)         || 0,
      startDate, endDate,
    });
    await pl.save();
    res.status(201).json({ success: true, data: pl.rules[pl.rules.length - 1] });
  } catch (err) { next(err); }
});

// ── Update rule ───────────────────────────────────────────────────────────────
router.patch('/:id/rules/:ruleId', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await Pricelist.findById(req.params.id);
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    const rule = pl.rules.id(req.params.ruleId);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    Object.assign(rule, req.body);
    await pl.save();
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

// ── Delete rule ───────────────────────────────────────────────────────────────
router.delete('/:id/rules/:ruleId', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await Pricelist.findById(req.params.id);
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

// ── Reorder rules (drag-to-sequence) ─────────────────────────────────────────
router.patch('/:id/rules/reorder', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, message: 'orderedIds array required' });

    const pl = await Pricelist.findById(req.params.id);
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

// ── Apply pricelist ───────────────────────────────────────────────────────────
// Pushes each rule's config into the actual SubProduct promotion fields.
// Rules without subProduct reference apply to ALL SubProducts for the tenant.
router.post('/:id/apply', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const pl = await Pricelist.findById(req.params.id).lean();
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

          const products = await SubProduct.find(spFilter).select('_id costPrice').lean();
          let changed = 0;
          for (const sp of products) {
            if (!sp.costPrice || sp.costPrice <= 0) continue;
            await SubProduct.findByIdAndUpdate(sp._id, {
              $set: {
                baseSellingPrice: Math.round(sp.costPrice * (1 + rule.markupPercentage / 100) * 100) / 100,
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

module.exports = router;
