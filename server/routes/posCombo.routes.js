const express  = require('express');
const router   = express.Router();
const POSCombo = require('../models/POSCombo');
const { authenticate, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(attachTenant);

// ── Shared populate options ───────────────────────────────────────────────────

const itemsPopulate = {
  path:    'choiceLines.items.subProduct',
  select:  'sku baseSellingPrice availableStock sellWithoutSizeVariants sizes product',
  populate: [
    { path: 'product', select: 'name images type' },
    { path: 'sizes',   select: 'displayName sellingPrice availableStock _id' },
  ],
};

// ── Normalise choiceLines from request body ───────────────────────────────────
function normaliseLines(choiceLines) {
  return (choiceLines || []).map(cl => ({
    label:     cl.label,
    minSelect: cl.minSelect ?? 1,
    maxSelect: cl.maxSelect ?? 1,
    required:  cl.required !== false,
    items: (cl.items || []).map(it => ({
      subProduct:   it.subProduct?._id || it.subProduct,
      allowedSizes: (it.allowedSizes || []).map(s => s._id || s),
    })),
    // keep legacy field for backward-compat
    products: [],
    _id: cl._id,
  }));
}

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const combos = await POSCombo.find({ tenant: req.tenant._id })
      .populate(itemsPopulate)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { combos } });
  } catch (err) { next(err); }
});

// ── Get one ───────────────────────────────────────────────────────────────────
router.get('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const combo = await POSCombo.findOne({ _id: req.params.id, tenant: req.tenant._id })
      .populate(itemsPopulate)
      .lean();
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });
    res.json({ success: true, data: { combo } });
  } catch (err) { next(err); }
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { name, description, price, choiceLines, active } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const combo = await POSCombo.create({
      tenant:      req.tenant._id,
      name:        name.trim(),
      description: description || '',
      price:       Number(price) || 0,
      choiceLines: normaliseLines(choiceLines),
      active:      active !== false,
    });

    res.status(201).json({ success: true, data: { combo } });
  } catch (err) { next(err); }
});

// ── Update ────────────────────────────────────────────────────────────────────
router.patch('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { name, description, price, choiceLines, active } = req.body;
    const combo = await POSCombo.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });

    if (name !== undefined)        combo.name        = name.trim();
    if (description !== undefined) combo.description = description;
    if (price !== undefined)       combo.price       = Number(price) || 0;
    if (active !== undefined)      combo.active      = active;
    if (choiceLines !== undefined) combo.choiceLines = normaliseLines(choiceLines);

    await combo.save();
    res.json({ success: true, data: { combo } });
  } catch (err) { next(err); }
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const combo = await POSCombo.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id });
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });
    res.json({ success: true, message: 'Combo deleted' });
  } catch (err) { next(err); }
});

// ── POS active combos (sell page) ─────────────────────────────────────────────
router.get('/pos/active', async (req, res, next) => {
  try {
    const combos = await POSCombo.find({ tenant: req.tenant._id, active: true })
      .populate(itemsPopulate)
      .lean();
    res.json({ success: true, data: { combos } });
  } catch (err) { next(err); }
});

module.exports = router;
