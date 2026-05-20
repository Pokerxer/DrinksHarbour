const express = require('express');
const router  = express.Router();
const POSCombo = require('../models/POSCombo');
const { authenticate, attachTenant, tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(attachTenant);

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant._id;
    const combos = await POSCombo.find({ tenant: tenantId })
      .populate({
        path:    'choiceLines.products',
        select:  'sku baseSellingPrice product',
        populate: { path: 'product', select: 'name images' },
      })
      .populate({
        path:   'triggerProducts',
        select: 'sku baseSellingPrice product',
        populate: { path: 'product', select: 'name' },
      })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { combos } });
  } catch (err) { next(err); }
});

// ── Get one ───────────────────────────────────────────────────────────────────
router.get('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const combo = await POSCombo.findOne({ _id: req.params.id, tenant: req.tenant._id })
      .populate({
        path:    'choiceLines.products',
        select:  'sku baseSellingPrice product availableStock',
        populate: { path: 'product', select: 'name images type' },
      })
      .populate({
        path:   'triggerProducts',
        select: 'sku baseSellingPrice product',
        populate: { path: 'product', select: 'name' },
      })
      .lean();
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });
    res.json({ success: true, data: { combo } });
  } catch (err) { next(err); }
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { name, description, image, price, choiceLines, active, triggerProducts } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const combo = await POSCombo.create({
      tenant: req.tenant._id,
      name:   name.trim(),
      description: description || '',
      image:  image || '',
      price:  Number(price) || 0,
      choiceLines: (choiceLines || []).map(cl => ({
        label:      cl.label,
        minSelect:  cl.minSelect ?? 1,
        maxSelect:  cl.maxSelect ?? 1,
        products:   cl.products || [],
      })),
      active: active !== false,
      triggerProducts: triggerProducts || [],
    });

    res.status(201).json({ success: true, data: { combo } });
  } catch (err) { next(err); }
});

// ── Update ────────────────────────────────────────────────────────────────────
router.patch('/:id', tenantAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const { name, description, image, price, choiceLines, active, triggerProducts } = req.body;
    const combo = await POSCombo.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });

    if (name !== undefined)   combo.name        = name.trim();
    if (description !== undefined) combo.description = description;
    if (image !== undefined)  combo.image       = image;
    if (price !== undefined)  combo.price       = Number(price) || 0;
    if (active !== undefined) combo.active      = active;
    if (triggerProducts !== undefined) combo.triggerProducts = triggerProducts;
    if (choiceLines !== undefined) {
      combo.choiceLines = choiceLines.map(cl => ({
        label:      cl.label,
        minSelect:  cl.minSelect ?? 1,
        maxSelect:  cl.maxSelect ?? 1,
        products:   cl.products || [],
        _id:        cl._id,
      }));
    }

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

// ── POS public endpoint — fetch active combos (used on sell page) ──────────────
router.get('/pos/active', async (req, res, next) => {
  try {
    const combos = await POSCombo.find({ tenant: req.tenant._id, active: true })
      .populate({
        path:    'choiceLines.products',
        select:  'sku baseSellingPrice availableStock product sizes sellWithoutSizeVariants',
        populate: { path: 'product', select: 'name images type' },
      })
      .lean();
    res.json({ success: true, data: { combos } });
  } catch (err) { next(err); }
});

module.exports = router;
